import { submitRevisionAction } from "@/app/actions";

export function RevisionForm({ sessionId, taskNumber }: { sessionId: string; taskNumber: 1 | 2 }) {
  const action = submitRevisionAction.bind(null, sessionId, taskNumber);

  return (
    <form action={action} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-800">Geri bildirim sonrası İngilizce çeviriniz</span>
        <textarea
          className="min-h-44 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          name="revisedTranslation"
          required
          maxLength={6000}
        />
      </label>
      <button
        className="justify-self-start rounded-md bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
        type="submit"
      >
        Son çeviriyi kaydet
      </button>
    </form>
  );
}
