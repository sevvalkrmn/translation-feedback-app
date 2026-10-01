from worker.adapters.llm_qwen import QwenLLMAdapter
from worker.services.feedback import counterfactual_feedback
from worker.services.models import XAIResult


class QwenCounterfactualAdapter:
    model_name = "Qwen3.8-27B"
    provider = "qwen_counterfactual"

    def __init__(self, engine: QwenLLMAdapter) -> None:
        self.engine = engine

    def evaluate(self, source_text_tr: str, student_translation_en: str) -> XAIResult:
        return counterfactual_feedback(self.engine, source_text_tr, student_translation_en)
