import os
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


@contextmanager
def get_connection() -> Iterator[psycopg.Connection]:
    database_url = os.getenv("WORKER_DATABASE_URL")
    if not database_url:
        raise RuntimeError("WORKER_DATABASE_URL tanımlı değil.")

    with psycopg.connect(database_url, row_factory=dict_row) as conn:
        yield conn


def claim_next_job(conn: psycopg.Connection, worker_id: str, lease_seconds: int) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute("select * from public.claim_next_model_job(%s, %s)", (worker_id, lease_seconds))
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None


def get_task_for_job(conn: psycopg.Connection, task_id: str) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select id, task_number, method, source_text, initial_translation
            from public.translation_tasks
            where id = %s
            """,
            (task_id,),
        )
        row = cur.fetchone()
        if not row:
            raise RuntimeError("İşe bağlı çalışma bulunamadı.")
        return dict(row)


def complete_job(
    conn: psycopg.Connection,
    job_id: str,
    worker_id: str,
    model_name: str,
    structured_output: dict[str, Any],
    raw_output: dict[str, Any] | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "select public.complete_model_job(%s, %s, %s, %s::jsonb, %s::jsonb)",
            (job_id, worker_id, model_name, Jsonb(structured_output), Jsonb(raw_output)),
        )
    conn.commit()


def fail_job(conn: psycopg.Connection, job_id: str, worker_id: str, error: str) -> None:
    with conn.cursor() as cur:
        cur.execute("select public.fail_model_job(%s, %s, %s)", (job_id, worker_id, error[:500]))
    conn.commit()
