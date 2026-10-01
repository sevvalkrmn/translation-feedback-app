import pytest

from worker.services.runner import build_adapters


def test_only_mock_provider_is_enabled(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "mock")
    llm_adapter, xai_adapter = build_adapters()
    assert llm_adapter.model_name == "mock-llm"
    assert xai_adapter.model_name == "mock-xai"


def test_real_provider_is_not_loaded_in_this_phase(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "qwen")
    with pytest.raises(RuntimeError):
        build_adapters()
