import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieSet, requireSession, notFound, redirect, repositoryCall } = vi.hoisted(() => ({
  cookieSet: vi.fn(), requireSession: vi.fn(), notFound: vi.fn(), redirect: vi.fn(), repositoryCall: vi.fn()
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet }) }));
vi.mock("next/navigation", () => ({
  notFound, redirect, RedirectType: { replace: "replace" }
}));
vi.mock("@/lib/session/access", () => ({
  requireSessionWithTasks: requireSession,
  requireSessionAccess: vi.fn()
}));
vi.mock("@/lib/supabase/repository", () => ({
  createStudentSessionRecord: repositoryCall,
  retryFailedJob: repositoryCall,
  submitInitialTask: repositoryCall,
  submitTaskRevision: repositoryCall
}));

import { finishSessionAction } from "@/app/actions";

beforeEach(() => {
  cookieSet.mockReset();
  requireSession.mockReset();
  notFound.mockReset().mockImplementation(() => { throw new Error("not found"); });
  redirect.mockReset();
  repositoryCall.mockReset();
});

describe("finish session action", () => {
  it("requires a completed session, expires only the scoped cookie and replaces history", async () => {
    requireSession.mockResolvedValue({ session: { status: "completed" }, tasks: [
      { task_number: 1, status: "revised" }, { task_number: 2, status: "revised" }
    ] });
    await finishSessionAction("session-1");
    expect(cookieSet).toHaveBeenCalledTimes(1);
    expect(cookieSet).toHaveBeenCalledWith("tf_session_token", "", expect.objectContaining({
      path: "/session/session-1", maxAge: 0, httpOnly: true, secure: true
    }));
    expect(redirect).toHaveBeenCalledWith("/completed", "replace");
    expect(repositoryCall).not.toHaveBeenCalled();
  });

  it("rejects an unfinished session without clearing its cookie", async () => {
    requireSession.mockResolvedValue({ session: { status: "active" }, tasks: [
      { task_number: 1, status: "revised" }, { task_number: 2, status: "submitted" }
    ] });
    await expect(finishSessionAction("session-1")).rejects.toThrow("not found");
    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("rejects a wrong cookie before any mutation", async () => {
    requireSession.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(finishSessionAction("session-1")).rejects.toThrow("404");
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
