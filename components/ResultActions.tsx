"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { finishSessionAction } from "@/app/actions";

export function ResultActions({ sessionId }: { sessionId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  function openDialog() {
    setError(false);
    dialogRef.current?.showModal();
    cancelButtonRef.current?.focus();
  }

  async function confirmFinish() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    setError(false);
    try {
      await finishSessionAction(sessionId);
    } catch {
      submittingRef.current = false;
      setPending(false);
      setError(true);
    }
  }

  return (
    <div className="mb-8 flex flex-col gap-3 border-b border-slate-200 pb-7 sm:flex-row sm:items-center">
      <Link
        className="action-button action-button-primary w-full sm:w-auto"
        href={`/session/${sessionId}/result/report`}
        prefetch={false}
      >
        PDF Raporunu İndir
      </Link>
      <button
        className="action-button action-button-secondary w-full sm:w-auto"
        onClick={openDialog}
        ref={openButtonRef}
        type="button"
      >
        Çalışmayı Bitir ve Çıkış Yap
      </button>

      <dialog
        aria-describedby="finish-warning"
        aria-labelledby="finish-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-md border border-slate-300 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/60"
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClose={() => openButtonRef.current?.focus()}
        ref={dialogRef}
      >
        <h2 className="text-lg font-semibold" id="finish-title">Çalışmayı bitir</h2>
        <p className="mt-3 text-sm leading-6" id="finish-warning">
          Çalışmayı bitirdiğinizde bu tarayıcıdan sonuçlarınıza ve raporunuza tekrar erişemezsiniz. PDF raporunuzu indirdiğinizden emin olun.
        </p>
        {error && <p className="mt-3 text-sm text-red-700" role="alert">İşlem tamamlanamadı. Lütfen tekrar deneyin.</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            className="action-button action-button-secondary"
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
            ref={cancelButtonRef}
            type="button"
          >
            Vazgeç
          </button>
          <button
            aria-busy={pending}
            className="action-button action-button-primary"
            disabled={pending}
            onClick={() => void confirmFinish()}
            type="button"
          >
            {pending ? "Bitiriliyor..." : "Çalışmayı Bitir"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
