import pytest

from worker.adapters.llm_mock import MockLLMAdapter
from worker.adapters.xai_mock import MockXAIAdapter
from worker.services.runner import build_adapters
from worker.services import runner


def test_only_mock_provider_is_enabled(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "mock")
    llm_adapter, xai_adapter = build_adapters()
    assert llm_adapter.model_name == "mock-llm"
    assert xai_adapter.model_name == "mock-xai"


def test_real_provider_is_not_loaded_in_this_phase(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "qwen")
    with pytest.raises(RuntimeError):
        build_adapters()


def test_process_once_claims_and_completes_job(monkeypatch):
    events = []
    fake_client = object()

    class FakeClientContext:
        def __enter__(self):
            events.append("open")
            return fake_client

        def __exit__(self, exc_type, exc, traceback):
            events.append("close")
            return False

    monkeypatch.setattr(runner, "get_worker_client", lambda: FakeClientContext())
    monkeypatch.setattr(
        runner,
        "claim_next_job",
        lambda client, worker_id, lease_seconds: {
            "id": "job-1",
            "task_id": "task-1",
            "job_type": "llm_feedback",
        },
    )
    monkeypatch.setattr(
        runner,
        "get_task_for_job",
        lambda client, job_id, worker_id: {
            "id": "task-1",
            "source_text": "Öğrenci metni dikkatle okudu.",
            "initial_translation": "The student read the text carefully.",
        },
    )

    def complete_job(client, job_id, worker_id, model_name, structured_output, raw_output):
        events.append((client, job_id, worker_id, model_name, structured_output["summary"], raw_output))

    monkeypatch.setattr(runner, "complete_job", complete_job)

    did_work = runner.process_once("worker-1", MockLLMAdapter(), MockXAIAdapter())

    assert did_work is True
    assert events[0] == "open"
    assert events[-1] == "close"
    assert events[1][0] is fake_client
    assert events[1][1:4] == ("job-1", "worker-1", "mock-llm")
    assert events[1][5] == {"provider": "mock"}
