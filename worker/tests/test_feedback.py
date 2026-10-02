import pytest
from pydantic import ValidationError

from worker.services.feedback import (
    apply_minimal_change, counterfactual_feedback, exact_span_start,
    important_errors, normal_feedback, normalize_model_text, sentence,
    validate_evaluation, verify_change,
)
from worker.services.models import DimensionScores, EvaluationError, TranslationEvaluation


SOURCE = "Komite projeyi geçici olarak durdurmaya karar verdi."
TRANSLATION = "The committee decided to cancel the project."


def error(**changes):
    data = {
        "id": "error_1", "source_span": "geçici olarak durdurmaya",
        "translation_span": "cancel the project", "category": "meaning_shift",
        "severity": "major", "source_meaning": "geçici durdurma",
        "detected_problem": "kalıcı iptal", "student_hint": "Geçiciliği düşün.",
    }
    return EvaluationError(**(data | changes))


def evaluation(errors=None, meaning=65):
    return TranslationEvaluation(
        schema_version="1.0", prompt_version="translation-evaluation-v1",
        model="Qwen3.8-27B", language_pair="tr-en", overall_score=72,
        dimension_scores=DimensionScores(
            meaning_accuracy=meaning, completeness=90, grammar_fluency=82,
            terminology_register=70,
        ), errors=[] if errors is None else errors, summary="Çeviri değerlendirildi.",
    )


def test_contract_and_allowed_values():
    assert evaluation([error()]).overall_score == 72
    with pytest.raises(ValidationError):
        evaluation([error(category="invented")])
    with pytest.raises(ValidationError):
        error(severity="extreme")
    with pytest.raises(ValidationError):
        evaluation([error()], meaning=101)
    with pytest.raises(ValidationError):
        evaluation([error(), error(id="error_2"), error(id="error_3")])


def test_span_validation_and_unicode():
    validate_evaluation(evaluation([error()]), SOURCE, TRANSLATION)
    for changed in (error(source_span="yok"), error(translation_span="missing")):
        with pytest.raises(ValueError):
            validate_evaluation(evaluation([changed]), SOURCE, TRANSLATION)
    assert exact_span_start("🙂 geçici 🙂", "geçici") == 2
    assert exact_span_start("çağrı çağrı", "çağrı") is None
    assert apply_minimal_change("🙂 cancel 🙂", "cancel", "pause") == "🙂 pause 🙂"


def test_priority_and_visible_limit():
    minor = error(id="error_1", severity="minor")
    critical = error(id="error_2", severity="critical", translation_span="committee", source_span="Komite")
    result = normal_feedback(evaluation([minor, critical]))
    assert [item.severity for item in result.errors] == ["critical", "minor"]
    assert len(result.errors) <= 2


def test_student_summary_only_counts_selected_errors():
    third = error(id="error_3", category="omission", severity="minor", detected_problem="Gizli üçüncü hata")
    three = evaluation([error(), error(id="error_2")]).model_copy(update={
        "errors": [error(), error(id="error_2"), third],
        "summary": "Gizli üçüncü hata var, kritik noktalar incelenmeli.",
    })
    result = normal_feedback(three)
    assert len(result.errors) == 2
    assert "üçüncü" not in result.summary
    assert "kritik" not in result.summary
    assert "iki ifade" in result.summary
    assert "Gizli üçüncü hata" not in result.model_dump_json()


def test_model_punctuation_normalization_and_empty_text():
    assert normalize_model_text("  Geçici süreliğine...  ") == "Geçici süreliğine."
    assert sentence("  Sorun giderilmeli.. ") == "Sorun giderilmeli."
    assert sentence("  ") == ""


def test_minimal_diff_rejects_ambiguous_or_wide_rewrite():
    assert apply_minimal_change(TRANSLATION, "cancel the project", "temporarily suspend the project") == (
        "The committee decided to temporarily suspend the project."
    )
    assert apply_minimal_change("cancel and cancel", "cancel", "pause") is None
    assert apply_minimal_change(TRANSLATION, "cancel the project", TRANSLATION) is None
    assert apply_minimal_change(TRANSLATION, TRANSLATION, "A completely rewritten sentence.") is None
    assert apply_minimal_change(TRANSLATION, "cancel the project", "pause\nthe project") is None


