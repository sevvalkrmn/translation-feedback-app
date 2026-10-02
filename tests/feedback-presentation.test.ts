import { describe, expect, it } from "vitest";

import { evidenceText, modelSentence, studentSummary, verificationText, visibleIssues } from "@/lib/feedback/presentation";
import type { LLMFeedbackResult, XAIResult } from "@/types/feedback";

const evaluation: LLMFeedbackResult["evaluation"] = {
  schema_version: "1.0", prompt_version: "translation-evaluation-v1.1",
  model: "Qwen3.8-27B", language_pair: "tr-en", overall_score: 70,
  dimension_scores: { meaning_accuracy: 70, completeness: 70, grammar_fluency: 70, terminology_register: 70 },
  summary: "Gizli üçüncü omission hatası.", errors: []
};

describe("student-facing feedback presentation", () => {
  it("limits three legacy errors to two without repeating the free-form summary", () => {
    const issue = { source_span: "kaynak", translation_span: "word", category: "meaning_shift" as const,
      severity: "major" as const, explanation: "Yanlış anlam..", hint: "Yeniden düşün." };
    const feedback: LLMFeedbackResult = { method: "llm", evaluation, summary: evaluation.summary,
      errors: [issue, issue, { ...issue, explanation: "Gizli üçüncü omission hatası." }] };
    expect(visibleIssues(feedback)).toHaveLength(2);
    expect(studentSummary(feedback)).toBe("Çeviride gözden geçirilmesi gereken iki ifade belirlendi.");
    expect(studentSummary(feedback)).not.toContain("omission");
    expect(studentSummary(feedback)).not.toContain("kritik");
  });

  it("normalizes trailing punctuation without inventing text", () => {
    expect(modelSentence("  Doğal değil..  ")).toBe("Doğal değil.");
    expect(modelSentence("  ")).toBe("");
    expect(modelSentence("Dikkat et!" )).toBe("Dikkat et!");
  });

  it("uses structured evidence for source meaning and verification outcome", () => {
    const item: XAIResult["evidence_items"][number] = {
      source_span: "geçici", translation_span: "cancel", category: "meaning_shift", severity: "major",
      decision_explanation: "Bozuk eski açıklama..", student_hint: "Düşün.",
      verification: { status: "verified", before_severity: "major", after_severity: null,
        relevant_dimension: "meaning_accuracy", score_delta: 10, no_new_major_error: true }
    };
    const feedback: XAIResult = { method: "xai", summary: "kritik noktalar", evidence_items: [item],
      evaluation: { ...evaluation, errors: [{ id: "error_1", source_span: "geçici", translation_span: "cancel",
        category: "meaning_shift", severity: "major", source_meaning: "Geçici süreliğine..",
        detected_problem: "Kalıcılık aktarılmış..", student_hint: "Düşün." }] } };
    expect(evidenceText(feedback, item)).toEqual({ sourceMeaning: "Geçici süreliğine.", problem: "Kalıcılık aktarılmış." });
    expect(verificationText(item)).toBe("Kontrollü değişiklik testinde hata kararı ortadan kalktı.");
    expect(verificationText({ ...item, verification: { ...item.verification, after_severity: "minor" } }))
      .toBe("Kontrollü değişiklik testinde hatanın önem düzeyi azaldı.");
    expect(verificationText({ ...item, verification: { ...item.verification, status: "inconclusive" } }))
      .toBe("Kontrollü değişiklik testi bu kararı yeterince doğrulayamadı.");
    expect(studentSummary(feedback)).not.toContain("kritik");
  });
});
