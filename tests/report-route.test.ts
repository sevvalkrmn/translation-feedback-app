import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSession, getResult, renderPdf } = vi.hoisted(() => ({
  requireSession: vi.fn(), getResult: vi.fn(), renderPdf: vi.fn()
}));
vi.mock("@/lib/session/access", () => ({ requireSessionWithTasks: requireSession }));
vi.mock("@/lib/supabase/repository", () => ({ getResultBundle: getResult }));
vi.mock("@react-pdf/renderer", () => ({ renderToBuffer: renderPdf }));
vi.mock("@/lib/report/ReportDocument", () => ({ ReportDocument: () => null }));

import { GET } from "@/app/session/[sessionId]/result/report/route";

const context = { params: Promise.resolve({ sessionId: "session-1" }) };

beforeEach(() => {
  requireSession.mockReset().mockResolvedValue({ accessTokenHash: "hash", tasks: [
    { task_number: 1, status: "revised" }, { task_number: 2, status: "revised" }
  ] });
  getResult.mockReset().mockResolvedValue({ session: { id: "session-1" } });
  renderPdf.mockReset().mockResolvedValue(Buffer.from("%PDF-1.7\nmock"));
});

describe("report route", () => {
  it("returns a private, non-cacheable PDF for an authorized completed session", async () => {
    const response = await GET(new Request("http://localhost/report"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.text()).toMatch(/^%PDF/);
    expect(getResult).toHaveBeenCalledWith({ sessionId: "session-1", accessTokenHash: "hash" });
  });

  it("rejects a missing or invalid cookie before reading report data", async () => {
    requireSession.mockRejectedValueOnce(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(GET(new Request("http://localhost/report"), context)).rejects.toThrow("404");
    expect(getResult).not.toHaveBeenCalled();
  });
});
