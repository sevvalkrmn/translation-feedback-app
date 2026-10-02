"use client";

export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="border-l-4 border-red-600 bg-red-50 px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-950">Bir sorun oluştu</h1>
      <p className="mt-3 text-slate-700">
        Sayfa şu anda açılamıyor. Bir kez daha deneyin; sorun sürerse çalışma sorumlusuna haber verin.
      </p>
      <button
        className="action-button action-button-primary mt-6"
        onClick={() => reset()}
        type="button"
      >
        Sayfayı Yeniden Aç
      </button>
    </div>
  );
}
