from typing import Protocol

from worker.services.models import (
    Category, Dimension, EvaluationError, EvidenceItem, FeedbackIssue,
    LLMFeedbackResult, Severity, TranslationEvaluation, Verification, XAIResult,
)

PRIORITY = {"critical": 0, "major": 1, "minor": 2}
DIMENSION_FOR_CATEGORY: dict[Category, Dimension] = {
    "meaning_shift": "meaning_accuracy", "omission": "completeness", "addition": "completeness",
    "terminology": "terminology_register", "grammar": "grammar_fluency",
    "fluency": "grammar_fluency", "register_style": "terminology_register",
    "cohesion": "grammar_fluency",
}
FALLBACK = (
    "Sistem bu çeviride karşı-olgusal olarak doğrulanmış yüksek etkili bir hata belirleyemedi. "
    "Kaynak metindeki anlam, eksiksizlik ve üslup yönlerinden çevirini yeniden kontrol et."
)


class EvaluationEngine(Protocol):
    model_name: str

    def evaluate_shared(self, source: str, translation: str) -> TranslationEvaluation: ...

    def generate_counterfactual(
        self, source: str, translation: str, error: EvaluationError, alternative: bool
    ) -> str: ...


def exact_span_start(text: str, span: str) -> int | None:
    first = text.find(span)
    if first < 0 or text.find(span, first + 1) >= 0:
        return None
    return first


def validate_evaluation(evaluation: TranslationEvaluation, source: str, translation: str) -> None:
    for error in evaluation.errors:
        if error.source_span not in source or error.translation_span not in translation:
            raise ValueError("evaluation span not found")


def important_errors(evaluation: TranslationEvaluation) -> list[EvaluationError]:
    return sorted(evaluation.errors, key=lambda error: (PRIORITY[error.severity], error.id))[:2]


def normal_feedback(evaluation: TranslationEvaluation) -> LLMFeedbackResult:
    return LLMFeedbackResult(
        summary=evaluation.summary,
        errors=[FeedbackIssue(
            source_span=error.source_span, translation_span=error.translation_span,
            category=error.category, severity=error.severity,
            explanation=error.detected_problem, hint=error.student_hint,
        ) for error in important_errors(evaluation)],
        evaluation=evaluation,
    )


def apply_minimal_change(translation: str, span: str, replacement: str) -> str | None:
    start = exact_span_start(translation, span)
    if start is None or not replacement or replacement == span:
        return None
    if span.strip() == translation.strip() or (len(span) > len(translation) // 2 and len(span.split()) > 4):
        return None
    if len(replacement) > min(160, max(len(span) * 3, len(span) + 30)):
        return None
    if "\n" in replacement or "\r" in replacement or len(replacement.split()) > len(span.split()) + 1:
        return None
    end = start + len(span)
    candidate = translation[:start] + replacement + translation[end:]
    if candidate == translation or not candidate.startswith(translation[:start]) or not candidate.endswith(translation[end:]):
        return None
    return candidate


def verify_change(
    before: TranslationEvaluation, after: TranslationEvaluation,
    target: EvaluationError,
) -> Verification:
    dimension = DIMENSION_FOR_CATEGORY[target.category]
    prior_other = {
        (error.source_span, error.translation_span, error.category)
        for error in before.errors if error.id != target.id and error.severity in ("major", "critical")
    }
    related = [
        error for error in after.errors
        if error.category == target.category and error.source_span == target.source_span
    ]
    after_severity: Severity | None = min(
        (error.severity for error in related), key=lambda item: PRIORITY[item]
    ) if related else None
    new_major = any(
        (error.severity in ("major", "critical") or error.category == "addition")
        and (error.source_span, error.translation_span, error.category) not in prior_other
        and error not in related for error in after.errors
    )
    delta = getattr(after.dimension_scores, dimension) - getattr(before.dimension_scores, dimension)
    improved = after_severity is None or PRIORITY[after_severity] > PRIORITY[target.severity]
    return Verification(
        status="verified" if improved and not new_major and delta >= 0 else "inconclusive",
        before_severity=target.severity, after_severity=after_severity,
        relevant_dimension=dimension, score_delta=delta,
        no_new_major_error=not new_major,
    )


def _inconclusive(error: EvaluationError) -> Verification:
    return Verification(
        status="inconclusive", before_severity=error.severity,
        after_severity=error.severity, relevant_dimension=DIMENSION_FOR_CATEGORY[error.category],
        score_delta=0, no_new_major_error=False,
    )


def counterfactual_feedback(
    engine: EvaluationEngine, source: str, translation: str,
    before: TranslationEvaluation | None = None,
) -> XAIResult:
    before = before or engine.evaluate_shared(source, translation)
    validate_evaluation(before, source, translation)
    evidence: list[EvidenceItem] = []
    for error in important_errors(before):
        verification = _inconclusive(error)
        if exact_span_start(source, error.source_span) is not None and exact_span_start(translation, error.translation_span) is not None:
            for alternative in (False, True):
                replacement = engine.generate_counterfactual(source, translation, error, alternative)
                candidate = apply_minimal_change(translation, error.translation_span, replacement)
                if candidate is None:
                    continue
                after = engine.evaluate_shared(source, candidate)
                validate_evaluation(after, source, candidate)
                verification = verify_change(before, after, error)
                if verification.status == "verified":
                    break
        description = (
            f'Kaynakta "{error.source_span}" ifadesi {error.source_meaning}. '
            f'Öğrenci çevirisindeki "{error.translation_span}" için saptanan sorun: {error.detected_problem}. '
            + ("Kontrollü değişiklik testinde karar değişti." if verification.status == "verified"
               else "Kontrollü değişiklik testinde karar yeterince kararlı biçimde doğrulanamadı.")
        )
        evidence.append(EvidenceItem(
            source_span=error.source_span, translation_span=error.translation_span,
            category=error.category, severity=error.severity,
            decision_explanation=description, verification=verification,
            student_hint=error.student_hint,
        ))
    verified = [item for item in evidence if item.verification.status == "verified"]
    inconclusive = [item for item in evidence if item.verification.status == "inconclusive"]
    return XAIResult(
        summary=before.summary if verified else FALLBACK,
        evidence_items=(verified + inconclusive)[:2] if verified else [],
        evaluation=before,
    )
