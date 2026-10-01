import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-950">Sayfa bulunamadı</h1>
      <p className="mt-3 text-slate-700">
        Aradığınız çalışma oturumu bulunamadı veya bu oturuma erişim yetkiniz yok.
      </p>
      <Link className="mt-6 inline-flex text-teal-700 underline" href="/">
        Başlangıca dön
      </Link>
    </div>
  );
}
