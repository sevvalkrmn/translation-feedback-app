import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAccess, getBundle } = vi.hoisted(() => ({
  requireAccess: vi.fn(), getBundle: vi.fn()
}));
vi.mock("@/lib/session/access", () => ({ requireSessionAccess: requireAccess }));
vi.mock("@/lib/supabase/repository", () => ({ getTaskBundle: getBundle }));

import { GET } from "@/app/api/session/[sessionId]/task/[taskNumber]/status/route";

const context = { params: Promise.resolve({ sessionId: "session-1", taskNumber: "1" }) };

beforeEach(() => {
  requireAccess.mockReset().mockResolvedValue({ accessTokenHash: "hash" });
  getBundle.mockReset().mockResolvedValue({ task: { status: "feedback_ready" },
    job: { status: "succeeded" }, feedback: { id: "feedback-1" } });
});

describe("status route", () => {
  it("returns fresh status without exposing feedback or cacheable data", async () => {
    const response = await GET(new Request("http://localhost/api/status"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({ taskStatus: "feedback_ready", jobStatus: "succeeded", hasFeedback: true });
    expect(getBundle).toHaveBeenCalledWith({ sessionId: "session-1", accessTokenHash: "hash", taskNumber: 1 });
  });

  it("does not read the task when session access is denied", async () => {
    requireAccess.mockRejectedValueOnce(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(GET(new Request("http://localhost/api/status"), context)).rejects.toThrow("404");
    expect(getBundle).not.toHaveBeenCalled();
  });
});
