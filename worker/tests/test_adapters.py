from worker.adapters.llm_mock import MockLLMAdapter
from worker.adapters.xai_mock import MockXAIAdapter


def test_mock_llm_adapter_returns_structured_feedback():
    result = MockLLMAdapter().evaluate(
        "Öğrenci öneriyi dikkatle değerlendirdi.",
        "The student evaluated the proposal carefully.",
    )

    assert result.summary
    assert result.strengths
    assert result.revision_guidance
    assert result.errors[0].severity in {"minor", "major", "critical"}


def test_mock_xai_adapter_returns_valid_span():
    translation = "She decided hardly after the meeting."
    result = MockXAIAdapter().evaluate("Karar vermekte zorlandı.", translation)
    error = result.errors[0]

    assert translation[error.target_start:error.target_end] == error.target_span
    assert 0 <= error.confidence <= 1
    assert error.severity == "major"
