import re
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


def normalize_model_text(value: str) -> str:
    return re.sub(r"([.!?])\1+$", r"\1", value.strip())


def sentence(value: str) -> str:
    normalized = normalize_model_text(value)
    return normalized + ("" if not normalized or normalized.endswith((".", "!", "?")) else ".")


def selected_summary(count: int) -> str:
    if count == 0:
        return "Bu çeviride gösterilecek belirgin bir sorun saptanmadı."
    quantity = "bir" if count == 1 else "iki"
    return f"Çeviride gözden geçirilmesi gereken {quantity} ifade belirlendi."


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


def _critical_supported(error: EvaluationError, source: str, translation: str) -> bool:
    evidence = error.critical_evidence
    if evidence is None:
        return False
    if exact_span_start(source, evidence.source_span) is None or exact_span_start(translation, evidence.translation_span) is None:
        return False
    if not (
        (error.source_span in evidence.source_span or evidence.source_span in error.source_span)
        and (error.translation_span in evidence.translation_span or evidence.translation_span in error.translation_span)
    ):
        return False

    source_part = evidence.source_span.casefold()
    translation_part = evidence.translation_span.casefold()
    if evidence.criterion == "claim_reversal":
        if error.category != "meaning_shift" or len(re.split(r"(?<=[.!?])\s+", source.strip())) != 1:
            return False
        if any(term in source_part or term in translation_part for term in (" not ", " never ", " değil", "yok", "onaylanmad", "reddedilmed")):
            return False
        approval = ("onay", "kabul", "approv", "accept")
        rejection = ("redd", "reject", "refus", "declin")
        return (
            (any(term in source_part for term in approval) and any(term in translation_part for term in rejection))
            or (any(term in source_part for term in rejection) and any(term in translation_part for term in approval))
        )

    if evidence.criterion == "central_sentence_omitted":
        sentences = re.split(r"(?<=[.!?])\s+", source.strip())
        if error.category != "omission" or len(sentences) < 2:
            return False
        first = sentences[0].strip(" .!?")
        source_words = len(source.split())
        return (
            evidence.source_span.strip(" .!?") == first
            and len(first.split()) >= 0.4 * source_words
            and len(translation.split()) <= 0.75 * source_words
        )

    return (
        error.category in ("meaning_shift", "omission")
        and len(source.split()) >= 6
        and len(translation.split()) <= max(2, 0.2 * len(source.split()))
        and evidence.translation_span.strip() == translation.strip()
    )


def calibrate_evaluation(evaluation: TranslationEvaluation, source: str, translation: str) -> TranslationEvaluation:
    errors = [
        error if error.severity != "critical" or _critical_supported(error, source, translation)
        else error.model_copy(update={"severity": "major"})
        for error in evaluation.errors
    ]
    return evaluation.model_copy(update={"errors": errors})


def important_errors(evaluation: TranslationEvaluation) -> list[EvaluationError]:
    return sorted(evaluation.errors, key=lambda error: (PRIORITY[error.severity], error.id))[:2]


def normal_feedback(evaluation: TranslationEvaluation) -> LLMFeedbackResult:
    selected = important_errors(evaluation)
    summary = selected_summary(len(selected))
    return LLMFeedbackResult(
        summary=summary,
        errors=[FeedbackIssue(
            source_span=error.source_span, translation_span=error.translation_span,
            category=error.category, severity=error.severity,
            explanation=sentence(error.detected_problem), hint=sentence(error.student_hint),
        ) for error in selected],
        evaluation=evaluation.model_copy(update={"summary": summary, "errors": selected}),
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
        evidence.append(EvidenceItem(
            source_span=error.source_span, translation_span=error.translation_span,
            category=error.category, severity=error.severity,
            decision_explanation=sentence(error.detected_problem),
            source_meaning=normalize_model_text(error.source_meaning),
            detected_problem=sentence(error.detected_problem),
            verification=verification, student_hint=sentence(error.student_hint),
        ))
    verified = [item for item in evidence if item.verification.status == "verified"]
    inconclusive = [item for item in evidence if item.verification.status == "inconclusive"]
    visible = (verified + inconclusive)[:2] if verified else []
    summary = selected_summary(len(visible)) if verified else FALLBACK
    visible_errors = [error for error in before.errors if any(
        error.source_span == item.source_span
        and error.translation_span == item.translation_span
        and error.category == item.category for item in visible
    )]
    return XAIResult(
        summary=summary,
        evidence_items=visible,
        evaluation=before.model_copy(update={"summary": summary, "errors": visible_errors}),
    )
