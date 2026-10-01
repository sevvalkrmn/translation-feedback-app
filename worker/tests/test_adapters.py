from worker.adapters.llm_mock import MockLLMAdapter
from worker.adapters.xai_mock import MockXAIAdapter


def test_mock_llm_adapter_returns_structured_feedback():
    result = MockLLMAdapter().evaluate(
        "Öğrenci öneriyi dikkatle değerlendirdi.",
        "The student evaluated the proposal carefully.",
    )

    assert result.summary
    assert result.method == "llm"
    assert result.evaluation.schema_version == "1.0"
    assert result.errors == []


def test_mock_xai_adapter_returns_valid_span():
    translation = "She decided hardly after the meeting."
    result = MockXAIAdapter().evaluate("Karar vermekte zorlandı.", translation)
    error = result.evidence_items[0]
    assert error.translation_span in translation
    assert error.verification.status == "verified"
    assert error.severity == "minor"
    assert "with difficulty" not in result.model_dump_json()
