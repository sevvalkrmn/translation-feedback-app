from worker.services.models import XAIError, XAIResult


class MockXAIAdapter:
    model_name = "mock-xai"

    def evaluate(self, source_text_tr: str, student_translation_en: str) -> XAIResult:
        target_span, start, end = _choose_span(student_translation_en)
        return XAIResult(
            overall_score=0.74,
            summary="Çeviri genel anlamı koruyor ancak bazı sözcük seçimleri ve kalıp kullanımları güçlendirilebilir.",
            errors=[
                XAIError(
                    target_span=target_span,
                    target_start=start,
                    target_end=end,
                    source_span=_source_span(source_text_tr),
                    severity="major",
                    confidence=0.87,
                    category="word_choice",
                    explanation="Seçilen ifade kaynak metindeki nüansı hedef dilde yeterince doğal karşılamıyor.",
                    hint="Kaynak ifadenin işlevini düşünün; doğrudan cevabı yazmadan uygun İngilizce kalıbı araştırın.",
                    detector_model="mock-xai",
                    explainer_model="mock-explainer",
                )
            ],
        )


def _choose_span(text: str) -> tuple[str, int, int]:
    marker = "hardly"
    lowered = text.lower()
    if marker in lowered:
        start = lowered.index(marker)
        end = start + len(marker)
        return text[start:end], start, end

    stripped = text.strip()
    if not stripped:
        return "", 0, 1
    words = stripped.split()
    span = " ".join(words[: min(2, len(words))])
    start = text.index(span)
    return span, start, start + len(span)


def _source_span(text: str) -> str:
    words = text.split()
    return " ".join(words[: min(5, len(words))]) if words else "Kaynak bölüm tespit edilemedi."
