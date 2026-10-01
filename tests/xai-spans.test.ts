import { describe, expect, it } from "vitest";

import { buildHighlightSegments, validateXaiSpan } from "@/lib/report/xai";
import type { XAIError } from "@/types/feedback";

const error: XAIError = {
  target_span: "decided hardly",
  target_start: 4,
  target_end: 18,
  source_span: "karar vermekte zorlandı",
  severity: "major",
  confidence: 0.87,
  category: "word_choice",
  explanation: "Hardly bu bağlama uymuyor.",
  hint: "Have difficulty + V-ing yapısını inceleyin.",
  detector_model: "mock-xai",
  explainer_model: "mock-explainer"
};

describe("xai spans", () => {
  it("validates exact target spans", () => {
    expect(validateXaiSpan("She decided hardly.", error)).toBe(true);
    expect(validateXaiSpan("She decided differently.", error)).toBe(false);
  });

  it("builds colored highlight segments", () => {
    const segments = buildHighlightSegments("She decided hardly.", [error]);
    expect(segments.some((segment) => segment.severity === "major")).toBe(true);
  });
});
