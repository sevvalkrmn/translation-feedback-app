from worker.services.feedback import normal_feedback
from worker.services.models import DimensionScores, EvaluationError, LLMFeedbackResult, TranslationEvaluation


class MockEvaluationEngine:
    model_name = "Qwen3.8-27B"
    provider = "mock"

    def evaluate_shared(self, source: str, translation: str) -> TranslationEvaluation:
        errors: list[EvaluationError] = []
        if "geçici" in source and "cancel" in translation:
            span = "cancel the project" if "cancel the project" in translation else "cancel"
            errors.append(EvaluationError(
                id="error_1", source_span="geçici", translation_span=span,
                category="meaning_shift", severity="major",
                source_meaning="eylemin geçici olduğunu belirtiyor",
                detected_problem="Kalıcı iptal anlamı oluşuyor",
                student_hint="Eylemin geçici niteliğini koruyan bir ifade düşün.",
            ))
        if "hardly" in translation:
            words = source.split()
            errors.append(EvaluationError(
                id=f"error_{len(errors) + 1}", source_span=words[0] if words else source,
                translation_span="hardly", category="fluency", severity="minor",
                source_meaning="bağlamdaki eylemi anlatıyor",
                detected_problem="Bu zarf bağlamda doğal durmuyor",
                student_hint="Eylemi daha doğal bir İngilizce kalıpla ifade etmeyi düşün.",
            ))
        score = 72 if errors else 90
        return TranslationEvaluation(
            schema_version="1.0", prompt_version="translation-evaluation-v1",
            model=self.model_name, language_pair="tr-en", overall_score=score,
            dimension_scores=DimensionScores(
                meaning_accuracy=65 if any(e.category == "meaning_shift" for e in errors) else 90,
                completeness=90, grammar_fluency=75 if any(e.category == "fluency" for e in errors) else 90,
                terminology_register=90,
            ),
            errors=errors,
            summary="Çeviride gözden geçirilebilecek ifadeler var." if errors else "Çeviri genel anlamı koruyor.",
        )

    def generate_counterfactual(self, source, translation, error, alternative=False) -> str:
        if error.category == "meaning_shift":
            return "temporarily suspend the project" if not alternative else "pause the project temporarily"
        return "with difficulty" if not alternative else "with some difficulty"


class MockLLMAdapter:
    model_name = "mock-llm"
    provider = "mock"

    def __init__(self, engine: MockEvaluationEngine | None = None) -> None:
        self.engine = engine or MockEvaluationEngine()

    def evaluate(self, source_text_tr: str, student_translation_en: str) -> LLMFeedbackResult:
        return normal_feedback(self.engine.evaluate_shared(source_text_tr, student_translation_en))
