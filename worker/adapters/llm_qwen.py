import json
import re
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from worker.services.models import LLMFeedbackResult


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
        self._system_prompt = (
            Path(__file__).resolve().parents[1] / "prompts" / "llm_feedback_system.txt"
        ).read_text(encoding="utf-8")
        self._schema = json.dumps(LLMFeedbackResult.model_json_schema(), ensure_ascii=False)

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
        payload = json.dumps(
            {"source_text_tr": source_text_tr, "student_translation_en": student_translation_en},
            ensure_ascii=False,
        )
        prompt = (
            f"{self._system_prompt}\n\nJSON şeması:\n{self._schema}\n\n"
            f"Değerlendirilecek veri:\n{payload}\n\n"
            "Çıktı yalnızca bir JSON nesnesi olsun. target_span, öğrenci çevirisinin birebir alt dizgesi olsun."
        )
        first_output = self._generate(prompt)
        try:
            return self._parse(first_output, student_translation_en)
        except QwenFeedbackError:
            repair_prompt = (
                f"{prompt}\n\nÖnceki cevap JSON şemasına veya target_span kuralına uymadı. "
                "Yalnızca düzeltilmiş JSON nesnesini üret; açıklama veya Markdown ekleme.\n"
                f"Önceki cevap:\n{first_output[:12000]}"
            )
            repaired_output = self._generate(repair_prompt)
            try:
                return self._parse(repaired_output, student_translation_en)
            except QwenFeedbackError:
                raise QwenFeedbackError("Qwen geri bildirimi iki denemede doğrulanamadı.") from None

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
    def _parse(output: str, student_translation_en: str) -> LLMFeedbackResult:
        clean = output.strip()
        fenced = re.fullmatch(r"```(?:json)?\s*\n(.*?)\n```", clean, flags=re.DOTALL | re.IGNORECASE)
        if fenced:
            clean = fenced.group(1).strip()
        try:
            data = json.loads(clean)
            result = LLMFeedbackResult.model_validate(data)
            if any(error.target_span not in student_translation_en for error in result.errors):
                raise ValueError("target_span mismatch")
            return result
        except (json.JSONDecodeError, ValidationError, ValueError, TypeError):
            raise QwenFeedbackError("Qwen geri bildirimi geçerli JSON şemasında değil.") from None
