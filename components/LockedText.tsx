export function LockedText({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-sm font-semibold text-slate-700">{label}</h2>
      <p className="mt-3 whitespace-pre-wrap text-slate-900">{value}</p>
    </section>
  );
}
