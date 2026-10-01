from worker.services.models import XAIResult


class CometKiwiAdapter:
    model_name = "cometkiwi-unconfigured"

    def evaluate(self, source_text_tr: str, student_translation_en: str) -> XAIResult:
        raise NotImplementedError("COMETKiwi adapter is a placeholder; model is not installed or configured yet.")
