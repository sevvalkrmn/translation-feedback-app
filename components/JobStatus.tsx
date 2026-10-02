"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { retryJobAction } from "@/app/actions";
import type { JobStatus as JobStatusValue, ModelJobStatus } from "@/types/feedback";

export function JobStatus({
  sessionId,
  taskNumber,
  initialJob
}: {
  sessionId: string;
  taskNumber: 1 | 2;
  initialJob: ModelJobStatus | null;
}) {
  const router = useRouter();
  const routerRef = useRef(router);
  const [status, setStatus] = useState(initialJob?.status ?? "queued");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    if (initialJob?.status === "failed") {
      return;
    }

    const taskPath = `/session/${sessionId}/task/${taskNumber}`;
    const statusUrl = `/api/session/${sessionId}/task/${taskNumber}/status`;
    const reloadKey = `feedback-reload:${sessionId}:${taskNumber}`;
    let disposed = false;
    let stopped = false;
    let timer: number | undefined;
    let active: AbortController | undefined;
    let requestId = 0;
    let refreshCount = 0;

    function schedule(delay: number) {
      window.clearTimeout(timer);
      if (!disposed && !stopped) {
        timer = window.setTimeout(check, delay);
      }
    }

    function hardReloadOnce() {
      try {
        if (window.sessionStorage.getItem(reloadKey)) {
          return false;
        }
        window.sessionStorage.setItem(reloadKey, "1");
        stopped = true;
        window.location.replace(taskPath);
        return true;
      } catch {
        return false;
      }
    }

    async function check() {
      if (disposed || stopped) return;
      if (document.visibilityState === "hidden") {
        schedule(2500);
        return;
      }
      active?.abort();
      const controller = new AbortController();
      active = controller;
      const current = ++requestId;
      try {
        const response = await fetch(statusUrl, { cache: "no-store", signal: controller.signal });
        if (disposed || current !== requestId) return;
        if (response.status === 404) {
          stopped = true;
          window.location.replace(taskPath);
          return;
        }
        if (!response.ok) return;

        const payload = (await response.json()) as { jobStatus?: JobStatusValue; hasFeedback?: boolean };
        if (disposed || current !== requestId) return;
        if (payload.jobStatus) setStatus(payload.jobStatus);
        if (payload.jobStatus === "failed") {
          stopped = true;
        } else if (payload.jobStatus === "succeeded" && payload.hasFeedback) {
          if (refreshCount >= 2 && hardReloadOnce()) return;
          refreshCount += 1;
          routerRef.current.refresh();
        }
      } catch {
        // A transient network failure is checked again on the next tick.
      } finally {
        if (active === controller) active = undefined;
        if (current === requestId) schedule(2500);
      }
    }

    function onVisible() {
      if (document.visibilityState !== "visible" || disposed || stopped) return;
      window.clearTimeout(timer);
      void check();
    }

    document.addEventListener("visibilitychange", onVisible);
    schedule(initialJob?.status === "succeeded" ? 0 : 2500);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      active?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionId, taskNumber, initialJob?.status]);

  if (status === "failed") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5">
        <h2 className="font-semibold text-red-950">Geri bildirim oluşturulamadı</h2>
        <p className="mt-2 text-sm text-red-900">
          Teknik bir hata oluştu. Geri bildirim işini güvenli biçimde yeniden deneyebilirsiniz.
        </p>
        <button
          className="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white"
          disabled={isPending}
          onClick={() => startTransition(() => retryJobAction(sessionId, taskNumber))}
          type="button"
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <h2 className="font-semibold text-amber-950">Geri bildirim hazırlanıyor</h2>
      <p className="mt-2 text-sm text-amber-900">
        İş sıraya alındı veya worker tarafından işleniyor. Bu sayfa sonucu otomatik kontrol eder.
      </p>
      <p className="mt-3 text-xs uppercase tracking-wide text-amber-800">Durum: {status}</p>
    </div>
  );
}
