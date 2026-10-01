import { describe, expect, it } from "vitest";

import { canEditInitialTask, canOpenResult, canOpenTask, canSubmitRevision } from "@/lib/workflow/rules";
import type { TranslationTask } from "@/types/feedback";

function task(partial: Partial<TranslationTask>): TranslationTask {
  return {
    id: crypto.randomUUID(),
    session_id: crypto.randomUUID(),
    task_number: 1,
    method: "llm",
    source_text: "Kaynak metin",
    initial_translation: "Initial translation",
    revised_translation: null,
    status: "submitted",
    created_at: new Date().toISOString(),
    submitted_at: new Date().toISOString(),
    revised_at: null,
    ...partial
  };
}

describe("workflow rules", () => {
  it("allows task 1 before anything else", () => {
    expect(canOpenTask(1, [])).toBe(true);
  });

  it("blocks task 2 until task 1 is revised", () => {
    expect(canOpenTask(2, [task({ task_number: 1, status: "feedback_ready" })])).toBe(false);
    expect(canOpenTask(2, [task({ task_number: 1, status: "revised", revised_translation: "Revised" })])).toBe(true);
  });

  it("blocks result until both tasks are revised", () => {
    expect(canOpenResult([task({ task_number: 1, status: "revised" })])).toBe(false);
    expect(
      canOpenResult([
        task({ task_number: 1, status: "revised", revised_translation: "One" }),
        task({ task_number: 2, method: "xai", status: "revised", revised_translation: "Two" })
      ])
    ).toBe(true);
  });

  it("does not allow the initial translation to be changed after submission", () => {
    expect(canEditInitialTask(null)).toBe(true);
    expect(canEditInitialTask(task({ status: "submitted" }))).toBe(false);
    expect(canSubmitRevision(task({ status: "feedback_ready" }))).toBe(true);
  });
});
