import pytest

from worker.adapters.llm_mock import MockLLMAdapter
from worker.adapters.xai_mock import MockXAIAdapter
from worker.services.runner import build_adapters
from worker.services import runner


def test_only_mock_provider_is_enabled(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("XAI_PROVIDER", raising=False)
    monkeypatch.setenv("MODEL_PROVIDER", "mock")
    llm_adapter, xai_adapter = build_adapters()
    assert llm_adapter.model_name == "mock-llm"
    assert xai_adapter.model_name == "mock-xai"


def test_qwen_llm_and_mock_xai_are_selected_independently(monkeypatch):
    paths = []

    class FakeQwenAdapter:
        model_name = "Qwen3.8-27B"

        def __init__(self, model_path):
            paths.append(model_path)

    monkeypatch.setenv("MODEL_PROVIDER", "mock")
    monkeypatch.setenv("LLM_PROVIDER", "qwen")
    monkeypatch.setenv("XAI_PROVIDER", "mock")
    monkeypatch.setenv("QWEN_MODEL_PATH", "/test/model")
    monkeypatch.setattr(runner, "QwenLLMAdapter", FakeQwenAdapter)

    llm_adapter, xai_adapter = build_adapters()

    assert llm_adapter.model_name == "Qwen3.8-27B"
    assert xai_adapter.model_name == "mock-xai"
    assert paths == ["/test/model"]


def test_xcomet_is_rejected_before_loading_qwen(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "qwen")
    monkeypatch.setenv("XAI_PROVIDER", "xcomet")
    monkeypatch.setattr(runner, "QwenLLMAdapter", lambda path: pytest.fail("Qwen must not load"))

    with pytest.raises(RuntimeError, match="henüz uygulanmadı"):
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


def test_process_once_never_logs_student_text_or_secret(monkeypatch, capsys):
    student_text = "private student translation"
    secret = "sb_secret_do_not_log"

    class FakeClientContext:
        def __enter__(self):
            return object()

        def __exit__(self, exc_type, exc, traceback):
            return False

    class FailingAdapter:
        model_name = "Qwen3.8-27B"

        def evaluate(self, source_text, translation):
            raise RuntimeError(f"{translation} {secret}")

    reported_errors = []
    monkeypatch.setattr(runner, "get_worker_client", lambda: FakeClientContext())
    monkeypatch.setattr(
        runner,
        "claim_next_job",
        lambda client, worker_id, lease_seconds: {"id": "job-1", "job_type": "llm_feedback"},
    )
    monkeypatch.setattr(
        runner,
        "get_task_for_job",
        lambda client, job_id, worker_id: {
            "source_text": "özel kaynak",
            "initial_translation": student_text,
        },
    )
    monkeypatch.setattr(
        runner,
        "fail_job",
        lambda client, job_id, worker_id, error: reported_errors.append(error),
    )

    assert runner.process_once("worker-1", FailingAdapter(), MockXAIAdapter()) is True
    output = capsys.readouterr()
    for sensitive in [student_text, secret, "özel kaynak"]:
        assert sensitive not in output.out + output.err + " ".join(reported_errors)
    assert reported_errors == ["RuntimeError: feedback job failed"]
