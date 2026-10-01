import { describe, expect, it } from "vitest";

import { buildHighlightSegments, validateXaiSpan } from "@/lib/report/xai";
import type { XaiEvidenceItem } from "@/types/feedback";

const item: XaiEvidenceItem = {
  source_span: "karar vermekte", translation_span: "decided hardly",
  severity: "major", category: "fluency", decision_explanation: "İfade doğal değil.",
  student_hint: "Eylemi yeniden düşün.",
  verification: { status: "verified", before_severity: "major", after_severity: null,
    relevant_dimension: "grammar_fluency", score_delta: 10, no_new_major_error: true }
};

describe("xai spans", () => {
  it("highlights an exact span including Turkish and emoji context", () => {
    const text = "🙂 She decided hardly. Çağrı";
    expect(validateXaiSpan(text, item.translation_span)).toBe(true);
    expect(buildHighlightSegments(text, [item]).some((part) => part.severity === "major")).toBe(true);
  });

  it("falls back safely for missing, repeated and overlapping spans", () => {
    expect(buildHighlightSegments("She decided differently.", [item])).toEqual([{ text: "She decided differently." }]);
    expect(buildHighlightSegments("decided hardly decided hardly", [item])).toEqual([
      { text: "decided hardly decided hardly" }
    ]);
    const overlap = { ...item, translation_span: "hardly" };
    expect(buildHighlightSegments("She decided hardly.", [item, overlap]).filter((part) => part.severity)).toHaveLength(1);
  });
});
