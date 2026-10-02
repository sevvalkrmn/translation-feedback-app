const stages = [
  "İlk çeviri",
  "İlk geri bildirim",
  "İlk revizyon",
  "İkinci çeviri",
  "İkinci geri bildirim",
  "İkinci revizyon",
  "Sonuç ve rapor"
] as const;

export type StudyStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function StudyProgress({ stage }: { stage: StudyStage }) {
  return (
    <nav aria-label="Çalışma aşamaları" className="mb-7 border-b border-slate-200 pb-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs font-bold uppercase text-teal-800">Adım {stage} / 7</span>
        <span className="text-sm font-medium text-slate-700">{stages[stage - 1]}</span>
      </div>
      <ol className="mt-3 grid grid-cols-7 gap-1.5" aria-label={`${stage} / 7 adım tamamlanıyor`}>
        {stages.map((name, index) => (
          <li
            aria-current={index + 1 === stage ? "step" : undefined}
            className={`h-1.5 rounded-sm ${index + 1 < stage ? "bg-teal-700" : index + 1 === stage ? "bg-amber-500" : "bg-slate-200"}`}
            key={name}
            title={name}
          >
            <span className="sr-only">{name}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
