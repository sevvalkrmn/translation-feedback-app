import Link from "next/link";

export default function CompletedPage() {
  return (
    <section className="mx-auto max-w-xl border-t-4 border-teal-700 py-10">
      <h1 className="text-2xl font-semibold text-slate-950">Çalışmanız tamamlandı.</h1>
      <p className="mt-3 leading-7 text-slate-700">Bu pencereyi güvenle kapatabilirsiniz.</p>
      <Link className="action-button action-button-secondary mt-7" href="/">
        Ana Sayfaya Dön
      </Link>
    </section>
  );
}
