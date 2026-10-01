import { submitInitialTaskAction } from "@/app/actions";

export function InitialTaskForm({ sessionId, taskNumber }: { sessionId: string; taskNumber: 1 | 2 }) {
  const action = submitInitialTaskAction.bind(null, sessionId, taskNumber);

  return (
    <form action={action} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-800">Türkçe kaynak metin</span>
        <textarea
          className="min-h-40 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          name="sourceText"
          required
          maxLength={6000}
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-800">İngilizce ilk çeviriniz</span>
        <textarea
          className="min-h-40 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          name="initialTranslation"
          required
          maxLength={6000}
        />
      </label>
      <button
        className="justify-self-start rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        type="submit"
      >
        Geri bildirim iste
      </button>
    </form>
  );
}
