import Link from "next/link";

export default function NotFound() {
  return (
    <div className="border-l-4 border-slate-400 bg-white px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-950">Bu sayfa açılamıyor</h1>
      <p className="mt-3 text-slate-700">
        Bağlantı geçerli olmayabilir ya da bu çalışmaya bu tarayıcıdan artık erişilemiyor olabilir.
      </p>
      <Link className="action-button action-button-secondary mt-6" href="/">
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}
