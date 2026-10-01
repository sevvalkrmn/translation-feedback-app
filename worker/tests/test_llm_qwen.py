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
from worker.services.models import TranslationEvaluation
from worker.services.models import EvaluationError


TRANSLATION = "The proposal seemed hopeful, so the committee cancelled it."


def valid_feedback():
    return {
        "schema_version": "1.0",
        "prompt_version": "translation-evaluation-v1.1",
        "model": "Qwen3.8-27B",
        "language_pair": "tr-en",
        "overall_score": 72,
        "dimension_scores": {
            "meaning_accuracy": 65, "completeness": 90,
            "grammar_fluency": 82, "terminology_register": 70,
        },
        "summary": "Ana fikir kısmen korunmuş; kararın geçici niteliği kaybolmuş.",
        "errors": [
            {
                "id": "error_1",
                "source_span": "Kaynak",
                "translation_span": "cancelled it",
                "category": "meaning_shift",
                "severity": "major",
                "source_meaning": "Geçici durdurma",
                "detected_problem": "Kesin iptal anlamı",
                "student_hint": "Kararın kalıcılığını kaynakla karşılaştırın.",
            }
        ],
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

    first = adapter.evaluate("Kaynak", TRANSLATION)
    second = adapter.evaluate("Kaynak", TRANSLATION)

    assert first == second
    assert first.method == "llm"
    assert len(load_calls) == 1
    assert len(prompts) == 2
    assert "source_text_tr" in prompts[0]
    assert "student_translation_en" in prompts[0]
    assert "additionalProperties" in prompts[0]


def test_critical_without_evidence_is_downgraded_in_adapter(tmp_path, monkeypatch):
    data = valid_feedback()
    data["errors"][0]["severity"] = "critical"
    adapter, _, prompts = adapter_without_model(tmp_path, monkeypatch, [json.dumps(data, ensure_ascii=False)])

    result = adapter.evaluate("Kaynak", TRANSLATION)

    assert result.errors[0].severity == "major"
    assert result.evaluation.errors[0].severity == "major"
    assert "bus yerine train = major" in prompts[0]


def test_old_prompt_version_gets_one_repair(tmp_path, monkeypatch):
    old = valid_feedback()
    old["prompt_version"] = "translation-evaluation-v1"
    adapter, _, prompts = adapter_without_model(tmp_path, monkeypatch, [
        json.dumps(old, ensure_ascii=False), json.dumps(valid_feedback(), ensure_ascii=False),
    ])

    assert adapter.evaluate("Kaynak", TRANSLATION).evaluation.prompt_version == "translation-evaluation-v1.1"
    assert len(prompts) == 2


def test_json_code_fence_is_cleaned(tmp_path, monkeypatch):
    fenced = "```json\n" + json.dumps(valid_feedback(), ensure_ascii=False) + "\n```"
    adapter, _, prompts = adapter_without_model(tmp_path, monkeypatch, [fenced])

    assert adapter.evaluate("Kaynak", TRANSLATION).errors[0].category == "meaning_shift"
    assert len(prompts) == 1


def test_broken_json_gets_exactly_one_repair(tmp_path, monkeypatch):
    adapter, _, prompts = adapter_without_model(
        tmp_path, monkeypatch, ["{broken", json.dumps(valid_feedback(), ensure_ascii=False)]
    )

    assert adapter.evaluate("Kaynak", TRANSLATION).summary
    assert len(prompts) == 2
    assert "Önceki yanıt" in prompts[1]


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
        TranslationEvaluation.model_validate(invalid)
    assert QwenLLMAdapter._parse_json(json.dumps(valid_feedback())) == valid_feedback()


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


def test_counterfactual_returns_only_replacement_fragment(tmp_path, monkeypatch):
    adapter, load_calls, prompts = adapter_without_model(
        tmp_path, monkeypatch, [json.dumps({"replacement_span": "temporarily suspend the project"})]
    )
    target = EvaluationError.model_validate(valid_feedback()["errors"][0])
    replacement = adapter.generate_counterfactual("Kaynak", TRANSLATION, target)
    assert replacement == "temporarily suspend the project"
    assert len(load_calls) == 1
    assert "replacement_span" in prompts[0]
    assert "<student_data>" in prompts[0]