def test_verification_requires_more_than_score_increase():
    before = evaluation([error()])
    unchanged = evaluation([error(translation_span="temporarily suspend the project")], meaning=83)
    assert verify_change(before, unchanged, before.errors[0]).status == "inconclusive"
    gone = evaluation([], meaning=83)
    assert verify_change(before, gone, before.errors[0]).status == "verified"
    dropped = evaluation([error(severity="minor", translation_span="temporarily suspend the project")], meaning=65)
    assert verify_change(before, dropped, before.errors[0]).status == "verified"
    assert verify_change(before, evaluation([], meaning=64), before.errors[0]).status == "inconclusive"


def test_new_major_blocks_verification():
    before = evaluation([error()])
    new = error(id="error_2", source_span="Komite", translation_span="committee", category="addition")
    after = evaluation([new], meaning=80)
    result = verify_change(before, after, before.errors[0])
    assert result.status == "inconclusive"
    assert result.no_new_major_error is False
    minor_addition = evaluation([new.model_copy(update={"severity": "minor"})], meaning=80)
    assert verify_change(before, minor_addition, before.errors[0]).status == "inconclusive"


class FakeEngine:
    model_name = "Qwen3.8-27B"

    def __init__(self, before, after, replacements=None):
        self.before, self.after = before, after
        self.replacements = replacements or ["temporarily suspend the project"]
        self.calls = []

    def evaluate_shared(self, source, translation):
        self.calls.append(("evaluate", translation))
        return self.before if len([c for c in self.calls if c[0] == "evaluate"]) == 1 else self.after

    def generate_counterfactual(self, source, translation, target, alternative):
        self.calls.append(("candidate", alternative))
        return self.replacements[int(alternative)] if alternative and len(self.replacements) > 1 else self.replacements[0]


def test_xai_verified_without_candidate_leak(capsys):
    engine = FakeEngine(evaluation([error()]), evaluation([], meaning=83))
    result = counterfactual_feedback(engine, SOURCE, TRANSLATION)
    assert result.method == "xai"
    assert result.evidence_items[0].verification.status == "verified"
    assert len([c for c in engine.calls if c[0] == "evaluate"]) == 2
    assert "temporarily suspend the project" not in result.model_dump_json()
    assert "temporarily suspend the project" not in capsys.readouterr().out
    assert result.evidence_items[0].source_meaning == "geçici durdurma"
    assert result.evidence_items[0].detected_problem == "kalıcı iptal."
    assert "karar değişti" not in result.evidence_items[0].decision_explanation
    assert "iki" not in result.summary


def test_xai_inconclusive_fallback_and_two_attempt_limit():
    engine = FakeEngine(evaluation([error()]), evaluation([error(translation_span="replacement")], meaning=80), ["replacement", "replacement"])
    result = counterfactual_feedback(engine, SOURCE, TRANSLATION)
    assert result.evidence_items == []
    assert "doğrulanmış yüksek etkili" in result.summary
    assert result.evaluation.errors == []
    assert result.evaluation.summary == result.summary
    assert len([c for c in engine.calls if c[0] == "candidate"]) == 2


def test_xai_invalid_or_repeated_span_stays_inconclusive():
    before = evaluation([error(translation_span="cancel")])
    repeated = "cancel and cancel"
    engine = FakeEngine(before, evaluation([]))
    result = counterfactual_feedback(engine, SOURCE, repeated)
    assert result.evidence_items == []
    assert not engine.calls or all(c[0] != "candidate" for c in engine.calls)


def test_invalid_first_candidate_gets_one_alternative():
    engine = FakeEngine(
        evaluation([error()]), evaluation([], meaning=80),
        [TRANSLATION, "temporarily suspend the project"],
    )
    result = counterfactual_feedback(engine, SOURCE, TRANSLATION)
    assert result.evidence_items[0].verification.status == "verified"
    assert len([call for call in engine.calls if call[0] == "candidate"]) == 2
    assert len([call for call in engine.calls if call[0] == "evaluate"]) == 2


def test_no_error_needs_no_counterfactual_inference():
    engine = FakeEngine(evaluation(), evaluation())
    result = counterfactual_feedback(engine, SOURCE, TRANSLATION)
    assert result.evidence_items == []
    assert len(engine.calls) == 1
