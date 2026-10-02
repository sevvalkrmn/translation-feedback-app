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
    expect(html).toContain("bir ifade belirlendi");
    expect(html).toContain("Revizyon ipucu:");
    expect(html).not.toContain("13");
  });

  it("renders evidence and verification without counterfactual answer", () => {
    const html = render({ method: "xai", summary: "Kontrol edildi.", evaluation, evidence_items: [
      { source_span: "zorlandı", translation_span: "hardly", category: "fluency", severity: "major",
        decision_explanation: "Kontrollü değişiklik testinde karar değişti.", student_hint: "Eylemi düşün.",
        verification: { status: "verified", before_severity: "major", after_severity: null,
          relevant_dimension: "grammar_fluency", score_delta: 20, no_new_major_error: true } }
    ] });
    expect(html).toContain("<strong>Kaynak dayanak:</strong> zorlandı");
    expect(html).toContain("Kontrollü değişiklik testinde hata kararı ortadan kalktı.");
    expect(html).toContain("<mark");
    expect(html).not.toContain("with difficulty");
    expect(html).not.toContain(">20<");
  });

  it("does not render a hidden error from a legacy free-form summary", () => {
    const html = render({ method: "llm", summary: "Üçüncü omission hatası da var.", evaluation, errors: [
      { source_span: "zorlandı", translation_span: "hardly", category: "fluency", severity: "major",
        explanation: "Doğal değil..", hint: "Eylemi düşün." }
    ] });
    expect(html).toContain("bir ifade belirlendi");
    expect(html).not.toContain("Üçüncü omission");
    expect(html).not.toContain("değil..");
  });

  it("shows separate XAI fields, normalized punctuation, and reduced severity", () => {
    const html = render({ method: "xai", summary: "Kritik noktalar var.", evaluation: {
      ...evaluation,
      errors: [{ id: "error_1", source_span: "zorlandı", translation_span: "hardly",
        category: "fluency", severity: "major", source_meaning: "Güçlükle..",
        detected_problem: "Doğal ifade değil..", student_hint: "Yapıyı düşün." }]
    }, evidence_items: [
      { source_span: "zorlandı", translation_span: "hardly", category: "fluency", severity: "major",
        decision_explanation: "Kaynakta ifade Güçlükle..", student_hint: "Yapıyı düşün..",
        verification: { status: "verified", before_severity: "major", after_severity: "minor",
          relevant_dimension: "grammar_fluency", score_delta: 2, no_new_major_error: true } }
    ] });
    expect(html).toContain("<strong>Kaynak anlam:</strong> Güçlükle.");
    expect(html).toContain("<strong>Saptanan sorun:</strong> Doğal ifade değil.");
    expect(html).toContain("hatanın önem düzeyi azaldı");
    expect(html).not.toContain("Kritik noktalar");
    expect(html).not.toContain("Güçlükle..");
  });

  it("escapes model-supplied HTML and hides internal evaluation fields", () => {
    const html = render({ method: "xai", summary: "secret score 13", evaluation: {
      ...evaluation,
      errors: [{ id: "error_1", source_span: "zorlandı", translation_span: "hardly",
        category: "fluency", severity: "major", source_meaning: "Güçlükle",
        detected_problem: "<img src=x onerror=alert(1)>", student_hint: "Düşün." }]
    }, evidence_items: [{ source_span: "zorlandı", translation_span: "hardly", category: "fluency", severity: "major",
      decision_explanation: "Eski alan", student_hint: "Düşün.",
      verification: { status: "inconclusive", before_severity: "major", after_severity: "major",
        relevant_dimension: "grammar_fluency", score_delta: 13, no_new_major_error: false } }] });
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("secret score");
    expect(html).not.toContain("score_delta");
    expect(html).not.toContain("critical_evidence");
    expect(html).toContain("yeterince doğrulayamadı");
  });
});
