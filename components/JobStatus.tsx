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
      <section className="border-l-4 border-red-600 bg-red-50 px-5 py-6" aria-labelledby="feedback-error-heading">
        <h2 className="text-lg font-semibold text-red-950" id="feedback-error-heading">Geri bildirim hazırlanamadı</h2>
        <p className="mt-2 text-sm leading-6 text-red-900">
          Çeviriniz kaydedildi. Geri bildirimi yeniden hazırlamayı deneyebilirsiniz.
        </p>
        <button
          aria-busy={isPending}
          className="action-button action-button-secondary mt-4"
          disabled={isPending}
          onClick={() => startTransition(() => retryJobAction(sessionId, taskNumber))}
          type="button"
        >
          {isPending ? "Yeniden deneniyor..." : "Geri Bildirimi Yeniden Dene"}
        </button>
      </section>
    );
  }

  const heading = status === "queued" ? "Çeviriniz sırada"
    : status === "succeeded" ? "Geri bildiriminiz hazır" : "Çeviriniz inceleniyor";
  const message = status === "queued"
    ? "Geri bildiriminiz hazırlanmak üzere. Bu ekranda kalabilirsiniz."
    : status === "succeeded"
      ? "Geri bildirim ekranı açılıyor."
      : "Çeviriniz inceleniyor. Sonuç hazır olduğunda bu ekran otomatik güncellenecek.";

  return (
    <section className="flex items-start gap-4 border-l-4 border-amber-500 bg-amber-50 px-5 py-6" aria-labelledby="feedback-status-heading">
      <span aria-hidden="true" className="loading-ring mt-1 shrink-0" />
      <div role="status" aria-live="polite" aria-atomic="true">
        <h2 className="text-lg font-semibold text-slate-950" id="feedback-status-heading">{heading}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{message}</p>
      </div>
    </section>
  );
}
