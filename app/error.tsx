"use client";

export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-950">Bir sorun oluştu</h1>
      <p className="mt-3 text-slate-700">
        İşlem tamamlanamadı. Lütfen tekrar deneyin; sorun sürerse uygulama sorumlusuna bildirin.
      </p>
      <button
        className="mt-6 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
        onClick={() => reset()}
        type="button"
      >
        Tekrar dene
      </button>
    </div>
  );
}
