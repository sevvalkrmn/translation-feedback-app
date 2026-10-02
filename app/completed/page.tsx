import Link from "next/link";

export default function CompletedPage() {
  return (
    <section className="mx-auto max-w-xl py-12">
      <h1 className="text-2xl font-semibold text-slate-950">Çalışmanız tamamlandı.</h1>
      <p className="mt-3 text-slate-700">Bu pencereyi güvenle kapatabilirsiniz.</p>
      <Link className="mt-6 inline-block text-sm font-semibold text-teal-800 underline" href="/">
        Ana sayfaya dön
      </Link>
    </section>
  );
}
