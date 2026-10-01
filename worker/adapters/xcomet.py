from worker.services.models import XAIResult


class XCometAdapter:
    model_name = "xcomet-unconfigured"

    def evaluate(self, source_text_tr: str, student_translation_en: str) -> XAIResult:
        raise NotImplementedError("xCOMET adapter is a placeholder; model is not installed or configured yet.")
