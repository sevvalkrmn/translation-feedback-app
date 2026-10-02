import { submitInitialTaskAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

export function InitialTaskForm({ sessionId, taskNumber }: { sessionId: string; taskNumber: 1 | 2 }) {
  const action = submitInitialTaskAction.bind(null, sessionId, taskNumber);

  return (
    <form action={action} className="grid gap-6">
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-800">Türkçe kaynak metin</span>
        <span className="text-sm text-slate-600">Size verilen metni değiştirmeden yazın.</span>
        <textarea
          className="form-field min-h-40 resize-y"
          name="sourceText"
          required
          maxLength={6000}
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-800">İngilizce ilk çeviriniz</span>
        <textarea
          className="form-field min-h-40 resize-y"
          name="initialTranslation"
          required
          maxLength={6000}
        />
      </label>
      <SubmitButton label="Çeviriyi Gönder" pendingLabel="Çeviriniz gönderiliyor..." />
    </form>
  );
}
