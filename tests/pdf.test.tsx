import { spawnSync } from "node:child_process";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { describe, expect, it } from "vitest";

import { ReportDocument } from "@/lib/report/ReportDocument";
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
        source_text: "Öğrenci çeviriyi dikkatle gözden geçirdi.",
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
          evidence_items: [],
          evaluation: {
            schema_version: "1.0", prompt_version: "translation-evaluation-v1",
            model: "Qwen3.8-27B", language_pair: "tr-en", overall_score: 70,
            dimension_scores: { meaning_accuracy: 70, completeness: 70, grammar_fluency: 70, terminology_register: 70 },
            errors: [], summary: "İfade gözden geçirilmeli."
          }
        }
      }
    };

    const buffer = await renderToBuffer(React.createElement(ReportDocument, { data }) as never);
    expect(buffer.byteLength).toBeGreaterThan(1000);
    const extraction = spawnSync("pdftotext", ["-", "-"], { input: buffer });
    if (!extraction.error) {
      expect(extraction.status).toBe(0);
      const text = extraction.stdout.toString("utf8");
      expect(text).toContain("Bölüm A - Çeviri gelişimi");
      expect(text).toContain("Bölüm B - Geri bildirim ayrıntıları");
      expect(text.indexOf("Bölüm A")).toBeLessThan(text.indexOf("Bölüm B"));
      expect(text).toContain("ğüşİıöç");
    }
  });
});
