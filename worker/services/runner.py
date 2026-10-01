import os
import time
import traceback

from dotenv import load_dotenv

from worker.adapters.base import LLMFeedbackAdapter, XAIAdapter
from worker.adapters.llm_mock import MockLLMAdapter
from worker.adapters.xai_mock import MockXAIAdapter
from worker.services.database import claim_next_job, complete_job, fail_job, get_connection, get_task_for_job


def build_adapters() -> tuple[LLMFeedbackAdapter, XAIAdapter]:
    provider = os.getenv("MODEL_PROVIDER", "mock")
    if provider != "mock":
        raise RuntimeError("Bu aşamada yalnızca MODEL_PROVIDER=mock desteklenir; gerçek Qwen yüklenmez.")
    return MockLLMAdapter(), MockXAIAdapter()


def process_once(
    worker_id: str,
    llm_adapter: LLMFeedbackAdapter,
    xai_adapter: XAIAdapter,
    lease_seconds: int = 300,
) -> bool:
    with get_connection() as conn:
        job = claim_next_job(conn, worker_id, lease_seconds)
        if not job:
            return False

        try:
            task = get_task_for_job(conn, str(job["task_id"]))
            if job["job_type"] == "llm_feedback":
                result = llm_adapter.evaluate(task["source_text"], task["initial_translation"])
                model_name = llm_adapter.model_name
            elif job["job_type"] == "xai_feedback":
                result = xai_adapter.evaluate(task["source_text"], task["initial_translation"])
                model_name = xai_adapter.model_name
            else:
                raise RuntimeError(f"Desteklenmeyen iş türü: {job['job_type']}")

            complete_job(
                conn,
                str(job["id"]),
                worker_id,
                model_name,
                result.model_dump(mode="json"),
                {"provider": os.getenv("MODEL_PROVIDER", "mock")},
            )
            return True
        except Exception as exc:  # noqa: BLE001 - worker sanitizes before writing.
            fail_job(conn, str(job["id"]), worker_id, f"{type(exc).__name__}: {exc}")
            traceback.print_exc()
            return True


def run_forever() -> None:
    load_dotenv(".env.worker.local")
    load_dotenv(".env.local")
    worker_id = os.getenv("WORKER_ID", "rig-worker-1")
    poll_interval = float(os.getenv("WORKER_POLL_INTERVAL_SECONDS", "2"))
    llm_adapter, xai_adapter = build_adapters()

    while True:
        did_work = process_once(worker_id, llm_adapter, xai_adapter)
        if not did_work:
            time.sleep(poll_interval)
