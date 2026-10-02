import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSession, getResult, notFound } = vi.hoisted(() => ({
  requireSession: vi.fn(), getResult: vi.fn(), notFound: vi.fn()
}));
vi.mock("@/lib/session/access", () => ({ requireSessionWithTasks: requireSession }));
vi.mock("@/lib/supabase/repository", () => ({ getResultBundle: getResult }));
vi.mock("next/navigation", () => ({
  notFound,
  redirect: vi.fn()
}));
vi.mock("@/components/ResultActions", () => ({
  ResultActions: () => <div data-result-actions="true">PDF Raporunu İndir / Çalışmayı Bitir ve Çıkış Yap</div>
}));
vi.mock("@/components/FeedbackView", () => ({ FeedbackView: () => <div>Geri bildirim</div> }));
vi.mock("@/components/PageHeader", () => ({ PageHeader: () => <h1>Sonuç ve rapor</h1> }));

import ResultPage from "@/app/session/[sessionId]/result/page";
import CompletedPage from "@/app/completed/page";

const tasks = [{ task_number: 1, status: "revised" }, { task_number: 2, status: "revised" }];
const task = { source_text: "Kaynak", initial_translation: "Initial", revised_translation: "Revised" };

beforeEach(() => {
  requireSession.mockReset().mockResolvedValue({
    session: { first_name: "Test", last_name: "Student", status: "completed" },
    accessTokenHash: "hash", tasks
  });
  getResult.mockReset().mockResolvedValue({ task1: task, task2: task, feedback1: {}, feedback2: {} });
  notFound.mockReset().mockImplementation(() => { throw new Error("not found"); });
});

describe("completed result view", () => {
  it("shows actions only for a completed session", async () => {
    const html = renderToStaticMarkup(await ResultPage({ params: Promise.resolve({ sessionId: "session-1" }) }));
    expect(html).toContain("data-result-actions");
    expect(html).toContain("PDF Raporunu İndir");
  });

  it("rejects an unfinished session before reading results", async () => {
    requireSession.mockResolvedValueOnce({ session: { status: "active" }, accessTokenHash: "hash", tasks });
    await expect(ResultPage({ params: Promise.resolve({ sessionId: "session-1" }) })).rejects.toThrow("not found");
    expect(getResult).not.toHaveBeenCalled();
  });

  it("keeps the completion screen free of session data and offers a new start", () => {
    const html = renderToStaticMarkup(<CompletedPage />);
    expect(html).toContain("Çalışmanız tamamlandı.");
    expect(html).toContain("Bu pencereyi güvenle kapatabilirsiniz.");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("session-1");
  });
});
