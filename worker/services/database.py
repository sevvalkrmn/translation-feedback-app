import json
import os
from contextlib import contextmanager
from dataclasses import dataclass
from json import JSONDecodeError
from typing import Any, Callable, Iterator
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

JsonObject = dict[str, Any]
UrlOpener = Callable[..., Any]


class SupabaseAPIError(RuntimeError):
    """Raised when Supabase HTTPS/RPC access fails without exposing secrets."""


@dataclass(frozen=True)
class SupabaseConfig:
    url: str
    secret_key: str


class SupabaseWorkerClient:
    def __init__(
        self,
        url: str,
        secret_key: str,
        *,
        opener: UrlOpener = urlopen,
        timeout_seconds: int = 30,
    ) -> None:
        self._url = url.rstrip("/")
        self._secret_key = secret_key
        self._opener = opener
        self._timeout_seconds = timeout_seconds

    @classmethod
    def from_env(cls) -> "SupabaseWorkerClient":
        config = load_supabase_config()
        return cls(config.url, config.secret_key)

    def rpc(self, function_name: str, payload: JsonObject) -> Any:
        return self._request("POST", f"rpc/{function_name}", payload=payload)

    def _request(
        self,
        method: str,
        path: str,
        *,
        payload: JsonObject | None = None,
        query: dict[str, str] | None = None,
    ) -> Any:
        request_url = f"{self._url}/rest/v1/{path.lstrip('/')}"
        if query:
            request_url = f"{request_url}?{urlencode(query)}"

        body = None
        headers = {
            "apikey": self._secret_key,
            "Accept": "application/json",
        }
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = Request(request_url, data=body, headers=headers, method=method)
        try:
            with self._opener(request, timeout=self._timeout_seconds) as response:
                raw_body = response.read()
        except HTTPError as exc:
            detail = self._read_safe_error_detail(exc)
            raise SupabaseAPIError(f"Supabase API isteği başarısız oldu (HTTP {exc.code}).{detail}") from exc
        except URLError as exc:
            raise SupabaseAPIError("Supabase API bağlantısı kurulamadı.") from exc

        if not raw_body:
            return None

        try:
            return json.loads(raw_body.decode("utf-8"))
        except JSONDecodeError as exc:
            raise SupabaseAPIError("Supabase API JSON olmayan yanıt döndürdü.") from exc

    def _read_safe_error_detail(self, exc: HTTPError) -> str:
        raw_body = exc.read(1000)
        if not raw_body:
            return ""
        detail = raw_body.decode("utf-8", errors="replace").replace(self._secret_key, "[redacted]")
        return f" Yanıt: {detail[:500]}"


def load_supabase_config() -> SupabaseConfig:
    url = _required_env("SUPABASE_URL")
    secret_key = _required_env("SUPABASE_SECRET_KEY")
    if not url.startswith("https://"):
        raise RuntimeError("SUPABASE_URL geçerli bir HTTPS URL olmalıdır.")
    if not secret_key.startswith("sb_secret_"):
        raise RuntimeError("SUPABASE_SECRET_KEY beklenen secret key formatında değildir.")
    return SupabaseConfig(url=url, secret_key=secret_key)


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} tanımlı değil.")
    return value


@contextmanager
def get_worker_client() -> Iterator[SupabaseWorkerClient]:
    yield SupabaseWorkerClient.from_env()


def claim_next_job(client: SupabaseWorkerClient, worker_id: str, lease_seconds: int) -> JsonObject | None:
    response = client.rpc(
        "claim_next_model_job",
        {
            "p_worker_id": worker_id,
            "p_lease_seconds": lease_seconds,
        },
    )
    if not response:
        return None
    if not isinstance(response, list) or not isinstance(response[0], dict):
        raise SupabaseAPIError("claim_next_model_job beklenmeyen yanıt döndürdü.")
    return response[0]


def get_task_for_job(client: SupabaseWorkerClient, job_id: str, worker_id: str) -> JsonObject:
    response = client.rpc(
        "get_claimed_job_task_payload",
        {
            "p_job_id": job_id,
            "p_worker_id": worker_id,
        },
    )
    if not response:
        raise RuntimeError("İşe bağlı çalışma bulunamadı.")
    if not isinstance(response, list) or not isinstance(response[0], dict):
        raise SupabaseAPIError("get_claimed_job_task_payload beklenmeyen yanıt döndürdü.")
    return response[0]


def complete_job(
    client: SupabaseWorkerClient,
    job_id: str,
    worker_id: str,
    model_name: str,
    structured_output: JsonObject,
    raw_output: JsonObject | None = None,
) -> None:
    client.rpc(
        "complete_model_job",
        {
            "p_job_id": job_id,
            "p_worker_id": worker_id,
            "p_model_name": model_name,
            "p_structured_output": structured_output,
            "p_raw_output": raw_output,
        },
    )


def fail_job(client: SupabaseWorkerClient, job_id: str, worker_id: str, error: str) -> None:
    client.rpc(
        "fail_model_job",
        {
            "p_job_id": job_id,
            "p_worker_id": worker_id,
            "p_error": error[:500],
        },
    )
