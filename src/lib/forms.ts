import { z } from "zod";
import { METRIC_FIELDS, parseMetric, type MetricField } from "./csv.ts";

export function str(fd: FormData, key: string, max = 20000): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

export function int(fd: FormData, key: string): number | null {
  const v = str(fd, key, 20);
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}

export function ints(fd: FormData, key: string): number[] {
  return fd
    .getAll(key)
    .map((v) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0))
    .filter((n) => n > 0);
}

/** Nur interne, relative Rücksprungziele erlauben. */
export function safeBack(fd: FormData, fallback: string): string {
  const v = str(fd, "back", 500);
  return v.startsWith("/") && !v.startsWith("//") ? v : fallback;
}

export function withFlash(path: string, kind: "ok" | "fehler", msg: string): string {
  const [base, hash] = path.split("#");
  const url = new URL(base, "http://x");
  url.searchParams.delete("ok");
  url.searchParams.delete("fehler");
  url.searchParams.set(kind, msg);
  return url.pathname + url.search + (hash ? "#" + hash : "");
}

export const urlOrEmpty = z
  .string()
  .max(2000)
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Bitte eine vollständige Adresse mit https:// angeben.");

export function metricsFromForm(fd: FormData): { ok: true; values: Record<MetricField, number | null> } | { ok: false; field: MetricField } {
  const values = {} as Record<MetricField, number | null>;
  for (const f of METRIC_FIELDS) {
    const r = parseMetric(str(fd, f, 30), f === "watch_time_seconds");
    if (!r.ok) return { ok: false, field: f };
    values[f] = r.value;
  }
  return { ok: true, values };
}
