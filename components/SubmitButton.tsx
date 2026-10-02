"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ label, pendingLabel, variant = "primary" }: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "teal";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending}
      className={`action-button ${variant === "teal" ? "action-button-teal" : "action-button-primary"} justify-self-start`}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
