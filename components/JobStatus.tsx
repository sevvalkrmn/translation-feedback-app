"use client";

import { useEffect, useState, useTransition } from "react";
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
  const [status, setStatus] = useState(initialJob?.status ?? "queued");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (status === "succeeded" || status === "failed") {
      return;
    }

    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/session/${sessionId}/task/${taskNumber}/status`, {
        cache: "no-store"
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { jobStatus?: JobStatusValue };
      if (payload.jobStatus) {
        setStatus(payload.jobStatus);
      }
      if (payload.jobStatus === "succeeded" || payload.jobStatus === "failed") {
        router.refresh();
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [router, sessionId, status, taskNumber]);

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
