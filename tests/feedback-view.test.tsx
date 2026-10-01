import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FeedbackContent } from "@/components/FeedbackView";
import type { StructuredFeedback, TranslationEvaluation } from "@/types/feedback";

const evaluation: TranslationEvaluation = {
  schema_version: "1.0", prompt_version: "translation-evaluation-v1",
  model: "Qwen3.8-27B", language_pair: "tr-en", overall_score: 13,
  dimension_scores: { meaning_accuracy: 13, completeness: 80, grammar_fluency: 80, terminology_register: 80 },
  errors: [], summary: "Çeviri incelendi."
};

function render(feedback: StructuredFeedback) {
  return renderToStaticMarkup(<FeedbackContent feedback={feedback} initialTranslation="She decided hardly." />);
}

describe("student feedback", () => {
  it("renders normal feedback without internal scores", () => {
    const html = render({ method: "llm", summary: "Çeviri incelendi.", evaluation, errors: [
      { source_span: "zorlandı", translation_span: "hardly", category: "fluency", severity: "major",
        explanation: "İfade doğal değil.", hint: "Eylemi düşün." }
    ] });
    expect(html).toContain("Akıcılık");
    expect(html).toContain("Önemli");
    expect(html).toContain("İpucu");
    expect(html).not.toContain("13");
  });

  it("renders evidence and verification without counterfactual answer", () => {
    const html = render({ method: "xai", summary: "Kontrol edildi.", evaluation, evidence_items: [
      { source_span: "zorlandı", translation_span: "hardly", category: "fluency", severity: "major",
        decision_explanation: "Kontrollü değişiklik testinde karar değişti.", student_hint: "Eylemi düşün.",
        verification: { status: "verified", before_severity: "major", after_severity: null,
          relevant_dimension: "grammar_fluency", score_delta: 20, no_new_major_error: true } }
    ] });
    expect(html).toContain("Kaynak dayanak: zorlandı");
    expect(html).toContain("Kontrollü değişiklikle doğrulandı");
    expect(html).toContain("<mark");
    expect(html).not.toContain("with difficulty");
    expect(html).not.toContain(">20<");
  });
});
