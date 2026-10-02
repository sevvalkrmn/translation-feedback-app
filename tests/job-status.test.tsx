// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JobStatus } from "@/components/JobStatus";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/actions", () => ({ retryJobAction: vi.fn() }));

function statusResponse(jobStatus: string, hasFeedback = false) {
  return { ok: true, status: 200, json: async () => ({ jobStatus, hasFeedback }) };
}

async function tick() {
  await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
}

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockReset();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("job status polling", () => {
  it("refreshes when processing becomes succeeded and keeps polling until feedback renders", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(statusResponse("processing"))
      .mockResolvedValue(statusResponse("succeeded", true));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<JobStatus sessionId="session-1" taskNumber={1} initialJob={{ status: "processing" }} />);
    expect(vi.getTimerCount()).toBe(1);
    await tick();
    expect(refresh).not.toHaveBeenCalled();
    await tick();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("continues after a transient fetch failure without parallel timers", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue(statusResponse("processing"));
    vi.stubGlobal("fetch", fetchMock);
    render(<JobStatus sessionId="session-1" taskNumber={2} initialJob={{ status: "queued" }} />);
    await tick();
    expect(vi.getTimerCount()).toBe(1);
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("aborts an in-flight request on unmount", async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<JobStatus sessionId="session-1" taskNumber={1} initialJob={{ status: "processing" }} />);
    await tick();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("checks immediately when the tab becomes visible and ignores the old response", async () => {
    let resolveOld: (value: ReturnType<typeof statusResponse>) => void = () => undefined;
    const old = new Promise<ReturnType<typeof statusResponse>>((resolve) => { resolveOld = resolve; });
    const fetchMock = vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce(statusResponse("processing"));
    vi.stubGlobal("fetch", fetchMock);
    render(<JobStatus sessionId="session-1" taskNumber={1} initialJob={{ status: "processing" }} />);
    await tick();
    const firstSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    await act(async () => { fireEvent(document, new Event("visibilitychange")); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstSignal.aborted).toBe(true);
    await act(async () => { resolveOld(statusResponse("failed")); });
    expect(screen.queryByText("Geri bildirim hazırlanamadı")).toBeNull();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("shows the safe failure view and stops polling", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(statusResponse("failed")));
    render(<JobStatus sessionId="session-1" taskNumber={1} initialJob={{ status: "processing" }} />);
    await tick();
    expect(screen.getByText("Geri bildirim hazırlanamadı")).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("explains queued and processing states without technical terms or repeated spinner announcements", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(statusResponse("processing")));
    render(<JobStatus sessionId="session-1" taskNumber={1} initialJob={{ status: "queued" }} />);
    expect(screen.getByText("Çeviriniz sırada")).toBeTruthy();
    expect(document.querySelector(".loading-ring")?.getAttribute("aria-hidden")).toBe("true");
    await tick();
    expect(screen.getByText("Çeviriniz inceleniyor. Sonuç hazır olduğunda bu ekran otomatik güncellenecek.")).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });
});
