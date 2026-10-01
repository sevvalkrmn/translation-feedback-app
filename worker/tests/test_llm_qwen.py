import json
from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from worker.adapters.llm_qwen import (
    QwenFeedbackError,
    QwenInferenceError,
    QwenLLMAdapter,
    QwenLoadError,
)
from worker.services.models import LLMFeedbackResult


TRANSLATION = "The proposal seemed hopeful, so the committee cancelled it."


def valid_feedback():
    return {
        "summary": "Ana fikir kısmen korunmuş; kararın geçici niteliği kaybolmuş.",
        "strengths": ["Karar veren aktör doğru aktarılmış."],
        "errors": [
            {
                "target_span": "cancelled it",
                "category": "meaning",
                "severity": "major",
                "explanation": "Kaynakta geçici durdurma var, kesin iptal yok.",
                "hint": "Kararın kalıcılığını kaynak metinle yeniden karşılaştırın.",
            }
        ],
        "revision_guidance": ["Kararın geçici oluşunu İngilizcede nasıl göstereceğinizi düşünün."],
    }


def adapter_without_model(tmp_path, monkeypatch, outputs):
    (tmp_path / "config.json").write_text("{}")
    load_calls = []
    monkeypatch.setattr(
        QwenLLMAdapter,
        "_load_runtime",
        lambda self: (load_calls.append(self.model_path) or (object(), object(), object())),
    )
    adapter = QwenLLMAdapter(str(tmp_path))
    prompts = []
    responses = iter(outputs)

    def generate(prompt):
        prompts.append(prompt)
        return next(responses)

    monkeypatch.setattr(adapter, "_generate", generate)
    return adapter, load_calls, prompts


def test_missing_or_invalid_model_path_fails_before_load(monkeypatch, tmp_path):
    monkeypatch.setattr(QwenLLMAdapter, "_load_runtime", lambda self: pytest.fail("loaded"))
    with pytest.raises(QwenLoadError, match="QWEN_MODEL_PATH"):
        QwenLLMAdapter(None)
    with pytest.raises(QwenLoadError, match="QWEN_MODEL_PATH"):
        QwenLLMAdapter(str(tmp_path))


def test_valid_json_and_second_inference_reuse_one_load(tmp_path, monkeypatch):
    feedback = json.dumps(valid_feedback(), ensure_ascii=False)
    adapter, load_calls, prompts = adapter_without_model(tmp_path, monkeypatch, [feedback, feedback])

    first = adapter.evaluate("Öneri geçici olarak durduruldu.", TRANSLATION)
    second = adapter.evaluate("Öneri geçici olarak durduruldu.", TRANSLATION)

    assert first == second
    assert isinstance(first, LLMFeedbackResult)
    assert len(load_calls) == 1
    assert len(prompts) == 2
    assert "source_text_tr" in prompts[0]
    assert "student_translation_en" in prompts[0]
    assert "additionalProperties" in prompts[0]


def test_json_code_fence_is_cleaned(tmp_path, monkeypatch):
    fenced = "```json\n" + json.dumps(valid_feedback(), ensure_ascii=False) + "\n```"
    adapter, _, prompts = adapter_without_model(tmp_path, monkeypatch, [fenced])

    assert adapter.evaluate("Kaynak", TRANSLATION).errors[0].category == "meaning"
    assert len(prompts) == 1


def test_broken_json_gets_exactly_one_repair(tmp_path, monkeypatch):
    adapter, _, prompts = adapter_without_model(
        tmp_path, monkeypatch, ["{broken", json.dumps(valid_feedback(), ensure_ascii=False)]
    )

    assert adapter.evaluate("Kaynak", TRANSLATION).summary
    assert len(prompts) == 2
    assert "Önceki cevap" in prompts[1]


def test_second_parse_failure_is_controlled_and_silent(tmp_path, monkeypatch, capsys):
    adapter, _, prompts = adapter_without_model(tmp_path, monkeypatch, ["secret source {", "invalid again"])

    with pytest.raises(QwenFeedbackError, match="iki denemede") as exc_info:
        adapter.evaluate("özel öğrenci metni", TRANSLATION)

    assert len(prompts) == 2
    assert "özel öğrenci metni" not in str(exc_info.value)
    assert "secret source" not in str(exc_info.value)
    output = capsys.readouterr()
    assert "özel öğrenci metni" not in output.out + output.err
    assert "secret source" not in output.out + output.err


def test_schema_and_target_span_are_validated():
    invalid = valid_feedback()
    invalid["extra"] = "unexpected"
    with pytest.raises(ValidationError):
        LLMFeedbackResult.model_validate(invalid)
    with pytest.raises(QwenFeedbackError):
        QwenLLMAdapter._parse(json.dumps(valid_feedback()), "unrelated translation")


def test_generation_uses_verified_template_and_deterministic_settings(tmp_path, monkeypatch):
    events = []

    class Inputs(dict):
        def to(self, device):
            events.append(("device", device))
            return self

    class Generated:
        def __getitem__(self, key):
            assert key[1].start == 3
            return "new-tokens"

    class Model:
        def parameters(self):
            yield SimpleNamespace(device=SimpleNamespace(type="cuda"))

        def generate(self, **kwargs):
            events.append(("generate", kwargs))
            return Generated()

    class Processor:
        def apply_chat_template(self, messages, **kwargs):
            events.append(("template", kwargs))
            return Inputs(input_ids=SimpleNamespace(shape=(1, 3)))

        def batch_decode(self, new_tokens, **kwargs):
            events.append(("decode", new_tokens, kwargs))
            return ["{}"]

    @contextmanager
    def inference_mode():
        events.append(("inference", "start"))
        yield
        events.append(("inference", "end"))

    (tmp_path / "config.json").write_text("{}")
    fake_torch = SimpleNamespace(
        inference_mode=inference_mode,
        cuda=SimpleNamespace(OutOfMemoryError=type("OutOfMemoryError", (RuntimeError,), {})),
    )
    monkeypatch.setattr(QwenLLMAdapter, "_load_runtime", lambda self: (fake_torch, Processor(), Model()))
    adapter = QwenLLMAdapter(str(tmp_path))

    assert adapter._generate("feedback prompt") == "{}"
    template_args = next(value for kind, value in events if kind == "template")
    generate_args = next(value for kind, value in events if kind == "generate")
    assert template_args["enable_thinking"] is False
    assert generate_args["do_sample"] is False
    assert generate_args["repetition_penalty"] == 1.05
    assert ("inference", "start") in events


def test_cuda_oom_becomes_controlled_error(tmp_path, monkeypatch):
    class OOM(RuntimeError):
        pass

    class Inputs(dict):
        def to(self, device):
            return self

    class Model:
        def parameters(self):
            yield SimpleNamespace(device=SimpleNamespace(type="cuda"))

        def generate(self, **kwargs):
            raise OOM("private input details")

    class Processor:
        def apply_chat_template(self, messages, **kwargs):
            return Inputs(input_ids=SimpleNamespace(shape=(1, 3)))

    @contextmanager
    def inference_mode():
        yield

    (tmp_path / "config.json").write_text("{}")
    fake_torch = SimpleNamespace(inference_mode=inference_mode, cuda=SimpleNamespace(OutOfMemoryError=OOM))
    monkeypatch.setattr(QwenLLMAdapter, "_load_runtime", lambda self: (fake_torch, Processor(), Model()))
    adapter = QwenLLMAdapter(str(tmp_path))

    with pytest.raises(QwenInferenceError, match="CUDA belleği") as exc_info:
        adapter._generate("private input details")
    assert "private input details" not in str(exc_info.value)
