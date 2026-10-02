// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResultActions } from "@/components/ResultActions";

const { finish } = vi.hoisted(() => ({ finish: vi.fn() }));
vi.mock("@/app/actions", () => ({ finishSessionAction: finish }));

beforeEach(() => {
  finish.mockReset();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); }
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    }
  });
});

afterEach(() => cleanup());

describe("result actions", () => {
  it("keeps the PDF link and shows the accessible confirmation only after opening", () => {
    render(<ResultActions sessionId="session-1" />);
    const pdf = screen.getByRole("link", { name: "PDF Raporunu İndir" });
    expect(pdf.getAttribute("href")).toBe("/session/session-1/result/report");
    expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("open")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Çalışmayı Bitir ve Çıkış Yap" }));
    expect(screen.getByRole("dialog").getAttribute("aria-describedby")).toBe("finish-warning");
    expect(screen.getByText(/PDF raporunuzu indirdiğinizden emin olun/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Vazgeç" }));
  });

  it("cancels without calling the action and restores focus", () => {
    render(<ResultActions sessionId="session-1" />);
    const open = screen.getByRole("button", { name: "Çalışmayı Bitir ve Çıkış Yap" });
    fireEvent.click(open);
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(finish).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(open);
  });

  it("sends only one POST-backed action while pending", async () => {
    finish.mockImplementation(() => new Promise(() => undefined));
    render(<ResultActions sessionId="session-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Çalışmayı Bitir ve Çıkış Yap" }));
    const confirm = screen.getByRole("button", { name: "Çalışmayı Bitir" });
    await act(async () => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith("session-1");
    expect(screen.getByRole("button", { name: "Bitiriliyor..." }).hasAttribute("disabled")).toBe(true);
  });
});
