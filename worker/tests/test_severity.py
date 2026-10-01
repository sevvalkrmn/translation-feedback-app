from worker.services.feedback import calibrate_evaluation, verify_change
from worker.services.models import CriticalEvidence, DimensionScores, EvaluationError, TranslationEvaluation


def evaluation(error):
    return TranslationEvaluation(
        schema_version="1.0", prompt_version="translation-evaluation-v1.1",
        model="Qwen3.8-27B", language_pair="tr-en", overall_score=60,
        dimension_scores=DimensionScores(
            meaning_accuracy=60, completeness=70, grammar_fluency=80,
            terminology_register=80,
        ), errors=[error] if error else [], summary="Çeviri değerlendirildi.",
    )


def issue(source_span, translation_span, *, category="meaning_shift", severity="critical", criterion=None):
    evidence = CriticalEvidence(
        criterion=criterion, source_span=source_span, translation_span=translation_span,
    ) if criterion else None
    return EvaluationError(
        id="error_1", source_span=source_span, translation_span=translation_span,
        category=category, severity=severity, source_meaning="Kaynak anlamı",
        detected_problem="Anlam değişiyor", student_hint="Kaynağı yeniden kontrol et.",
        critical_evidence=evidence,
    )


def calibrated(source, translation, error):
    return calibrate_evaluation(evaluation(error), source, translation)


def test_bus_train_is_major_even_if_model_claims_critical():
    result = calibrated(
        "Toplantı beklenenden uzun sürdüğü için son otobüsü kaçırdım.",
        "I missed the last train because the meeting took longer than expected.",
        issue("otobüsü", "train", criterion="claim_reversal"),
    )
    assert result.errors[0].severity == "major"


def test_temporary_suspension_vs_cancellation_is_major():
    result = calibrated(
        "Komite, artan maliyetler nedeniyle projeyi geçici olarak durdurmaya karar verdi.",
        "The committee decided to cancel the project because of the rising costs.",
        issue("geçici olarak durdurmaya", "cancel the project", criterion="claim_reversal"),
    )
    assert result.errors[0].severity == "major"


def test_central_approval_rejection_is_critical():
    result = calibrated(
        "Proje onaylandı.", "The project was rejected.",
        issue("onaylandı", "rejected", criterion="claim_reversal"),
    )
    assert result.errors[0].severity == "critical"


def test_overlapping_full_clause_evidence_is_critical():
    evidence = CriticalEvidence(
        criterion="claim_reversal", source_span="Proje onaylandı.",
        translation_span="The project was rejected.",
    )
    error = issue("onaylandı", "rejected").model_copy(update={"critical_evidence": evidence})
    result = calibrated("Proje onaylandı.", "The project was rejected.", error)
    assert result.errors[0].severity == "critical"


def test_central_sentence_omission_is_critical():
    omitted = "Komite projeyi ayrıntılı incelemenin ardından oy birliğiyle onayladı."
    result = calibrated(
        omitted + " Toplantı bitti.", "The meeting ended.",
        issue(omitted, "The meeting ended.", category="omission", criterion="central_sentence_omitted"),
    )
    assert result.errors[0].severity == "critical"


def test_small_article_error_remains_minor():
    result = calibrated(
        "Öğrenci bir kitap okudu.", "Student read a book.",
        issue("Öğrenci", "Student", category="grammar", severity="minor"),
    )
    assert result.errors[0].severity == "minor"


def test_missing_or_mismatched_critical_evidence_downgrades_and_is_not_serialized():
    source, translation = "Proje onaylandı.", "The project was rejected."
    missing = calibrated(source, translation, issue("onaylandı", "rejected"))
    assert missing.errors[0].severity == "major"
    mismatch = issue("onaylandı", "rejected", criterion="claim_reversal")
    mismatch = mismatch.model_copy(update={
        "critical_evidence": CriticalEvidence(
            criterion="claim_reversal", source_span="Proje", translation_span="rejected",
        ),
    })
    assert calibrated(source, translation, mismatch).errors[0].severity == "major"
    accepted = calibrated(source, translation, issue("onaylandı", "rejected", criterion="claim_reversal"))
    assert "critical_evidence" not in accepted.model_dump_json()


def test_xai_verification_uses_calibrated_severity():
    source = "Komite projeyi geçici olarak durdurdu."
    translation = "The committee decided to cancel the project."
    before = calibrated(source, translation, issue("geçici olarak durdurdu", "cancel the project"))
    after = evaluation(None).model_copy(update={
        "dimension_scores": DimensionScores(
            meaning_accuracy=70, completeness=70, grammar_fluency=80,
            terminology_register=80,
        ),
    })
    verification = verify_change(before, after, before.errors[0])
    assert before.errors[0].severity == "major"
    assert verification.status == "verified"
    assert verification.before_severity == "major"
