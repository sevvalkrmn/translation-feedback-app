import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { renderReport } from "@/lib/report/render";
import type { ResultBundle } from "@/types/feedback";

describe("PDF report", () => {
  it("renders Turkish characters into a non-empty PDF", async () => {
    const now = new Date().toISOString();
    const data: ResultBundle = {
      session: {
        id: crypto.randomUUID(),
        first_name: "Çağla",
        last_name: "Şimşek",
        status: "completed",
        created_at: now,
        completed_at: now
      },
      task1: {
        id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        task_number: 1,
        method: "llm",
        source_text: "Öğrenci çeviriyi dikkatle gözden geçirdi. ğüşİıöç",
        initial_translation: "The student reviewed the translation.",
        revised_translation: "The student carefully reviewed the translation.",
        status: "revised",
        created_at: now,
        submitted_at: now,
        revised_at: now
      },
      task2: {
        id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        task_number: 2,
        method: "xai",
        source_text: "Karar vermekte zorlandı.",
        initial_translation: "She decided hardly.",
        revised_translation: "She had difficulty deciding.",
        status: "revised",
        created_at: now,
        submitted_at: now,
        revised_at: now
      },
      feedback1: {
        id: crypto.randomUUID(),
        task_id: crypto.randomUUID(),
        feedback_type: "llm_feedback",
        model_name: "mock",
        created_at: now,
        raw_output: {},
        structured_output: {
          method: "llm",
          summary: "Türkçe karakterler: ğüşİıöç",
          errors: [],
          evaluation: {
            schema_version: "1.0", prompt_version: "translation-evaluation-v1",
            model: "Qwen3.8-27B", language_pair: "tr-en", overall_score: 80,
            dimension_scores: { meaning_accuracy: 80, completeness: 80, grammar_fluency: 80, terminology_register: 80 },
            errors: [], summary: "Türkçe karakterler: ğüşİıöç"
          }
        }
      },
      feedback2: {
        id: crypto.randomUUID(),
        task_id: crypto.randomUUID(),
        feedback_type: "xai_feedback",
        model_name: "mock",
        created_at: now,
        raw_output: {},
        structured_output: {
          method: "xai",
          summary: "İfade gözden geçirilmeli.",
          evidence_items: [{
            source_span: "zorlandı", translation_span: "hardly", category: "fluency", severity: "major",
            decision_explanation: "Bozuk eski açıklama..", student_hint: "Yapıyı düşün..",
            verification: { status: "verified", before_severity: "major", after_severity: null,
              relevant_dimension: "grammar_fluency", score_delta: 5, no_new_major_error: true }
          }],
          evaluation: {
            schema_version: "1.0", prompt_version: "translation-evaluation-v1",
            model: "Qwen3.8-27B", language_pair: "tr-en", overall_score: 70,
            dimension_scores: { meaning_accuracy: 70, completeness: 70, grammar_fluency: 70, terminology_register: 70 },
            errors: [{ id: "error_1", source_span: "zorlandı", translation_span: "hardly",
              category: "fluency", severity: "major", source_meaning: "Güçlükle..",
              detected_problem: "Doğal değil..", student_hint: "Yapıyı düşün." }],
            summary: "İfade gözden geçirilmeli."
          }
        }
      }
    };

    const longText = Array.from({ length: 30 }, (_, index) => `Uzun metin bölümü ${index + 1}.`).join(" ");
    const longData = {
      ...data,
      task1: { ...data.task1, source_text: `${longText} SON_KAYNAK`, initial_translation: `${longText} SON_ILK`, revised_translation: `${longText} SON_REVIZE` }
    } satisfies ResultBundle;
    const longBuffer = await renderReport(longData);
    const longExtraction = spawnSync("pdftotext", ["-", "-"], { input: longBuffer });
    if (!longExtraction.error) {
      const longOutput = longExtraction.stdout.toString("utf8");
      expect(longOutput).toContain("SON_KAYNAK");
      expect(longOutput).toContain("SON_ILK");
      expect(longOutput).toContain("SON_REVIZE");
      expect(longOutput.indexOf("Bölüm A")).toBeLessThan(longOutput.indexOf("Bölüm B"));
    }

    const buffer = await renderReport(data);
    expect(buffer.byteLength).toBeGreaterThan(1000);
    const extraction = spawnSync("pdftotext", ["-", "-"], { input: buffer });
    if (!extraction.error) {
      expect(extraction.status).toBe(0);
      const text = extraction.stdout.toString("utf8");
      expect(text).toContain("Bölüm A - Çeviri gelişimi");
      expect(text).toContain("Bölüm B - Geri bildirim ayrıntıları");
      expect(text.indexOf("Bölüm A")).toBeLessThan(text.indexOf("Bölüm B"));
      expect(text).toContain("ğüşİıöç");
      expect(text).not.toContain("Türkçe karakterler: ğüşİıöç");
      expect(text).not.toContain("PDF Raporunu İndir");
      expect(text).not.toContain("Çalışmayı Bitir");
      expect(text).toMatch(/Kaynak anlam\s+Güçlükle\./u);
      expect(text).toMatch(/Saptanan sorun\s+Doğal değil\./u);
      expect(text).toContain("hata kararı ortadan kalktı");
      expect(text).not.toContain("Bozuk eski açıklama");
      expect(text).not.toContain("Doğal değil..");
      expect(text).toContain("İlk metin");
      expect(text).toContain("İkinci metin");
      expect(text).toContain("Revize İngilizce çeviri");
      expect(text).toContain("Prompt / şema sürümü");
      expect(text).not.toContain("Bitiriliyor");
    }

    const repeatedBuffer = await renderReport(longData);
    const repeatedOutput = spawnSync("pdftotext", ["-", "-"], { input: repeatedBuffer });
    if (!repeatedOutput.error) expect(repeatedOutput.stdout.toString("utf8")).toContain("SON_KAYNAK");


  });
});
