import { startSessionAction } from "@/app/actions";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
        Mütercim-Tercümanlık Çalışması
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-950">
        Çeviri geri bildirim oturumuna başlayın
      </h1>
      <p className="mt-4 text-slate-700">
        Bu çalışma iki bölümden oluşur. Lütfen yalnızca adınızı ve soyadınızı girin; oturumunuz
        sistem tarafından güvenli bir erişim tokenı ile oluşturulur.
      </p>

      <form action={startSessionAction} className="mt-8 grid gap-5">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-800">Ad</span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            name="firstName"
            required
            maxLength={80}
            autoComplete="given-name"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-800">Soyad</span>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            name="lastName"
            required
            maxLength={80}
            autoComplete="family-name"
          />
        </label>
        <button
          className="rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          type="submit"
        >
          Oturumu başlat
        </button>
      </form>
    </div>
  );
}
