"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Kopieren" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("ok");
    } catch {
      setState("err");
    }
    setTimeout(() => setState("idle"), 2000);
  };
  return (
    <button type="button" className="btn small" onClick={copy}>
      {state === "ok" ? "Kopiert ✓" : state === "err" ? "Kopieren nicht möglich – bitte markieren" : label}
    </button>
  );
}
