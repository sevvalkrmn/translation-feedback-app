import json
import re
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from worker.services.feedback import normal_feedback, validate_evaluation
from worker.services.models import CounterfactualCandidate, EvaluationError, LLMFeedbackResult, TranslationEvaluation


class QwenLoadError(RuntimeError):
    pass


class QwenInferenceError(RuntimeError):
    pass


class QwenFeedbackError(RuntimeError):
    pass


class QwenLLMAdapter:
    model_name = "Qwen3.8-27B"
    provider = "qwen"

    def __init__(self, model_path: str | None) -> None:
        if not model_path:
            raise QwenLoadError("QWEN_MODEL_PATH tanımlı değil.")
        path = Path(model_path).expanduser()
        if not path.is_dir() or not (path / "config.json").is_file():
            raise QwenLoadError("QWEN_MODEL_PATH geçerli bir yerel model dizini değil.")

        self.model_path = path
        self._torch, self._processor, self._model = self._load_runtime()
        prompts = Path(__file__).resolve().parents[1] / "prompts"
        self._evaluation_prompt = (prompts / "translation_evaluation_v1.txt").read_text(encoding="utf-8")
        self._counterfactual_prompt = (prompts / "counterfactual_candidate_v1.txt").read_text(encoding="utf-8")
        self._repair_prompt = (prompts / "json_repair_v1.txt").read_text(encoding="utf-8")

    def _load_runtime(self) -> tuple[Any, Any, Any]:
        try:
            import torch
            from transformers import AutoModelForMultimodalLM, AutoProcessor, BitsAndBytesConfig

            if torch.cuda.device_count() < 2:
                raise QwenLoadError("Qwen modeli için iki CUDA GPU gerekli.")

            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True,
                bnb_4bit_compute_dtype=torch.bfloat16,
            )
            processor = AutoProcessor.from_pretrained(
                str(self.model_path), local_files_only=True
            )
            model = AutoModelForMultimodalLM.from_pretrained(
                str(self.model_path),
                local_files_only=True,
                quantization_config=quantization_config,
                torch_dtype=torch.bfloat16,
                device_map="balanced",
                max_memory={0: "22GiB", 1: "22GiB", "cpu": "64GiB"},
                low_cpu_mem_usage=True,
            ).eval()
            return torch, processor, model
        except QwenLoadError:
            raise
        except Exception:
            raise QwenLoadError("Qwen modeli yerel dosyalardan yüklenemedi.") from None

    def evaluate(self, source_text_tr: str, student_translation_en: str) -> LLMFeedbackResult:
        return normal_feedback(self.evaluate_shared(source_text_tr, student_translation_en))

    def evaluate_shared(self, source_text_tr: str, student_translation_en: str) -> TranslationEvaluation:
        payload = json.dumps(
            {"source_text_tr": source_text_tr, "student_translation_en": student_translation_en},
            ensure_ascii=False,
        )
        prompt = (
            f"{self._evaluation_prompt}\n\nJSON şeması:\n"
            f"{json.dumps(TranslationEvaluation.model_json_schema(), ensure_ascii=False)}\n\n"
            f"<student_data>\n{payload}\n</student_data>"
        )

        def parse(output: str) -> TranslationEvaluation:
            result = TranslationEvaluation.model_validate(self._parse_json(output))
            validate_evaluation(result, source_text_tr, student_translation_en)
            return result

        return self._generate_validated(prompt, parse)

    def generate_counterfactual(
        self, source: str, translation: str, error: EvaluationError, alternative: bool = False
    ) -> str:
        payload = json.dumps({
            "source_text_tr": source, "student_translation_en": translation,
            "target_source_span": error.source_span,
            "target_translation_span": error.translation_span,
            "source_meaning": error.source_meaning,
            "alternative": alternative,
        }, ensure_ascii=False)
        prompt = (
            f"{self._counterfactual_prompt}\n\nJSON şeması:\n"
            f"{json.dumps(CounterfactualCandidate.model_json_schema(), ensure_ascii=False)}\n\n"
            f"<student_data>\n{payload}\n</student_data>"
        )
        return self._generate_validated(
            prompt, lambda output: CounterfactualCandidate.model_validate(self._parse_json(output))
        ).replacement_span

    def _generate_validated(self, prompt: str, parser: Any) -> Any:
        first = self._generate(prompt)
        try:
            return parser(first)
        except (ValidationError, ValueError, TypeError):
            repair = f"{self._repair_prompt}\n\n{prompt}\n\n<invalid_json>\n{first[:12000]}\n</invalid_json>"
            second = self._generate(repair)
            try:
                return parser(second)
            except (ValidationError, ValueError, TypeError):
                raise QwenFeedbackError("Qwen JSON çıktısı iki denemede doğrulanamadı.") from None

    def _generate(self, prompt: str) -> str:
        messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
        try:
            inputs = self._processor.apply_chat_template(
                messages,
                add_generation_prompt=True,
                tokenize=True,
                return_dict=True,
                return_tensors="pt",
                enable_thinking=False,
            )
            input_device = next(
                parameter.device
                for parameter in self._model.parameters()
                if parameter.device.type != "meta"
            )
            inputs = inputs.to(input_device)
            with self._torch.inference_mode():
                generated_ids = self._model.generate(
                    **inputs,
                    max_new_tokens=1000,
                    do_sample=False,
                    repetition_penalty=1.05,
                )
            new_tokens = generated_ids[:, inputs["input_ids"].shape[1]:]
            return self._processor.batch_decode(new_tokens, skip_special_tokens=True)[0]
        except self._torch.cuda.OutOfMemoryError:
            raise QwenInferenceError("Qwen inference sırasında CUDA belleği tükendi.") from None
        except Exception:
            raise QwenInferenceError("Qwen inference başarısız oldu.") from None

    @staticmethod
    def _parse_json(output: str) -> Any:
        clean = output.strip()
        fenced = re.fullmatch(r"```(?:json)?\s*\n(.*?)\n```", clean, flags=re.DOTALL | re.IGNORECASE)
        if fenced:
            clean = fenced.group(1).strip()
        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            raise ValueError("invalid JSON") from None
