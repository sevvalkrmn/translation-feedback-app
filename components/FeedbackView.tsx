import type { ErrorCategory, FeedbackRecord, Severity, StructuredFeedback } from "@/types/feedback";
import { buildHighlightSegments } from "@/lib/report/xai";
import { evidenceText, modelSentence, studentSummary, verificationText, visibleIssues } from "@/lib/feedback/presentation";

const severityClasses: Record<Severity, string> = {
  minor: "bg-yellow-200 text-yellow-950",
  major: "bg-orange-200 text-orange-950",
  critical: "bg-red-200 text-red-950"
};
const severityLabels: Record<Severity, string> = {
  minor: "Düşük önem", major: "Önemli", critical: "Kritik"
};
const categoryLabels: Record<ErrorCategory, string> = {
  meaning_shift: "Anlam kayması", omission: "Eksik bilgi", addition: "Eklenen bilgi",
  terminology: "Terminoloji", grammar: "Dil bilgisi", fluency: "Akıcılık",
  register_style: "Üslup", cohesion: "Bağlaşıklık"
};

export function FeedbackView({ feedback, initialTranslation }: { feedback: FeedbackRecord; initialTranslation: string }) {
  return <FeedbackContent feedback={feedback.structured_output} initialTranslation={initialTranslation} />;
}

export function FeedbackContent({ feedback, initialTranslation }: { feedback: StructuredFeedback; initialTranslation: string }) {
  if (feedback.method === "llm") {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">Geri bildirim</h2>
        <p className="mt-3 text-slate-800">{studentSummary(feedback)}</p>
        <div className="mt-5 grid gap-3">
          {visibleIssues(feedback).map((error, index) => (
            <article className="rounded-md border border-slate-200 p-4" key={`${index}-${error.translation_span}`}>
              <div className="flex flex-wrap items-center gap-2">
                <strong>{error.translation_span}</strong>
                <span>{categoryLabels[error.category]}</span>
                <span className={`px-2 py-1 text-xs ${severityClasses[error.severity]}`}>{severityLabels[error.severity]}</span>
              </div>
              {modelSentence(error.explanation) && <p className="mt-2 text-slate-700">{modelSentence(error.explanation)}</p>}
              {modelSentence(error.hint) && <p className="mt-2 text-sm text-teal-800">İpucu: {modelSentence(error.hint)}</p>}
            </article>
          ))}
        </div>
      </section>
    );
  }

  const items = visibleIssues(feedback);
  const segments = buildHighlightSegments(initialTranslation, items);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Geri bildirim</h2>
      <p className="mt-3 text-slate-800">{studentSummary(feedback)}</p>
      {items.length > 0 && (
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 leading-8" aria-label="İşaretlenen çeviri ifadeleri">
          {segments.map((segment, index) => segment.severity ? (
            <mark className={`px-1 ${severityClasses[segment.severity]}`} key={index}
              aria-label={`${severityLabels[segment.severity]} hata`}>{segment.text}</mark>
          ) : <span key={index}>{segment.text}</span>)}
        </div>
      )}
      <div className="mt-5 grid gap-3">
        {items.map((item, index) => {
          const detail = evidenceText(feedback, item);
          return <article className="rounded-md border border-slate-200 p-4" key={`${index}-${item.translation_span}`}>
            <div className="flex flex-wrap items-center gap-2">
              <strong>{item.translation_span}</strong>
              <span>{categoryLabels[item.category]}</span>
              <span className={`px-2 py-1 text-xs ${severityClasses[item.severity]}`}>{severityLabels[item.severity]}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">Kaynak dayanak: {item.source_span}</p>
            {detail.sourceMeaning && <p className="mt-2 text-sm text-slate-700">Kaynak anlam: {detail.sourceMeaning}</p>}
            {detail.problem && <p className="mt-2 text-slate-700">Saptanan sorun: {detail.problem}</p>}
            <p className="mt-2 text-sm font-medium text-teal-800">{verificationText(item)}</p>
            {modelSentence(item.student_hint) && <p className="mt-2 text-sm text-teal-800">İpucu: {modelSentence(item.student_hint)}</p>}
          </article>;
        })}
      </div>
    </section>
  );
}
