import type { LLMFeedbackError, LLMFeedbackResult, StructuredFeedback, XaiEvidenceItem, XAIResult } from "@/types/feedback";

export function normalizeModelText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/([.!?])\1+$/u, "$1");
}

export function modelSentence(value: string | null | undefined): string {
  const text = normalizeModelText(value);
  return text && !/[.!?]$/u.test(text) ? `${text}.` : text;
}

export function visibleIssues(feedback: LLMFeedbackResult): LLMFeedbackError[];
export function visibleIssues(feedback: XAIResult): XaiEvidenceItem[];
export function visibleIssues(feedback: StructuredFeedback): LLMFeedbackError[] | XaiEvidenceItem[];
export function visibleIssues(feedback: StructuredFeedback): LLMFeedbackError[] | XaiEvidenceItem[] {
  return feedback.method === "llm" ? feedback.errors.slice(0, 2) : feedback.evidence_items.slice(0, 2);
}

export function studentSummary(feedback: StructuredFeedback): string {
  const count = visibleIssues(feedback).length;
  if (count === 0) {
    return feedback.method === "xai"
      ? "Sistem bu çeviride karşı-olgusal olarak doğrulanmış yüksek etkili bir hata belirleyemedi. Kaynak metindeki anlam, eksiksizlik ve üslup yönlerinden çevirini yeniden kontrol et."
      : "Bu çeviride gösterilecek belirgin bir sorun saptanmadı.";
  }
  return `Çeviride gözden geçirilmesi gereken ${count === 1 ? "bir" : "iki"} ifade belirlendi.`;
}

export function evidenceText(feedback: XAIResult, item: XaiEvidenceItem) {
  const evaluated = feedback.evaluation.errors.find((error) =>
    error.source_span === item.source_span &&
    error.translation_span === item.translation_span &&
    error.category === item.category
  );
  return {
    sourceMeaning: normalizeModelText(item.source_meaning ?? evaluated?.source_meaning),
    problem: modelSentence(item.detected_problem ?? evaluated?.detected_problem ?? item.decision_explanation)
  };
}

export function verificationText(item: XaiEvidenceItem): string {
  if (item.verification.status !== "verified") {
    return "Kontrollü değişiklik testi bu kararı yeterince doğrulayamadı.";
  }
  return item.verification.after_severity === null
    ? "Kontrollü değişiklik testinde hata kararı ortadan kalktı."
    : "Kontrollü değişiklik testinde hatanın önem düzeyi azaldı.";
}
