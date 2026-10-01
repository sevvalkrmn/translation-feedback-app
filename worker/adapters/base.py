from typing import Protocol

from worker.services.models import LLMFeedbackResult, XAIResult


class LLMFeedbackAdapter(Protocol):
    model_name: str

    def evaluate(self, source_text_tr: str, student_translation_en: str) -> LLMFeedbackResult:
        ...


class XAIAdapter(Protocol):
    model_name: str

    def evaluate(self, source_text_tr: str, student_translation_en: str) -> XAIResult:
        ...
