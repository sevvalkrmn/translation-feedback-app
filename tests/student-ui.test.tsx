// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StudyProgress } from "@/components/StudyProgress";
import { SubmitButton } from "@/components/SubmitButton";

let pending = false;
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, useFormStatus: () => ({ pending }) };
});

afterEach(() => { cleanup(); pending = false; });

describe("student steps and submission states", () => {
  it("names the active step and keeps the seven-step sequence", () => {
    render(<StudyProgress stage={5} />);
    expect(screen.getByText("Adım 5 / 7")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getAllByText("İkinci geri bildirim")).toHaveLength(2);
  });

  it("disables the submit command and shows progress while a form action is pending", () => {
    pending = true;
    render(<form><SubmitButton label="Çeviriyi Gönder" pendingLabel="Çeviriniz gönderiliyor..." /></form>);
    const button = screen.getByRole("button", { name: "Çeviriniz gönderiliyor..." }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("shows the ready command when no submission is in progress", () => {
    render(<form><SubmitButton label="Çeviriyi Gönder" pendingLabel="Çeviriniz gönderiliyor..." /></form>);
    const button = screen.getByRole("button", { name: "Çeviriyi Gönder" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-busy")).toBe("false");
  });
});
