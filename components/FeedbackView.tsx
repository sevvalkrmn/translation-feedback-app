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

const issueBorder: Record<Severity, string> = {
  minor: "border-l-yellow-500",
  major: "border-l-orange-500",
  critical: "border-l-red-600"
};

export function FeedbackView({ feedback, initialTranslation }: { feedback: FeedbackRecord; initialTranslation: string }) {
  return <FeedbackContent feedback={feedback.structured_output} initialTranslation={initialTranslation} />;
}

export function FeedbackContent({ feedback, initialTranslation }: { feedback: StructuredFeedback; initialTranslation: string }) {
  if (feedback.method === "llm") {
    return (
      <section aria-labelledby="feedback-heading-llm" className="border-t border-slate-200 pt-6">
        <p className="text-xs font-bold uppercase text-teal-800">İlk metin</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950" id="feedback-heading-llm">Genel geri bildirim</h2>
        <p className="mt-3 max-w-3xl border-l-2 border-teal-600 pl-4 leading-7 text-slate-800">{studentSummary(feedback)}</p>
        <div className="mt-6 grid gap-3">
          {visibleIssues(feedback).map((error, index) => (
            <article className={`min-w-0 rounded-md border border-slate-200 border-l-4 bg-white p-4 ${issueBorder[error.severity]}`} key={`${index}-${error.translation_span}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <strong className="break-words text-slate-950">{error.translation_span}</strong>
                <span className="text-sm text-slate-600">{categoryLabels[error.category]}</span>
                <span className={`rounded-sm px-2 py-1 text-xs font-semibold ${severityClasses[error.severity]}`}>{severityLabels[error.severity]}</span>
              </div>
              <p className="mt-3 text-sm text-slate-600">Kaynak dayanak: {error.source_span}</p>
              {modelSentence(error.explanation) && <p className="mt-2 leading-7 text-slate-800">{modelSentence(error.explanation)}</p>}
              {modelSentence(error.hint) && <p className="mt-3 text-sm leading-6 text-teal-900"><strong>Revizyon ipucu:</strong> {modelSentence(error.hint)}</p>}
            </article>
          ))}
        </div>
      </section>
    );
  }

  const items = visibleIssues(feedback);
  const segments = buildHighlightSegments(initialTranslation, items);
  return (
    <section aria-labelledby="feedback-heading-xai" className="border-t border-slate-200 pt-6">
      <p className="text-xs font-bold uppercase text-teal-800">İkinci metin</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-950" id="feedback-heading-xai">Açıklamalı geri bildirim</h2>
      <p className="mt-3 max-w-3xl border-l-2 border-teal-600 pl-4 leading-7 text-slate-800">{studentSummary(feedback)}</p>
      {items.length > 0 && (
        <div className="mt-5 border-y border-slate-200 bg-slate-50 px-4 py-3 leading-8" aria-label="İşaretlenen çeviri ifadeleri">
          {segments.map((segment, index) => segment.severity ? (
            <mark className={`px-1 ${severityClasses[segment.severity]}`} key={index}
              aria-label={`${severityLabels[segment.severity]} hata`}>{segment.text}</mark>
          ) : <span key={index}>{segment.text}</span>)}
        </div>
      )}
      <div className="mt-6 grid gap-3">
        {items.map((item, index) => {
          const detail = evidenceText(feedback, item);
          return <article className={`min-w-0 rounded-md border border-slate-200 border-l-4 bg-white p-4 ${issueBorder[item.severity]}`} key={`${index}-${item.translation_span}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <strong className="break-words text-slate-950">{item.translation_span}</strong>
              <span className="text-sm text-slate-600">{categoryLabels[item.category]}</span>
              <span className={`rounded-sm px-2 py-1 text-xs font-semibold ${severityClasses[item.severity]}`}>{severityLabels[item.severity]}</span>
            </div>
            <p className="mt-3 text-sm text-slate-600"><strong>Kaynak dayanak:</strong> {item.source_span}</p>
            {detail.sourceMeaning && <p className="mt-2 text-sm text-slate-700"><strong>Kaynak anlam:</strong> {detail.sourceMeaning}</p>}
            {detail.problem && <p className="mt-2 leading-7 text-slate-800"><strong>Saptanan sorun:</strong> {detail.problem}</p>}
            <p className="mt-3 text-sm font-medium leading-6 text-teal-900"><strong>Kontrol sonucu:</strong> {verificationText(item)}</p>
            {modelSentence(item.student_hint) && <p className="mt-3 text-sm leading-6 text-teal-900"><strong>Revizyon ipucu:</strong> {modelSentence(item.student_hint)}</p>}
          </article>;
        })}
      </div>
    </section>
  );
}
