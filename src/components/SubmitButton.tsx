"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  confirm?: string;
  name?: string;
  value?: string;
  formAction?: (fd: FormData) => void | Promise<void>;
};

/** Absende-Button mit Ladezustand und optionaler Sicherheitsabfrage. */
export function SubmitButton({ children, className = "btn", pendingText, confirm, name, value, formAction }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      name={name}
      value={value}
      formAction={formAction}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingText ?? "Bitte warten…" : children}
    </button>
  );
}
