// Zeitfunktionen für Europe/Berlin. Gespeichert wird immer UTC (ISO-8601),
// angezeigt und eingegeben wird Berliner Ortszeit.

export const TZ = "Europe/Berlin";

function berlinOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wandelt Berliner Ortszeit (Jahr, Monat 1–12, …) in einen UTC-ISO-String. */
export function berlinPartsToUtc(y: number, mo: number, d: number, h = 0, mi = 0): string | null {
  if (![y, mo, d, h, mi].every(Number.isFinite)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(guess);
  if (check.getUTCDate() !== d || check.getUTCMonth() !== mo - 1) return null;
  let utc = guess - berlinOffsetMs(guess);
  utc = guess - berlinOffsetMs(utc);
  return new Date(utc).toISOString();
}

/** Wert eines <input type="datetime-local"> (Berliner Zeit) → UTC-ISO. */
export function localInputToUtc(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  return berlinPartsToUtc(+m[1], +m[2], +m[3], +m[4], +m[5]);
}

/** UTC-ISO → Wert für <input type="datetime-local"> in Berliner Zeit. */
export function utcToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const local = new Date(ms + berlinOffsetMs(ms));
  return local.toISOString().slice(0, 16);
}

/**
 * Liest ein Datum aus CSV oder Formularen. Erlaubt:
 * 2026-09-01, 2026-09-01 18:30, 2026-09-01T18:30, 01.09.2026, 01.09.2026 18:30
 * sowie vollständige ISO-Zeitstempel mit Zeitzone (Z oder +02:00).
 * Zeiten ohne Zeitzone gelten als Berliner Ortszeit.
 */
export function parseFlexibleDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(v) && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(v);
  if (m) return berlinPartsToUtc(+m[1], +m[2], +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0);
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(v);
  if (m) return berlinPartsToUtc(+m[3], +m[2], +m[1], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0);
  return null;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString("de-DE", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("de-DE", { timeZone: TZ, dateStyle: "medium" });
}

/** Heutiges Datum in Berlin als YYYY-MM-DD. */
export function todayBerlin(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}
