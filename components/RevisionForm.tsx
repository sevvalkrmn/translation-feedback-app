import { submitRevisionAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

export function RevisionForm({ sessionId, taskNumber }: { sessionId: string; taskNumber: 1 | 2 }) {
  const action = submitRevisionAction.bind(null, sessionId, taskNumber);

  return (
    <form action={action} className="grid gap-5 border-t border-slate-200 pt-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Çevirinizi yeniden düzenleyin</h2>
        <p className="mt-1 text-sm text-slate-600">Geri bildirimdeki ipuçlarını kullanarak son çevirinizi yazın.</p>
      </div>
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-800">Düzenlenmiş İngilizce çeviriniz</span>
        <textarea
          className="form-field min-h-44 resize-y"
          name="revisedTranslation"
          required
          maxLength={6000}
        />
      </label>
      <SubmitButton label="Son Çeviriyi Kaydet" pendingLabel="Son çeviriniz kaydediliyor..." variant="teal" />
    </form>
  );
}
