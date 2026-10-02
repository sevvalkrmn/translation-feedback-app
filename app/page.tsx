import { startSessionAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase text-teal-800">Mütercim-Tercümanlık Çalışması</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-950">Çeviri çalışmasına başlayın</h1>
      <p className="mt-4 max-w-2xl text-slate-700">
        İki farklı Türkçe metni İngilizceye çevirecek, her çeviriden sonra geri bildirim alıp metninizi yeniden düzenleyeceksiniz.
      </p>
      <ol className="mt-7 grid gap-3 border-y border-slate-200 py-5 text-sm text-slate-700 sm:grid-cols-3">
        <li><strong className="text-teal-800">01</strong> İlk metin ve geri bildirim</li>
        <li><strong className="text-teal-800">02</strong> İkinci metin ve geri bildirim</li>
        <li><strong className="text-teal-800">03</strong> Sonuç ve PDF raporu</li>
      </ol>
      <h2 className="mt-8 text-lg font-semibold text-slate-950">Adınızı ve soyadınızı girin</h2>
      <form action={startSessionAction} className="mt-4 grid max-w-xl gap-5">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-800">Ad</span>
          <input
            className="form-field"
            name="firstName"
            required
            maxLength={80}
            autoComplete="given-name"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-800">Soyad</span>
          <input
            className="form-field"
            name="lastName"
            required
            maxLength={80}
            autoComplete="family-name"
          />
        </label>
        <SubmitButton label="Çalışmaya Başla" pendingLabel="Çalışma açılıyor..." />
      </form>
    </div>
  );
}
