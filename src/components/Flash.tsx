"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function Flash() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const ok = params.get("ok");
  const err = params.get("fehler");
  if (!ok && !err) return null;
  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("ok");
    next.delete("fehler");
    const q = next.toString();
    router.replace(path + (q ? "?" + q : ""), { scroll: false });
  };
  return (
    <div className={`notice flash ${err ? "danger" : "ok"}`} role={err ? "alert" : "status"}>
      <span>{err ?? ok}</span>
      <button type="button" onClick={close} aria-label="Meldung schließen">×</button>
    </div>
  );
}
