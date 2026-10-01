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
        access_token_hash: "hash",
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
          summary: "Türkçe karakterler: ğüşİıöç",
          strengths: ["Anlam korunmuş."],
          errors: [],
          revision_guidance: ["Akıcılığı güçlendirin."]
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
          overall_score: 0.74,
          summary: "İfade gözden geçirilmeli.",
          errors: []
        }
      }
    };

    const buffer = await renderToBuffer(React.createElement(ReportDocument, { data }) as never);
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
