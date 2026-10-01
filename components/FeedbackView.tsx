import type { FeedbackRecord, LLMFeedbackResult, XAIResult } from "@/types/feedback";
import { buildHighlightSegments } from "@/lib/report/xai";

const severityClasses = {
  minor: "bg-yellow-200 text-yellow-950",
  major: "bg-orange-200 text-orange-950",
  critical: "bg-red-200 text-red-950"
};

export function FeedbackView({
  feedback,
  initialTranslation
}: {
  feedback: FeedbackRecord;
  initialTranslation: string;
}) {
  if (feedback.feedback_type === "xai_feedback") {
    return <XaiFeedback feedback={feedback.structured_output as XAIResult} initialTranslation={initialTranslation} />;
  }
  return <LlmFeedback feedback={feedback.structured_output as LLMFeedbackResult} />;
}

function LlmFeedback({ feedback }: { feedback: LLMFeedbackResult }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Geri bildirim</h2>
      <p className="mt-3 text-slate-800">{feedback.summary}</p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="font-semibold text-slate-900">Güçlü yönler</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            {feedback.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Revizyon önerileri</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            {feedback.revision_guidance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {feedback.errors.map((error) => (
          <article className="rounded-md border border-slate-200 p-4" key={`${error.target_span}-${error.category}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-950">{error.target_span}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{error.category}</span>
              <span className={`rounded-full px-2 py-1 text-xs ${severityClasses[error.severity]}`}>
                {error.severity}
              </span>
            </div>
            <p className="mt-2 text-slate-700">{error.explanation}</p>
            <p className="mt-2 text-sm font-medium text-teal-800">İpucu: {error.hint}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function XaiFeedback({ feedback, initialTranslation }: { feedback: XAIResult; initialTranslation: string }) {
  const segments = buildHighlightSegments(initialTranslation, feedback.errors);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Geri bildirim</h2>
      <p className="mt-3 text-slate-800">{feedback.summary}</p>

      <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 leading-8">
        {segments.map((segment, index) =>
          segment.severity ? (
            <mark className={`rounded px-1 ${severityClasses[segment.severity]}`} key={`${segment.text}-${index}`}>
              {segment.text}
            </mark>
          ) : (
            <span key={`${segment.text}-${index}`}>{segment.text}</span>
          )
        )}
      </div>

      <div className="mt-5 grid gap-3">
        {feedback.errors.map((error) => (
          <article className="rounded-md border border-slate-200 p-4" key={`${error.target_start}-${error.target_end}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-950">{error.target_span}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{error.category}</span>
              <span className={`rounded-full px-2 py-1 text-xs ${severityClasses[error.severity]}`}>
                {error.severity}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">Kaynak bölüm: {error.source_span}</p>
            <p className="mt-2 text-slate-700">{error.explanation}</p>
            <p className="mt-2 text-sm font-medium text-teal-800">İpucu: {error.hint}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
