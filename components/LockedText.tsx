export function LockedText({ label, value }: { label: string; value: string }) {
  return (
    <section className="min-w-0 border-l-2 border-teal-700 bg-slate-50 px-4 py-3">
      <h2 className="text-xs font-bold uppercase text-slate-700">{label}</h2>
      <p className="mt-2 whitespace-pre-wrap break-words leading-7 text-slate-900">{value}</p>
    </section>
  );
}
