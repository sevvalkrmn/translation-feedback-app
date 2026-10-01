import os
import sys
import time

from dotenv import load_dotenv

from worker.adapters.base import LLMFeedbackAdapter, XAIAdapter
from worker.adapters.llm_mock import MockLLMAdapter
from worker.adapters.llm_qwen import QwenLLMAdapter
from worker.adapters.xai_mock import MockXAIAdapter
from worker.adapters.xai_qwen_counterfactual import QwenCounterfactualAdapter
from worker.services.database import claim_next_job, complete_job, fail_job, get_task_for_job, get_worker_client


def build_adapters() -> tuple[LLMFeedbackAdapter, XAIAdapter]:
    llm_provider = os.getenv("LLM_PROVIDER") or os.getenv("MODEL_PROVIDER", "mock")
    xai_provider = os.getenv("XAI_PROVIDER", "mock")

    if xai_provider not in ("mock", "qwen_counterfactual"):
        raise RuntimeError("XAI_PROVIDER yalnızca mock veya qwen_counterfactual olabilir.")

    qwen = None
    if llm_provider == "mock":
        mock_llm = MockLLMAdapter()
        llm_adapter: LLMFeedbackAdapter = mock_llm
    elif llm_provider == "qwen":
        qwen = QwenLLMAdapter(os.getenv("QWEN_MODEL_PATH"))
        llm_adapter = qwen
    else:
        raise RuntimeError("LLM_PROVIDER yalnızca mock veya qwen olabilir.")

    if xai_provider == "mock":
        xai_adapter: XAIAdapter = MockXAIAdapter(mock_llm.engine if llm_provider == "mock" else None)
    else:
        qwen = qwen or QwenLLMAdapter(os.getenv("QWEN_MODEL_PATH"))
        xai_adapter = QwenCounterfactualAdapter(qwen)
    return llm_adapter, xai_adapter


def process_once(
    worker_id: str,
    llm_adapter: LLMFeedbackAdapter,
    xai_adapter: XAIAdapter,
    lease_seconds: int = 300,
) -> bool:
    with get_worker_client() as client:
        job = claim_next_job(client, worker_id, lease_seconds)
        if not job:
            return False

        try:
            task = get_task_for_job(client, str(job["id"]), worker_id)
            if job["job_type"] == "llm_feedback":
                result = llm_adapter.evaluate(task["source_text"], task["initial_translation"])
                model_name = llm_adapter.model_name
                provider = getattr(llm_adapter, "provider", "mock")
            elif job["job_type"] == "xai_feedback":
                result = xai_adapter.evaluate(task["source_text"], task["initial_translation"])
                model_name = xai_adapter.model_name
                provider = getattr(xai_adapter, "provider", "mock")
            else:
                raise RuntimeError(f"Desteklenmeyen iş türü: {job['job_type']}")

            complete_job(
                client,
                str(job["id"]),
                worker_id,
                model_name,
                result.model_dump(mode="json"),
                {"provider": provider},
            )
            return True
        except Exception as exc:  # noqa: BLE001 - worker sanitizes before writing.
            error_type = type(exc).__name__
            fail_job(client, str(job["id"]), worker_id, f"{error_type}: feedback job failed")
            print(f"Feedback job failed: {error_type}", file=sys.stderr)
            return True


def run_forever() -> None:
    load_dotenv(".env.worker.local")
    worker_id = os.getenv("WORKER_ID", "rig-worker-1")
    poll_interval = float(os.getenv("WORKER_POLL_INTERVAL_SECONDS", "2"))
    llm_adapter, xai_adapter = build_adapters()

    while True:
        did_work = process_once(worker_id, llm_adapter, xai_adapter)
        if not did_work:
            time.sleep(poll_interval)
