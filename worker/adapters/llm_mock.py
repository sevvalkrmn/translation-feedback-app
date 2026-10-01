from worker.services.models import LLMFeedbackError, LLMFeedbackResult


class MockLLMAdapter:
    model_name = "mock-llm"

    def evaluate(self, source_text_tr: str, student_translation_en: str) -> LLMFeedbackResult:
        target_span = _choose_span(student_translation_en)
        return LLMFeedbackResult(
            summary=(
                "Çeviri ana fikri anlaşılır biçimde aktarıyor. Revizyonda sözcük seçimi, "
                "doğallık ve cümle akışı üzerinde çalışmanız önerilir."
            ),
            strengths=[
                "Kaynak metindeki temel ileti korunmuş.",
                "İngilizce cümle yapısı genel olarak takip edilebilir."
            ],
            errors=[
                LLMFeedbackError(
                    target_span=target_span,
                    category="word_choice",
                    severity="major",
                    explanation=(
                        "Bu bölüm kaynak metindeki anlamı kısmen taşısa da hedef dilde daha doğal "
                        "ve bağlama uygun bir ifade gerekebilir."
                    ),
                    hint="Kaynak metindeki eylemin bağlamını düşünün ve İngilizcede en yaygın kalıbı arayın."
                )
            ],
            revision_guidance=[
                "Önce kaynak metindeki ana eylemleri belirleyin.",
                "Son çeviride gereksiz birebir aktarımları azaltın.",
                "Tonun akademik ve doğal kalmasına dikkat edin."
            ],
        )


def _choose_span(text: str) -> str:
    words = text.split()
    if len(words) >= 2:
        return " ".join(words[:2])
    return text[: max(1, min(len(text), 20))]
