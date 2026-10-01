import json
from pathlib import Path
from urllib.error import HTTPError

import pytest

from worker.services.database import (
    SupabaseAPIError,
    SupabaseWorkerClient,
    claim_next_job,
    complete_job,
    fail_job,
    get_task_for_job,
    load_supabase_config,
)


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self):
        if self.payload is None:
            return b""
        return json.dumps(self.payload).encode("utf-8")


def test_load_supabase_config_requires_https_secret_key(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_test")

    config = load_supabase_config()

    assert config.url == "https://example.supabase.co"
    assert config.secret_key == "sb_secret_test"


def test_load_supabase_config_rejects_non_secret_key(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "not-a-secret-key")

    with pytest.raises(RuntimeError, match="SUPABASE_SECRET_KEY"):
        load_supabase_config()


def test_claim_next_job_calls_rpc_with_lease_payload():
    calls = []

    def opener(request, *, timeout):
        calls.append((request, timeout))
        return FakeResponse([{"id": "job-1", "task_id": "task-1", "job_type": "llm_feedback"}])

    client = SupabaseWorkerClient("https://example.supabase.co", "sb_secret_test", opener=opener)

    job = claim_next_job(client, "worker-1", 300)

    request, timeout = calls[0]
    assert request.full_url == "https://example.supabase.co/rest/v1/rpc/claim_next_model_job"
    assert request.get_method() == "POST"
    assert request.get_header("Apikey") == "sb_secret_test"
    assert request.get_header("Authorization") is None
    assert timeout == 30
    assert json.loads(request.data.decode("utf-8")) == {
        "p_worker_id": "worker-1",
        "p_lease_seconds": 300,
    }
    assert job == {"id": "job-1", "task_id": "task-1", "job_type": "llm_feedback"}


def test_claim_next_job_returns_none_when_queue_is_empty():
    client = SupabaseWorkerClient(
        "https://example.supabase.co",
        "sb_secret_test",
        opener=lambda request, *, timeout: FakeResponse([]),
    )

    assert claim_next_job(client, "worker-1", 300) is None


def test_get_task_for_job_calls_claimed_payload_rpc():
    calls = []

    def opener(request, *, timeout):
        calls.append(request)
        return FakeResponse([
            {
                "id": "task-1",
                "task_number": 1,
                "method": "llm",
                "source_text": "Kaynak metin",
                "initial_translation": "Initial translation",
            }
        ])

    client = SupabaseWorkerClient("https://example.supabase.co", "sb_secret_test", opener=opener)

    task = get_task_for_job(client, "job-1", "worker-1")

    request = calls[0]
    assert request.get_method() == "POST"
    assert request.full_url == "https://example.supabase.co/rest/v1/rpc/get_claimed_job_task_payload"
    assert json.loads(request.data.decode("utf-8")) == {
        "p_job_id": "job-1",
        "p_worker_id": "worker-1",
    }
    assert task["initial_translation"] == "Initial translation"


def test_get_task_for_job_returns_no_payload_for_wrong_worker_identity():
    client = SupabaseWorkerClient(
        "https://example.supabase.co",
        "sb_secret_test",
        opener=lambda request, *, timeout: FakeResponse([]),
    )

    with pytest.raises(RuntimeError, match="İşe bağlı çalışma bulunamadı"):
        get_task_for_job(client, "job-1", "other-worker")


def test_get_task_for_job_returns_no_payload_for_expired_lease():
    client = SupabaseWorkerClient(
        "https://example.supabase.co",
        "sb_secret_test",
        opener=lambda request, *, timeout: FakeResponse([]),
    )

    with pytest.raises(RuntimeError, match="İşe bağlı çalışma bulunamadı"):
        get_task_for_job(client, "expired-job", "worker-1")


def test_get_task_for_job_empty_rpc_result_does_not_leak_data():
    client = SupabaseWorkerClient(
        "https://example.supabase.co",
        "sb_secret_test",
        opener=lambda request, *, timeout: FakeResponse([]),
    )

    with pytest.raises(RuntimeError) as exc_info:
        get_task_for_job(client, "missing-job", "worker-1")

    assert "missing-job" not in str(exc_info.value)
    assert "worker-1" not in str(exc_info.value)


def test_get_task_for_job_http_error_is_reported_without_secret():
    secret_key = "sb_secret_sensitive"

    def opener(request, *, timeout):
        raise HTTPError(
            request.full_url,
            500,
            "Internal Server Error",
            hdrs=None,
            fp=FakeErrorBody(f"rpc failed for {secret_key}"),
        )

    client = SupabaseWorkerClient("https://example.supabase.co", secret_key, opener=opener)

    with pytest.raises(SupabaseAPIError) as exc_info:
        get_task_for_job(client, "job-1", "worker-1")

    message = str(exc_info.value)
    assert "HTTP 500" in message
    assert secret_key not in message
    assert "[redacted]" in message


def test_task_payload_rpc_migration_enforces_worker_identity_and_active_lease():
    migration = Path("supabase/migrations/20261001101141_add_worker_task_payload_rpc.sql").read_text()

    assert "create or replace function public.get_claimed_job_task_payload" in migration
    assert "p_job_id uuid" in migration
    assert "p_worker_id text" in migration
    assert "returns table" in migration
    assert "join public.translation_tasks tasks on tasks.id = jobs.task_id" in migration
    assert "jobs.id = p_job_id" in migration
    assert "jobs.status = 'processing'" in migration
    assert "jobs.locked_by = p_worker_id" in migration
    assert "jobs.lease_expires_at > now()" in migration
    assert "access_token_hash" not in migration
    assert "first_name" not in migration
    assert "last_name" not in migration
    assert "grant select" not in migration.lower()


def test_complete_and_fail_jobs_call_expected_rpc_functions():
    calls = []

    def opener(request, *, timeout):
        calls.append((request.full_url, json.loads(request.data.decode("utf-8"))))
        return FakeResponse(None)

    client = SupabaseWorkerClient("https://example.supabase.co", "sb_secret_test", opener=opener)

    complete_job(
        client,
        "job-1",
        "worker-1",
        "mock-llm",
        {"summary": "ok"},
        {"provider": "mock"},
    )
    fail_job(client, "job-2", "worker-1", "boom" * 200)

    assert calls[0] == (
        "https://example.supabase.co/rest/v1/rpc/complete_model_job",
        {
            "p_job_id": "job-1",
            "p_worker_id": "worker-1",
            "p_model_name": "mock-llm",
            "p_structured_output": {"summary": "ok"},
            "p_raw_output": {"provider": "mock"},
        },
    )
    assert calls[1][0] == "https://example.supabase.co/rest/v1/rpc/fail_model_job"
    assert calls[1][1]["p_error"] == ("boom" * 200)[:500]


def test_http_errors_do_not_expose_secret_key():
    secret_key = "sb_secret_sensitive"

    def opener(request, *, timeout):
        raise HTTPError(
            request.full_url,
            403,
            "Forbidden",
            hdrs=None,
            fp=FakeErrorBody(f"permission denied for {secret_key}"),
        )

    client = SupabaseWorkerClient("https://example.supabase.co", secret_key, opener=opener)

    with pytest.raises(SupabaseAPIError) as exc_info:
        claim_next_job(client, "worker-1", 300)

    assert secret_key not in str(exc_info.value)
    assert "[redacted]" in str(exc_info.value)


class FakeErrorBody:
    def __init__(self, body: str):
        self.body = body.encode("utf-8")

    def read(self, _size=-1):
        return self.body

    def close(self):
        pass
