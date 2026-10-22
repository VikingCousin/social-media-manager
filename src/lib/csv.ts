// CSV-Import für Performance-Daten. Reine Funktionen (ohne Datenbank), damit sie testbar sind.
// Importierte Inhalte werden ausschließlich als Daten behandelt.
import Papa from "papaparse";
import { parseFlexibleDate } from "./time.ts";

export const METRIC_FIELDS = [
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
  "watch_time_seconds",
  "follower_gain",
] as const;
export type MetricField = (typeof METRIC_FIELDS)[number];

export const METRIC_LABELS: Record<MetricField, string> = {
  views: "Views",
  reach: "Reichweite",
  likes: "Likes",
  comments: "Kommentare",
  shares: "Shares",
  saves: "Saves",
  watch_time_seconds: "Ø Wiedergabedauer (Sek.)",
  follower_gain: "Follower-Gewinn",
};

/** Spalten der CSV-Vorlage (Reihenfolge = Vorlage). */
export const CSV_COLUMNS = [
  "veroeffentlicht_am",
  "account",
  "format",
  "thema",
  "link",
  "views",
  "reichweite",
  "likes",
  "kommentare",
  "shares",
  "saves",
  "wiedergabedauer_sek",
  "follower_gewinn",
] as const;

const HEADER_ALIASES: Record<string, string> = {
  veroeffentlicht_am: "published_at",
  veröffentlicht_am: "published_at",
  veroeffentlichungszeitpunkt: "published_at",
  datum: "published_at",
  published_at: "published_at",
  date: "published_at",
  account: "account",
  konto: "account",
  format: "format",
  thema: "topic",
  topic: "topic",
  link: "url",
  url: "url",
  views: "views",
  aufrufe: "views",
  reichweite: "reach",
  reach: "reach",
  impressions: "reach",
  likes: "likes",
  "gefällt_mir": "likes",
  kommentare: "comments",
  comments: "comments",
  shares: "shares",
  geteilt: "shares",
  saves: "saves",
  gespeichert: "saves",
  wiedergabedauer_sek: "watch_time_seconds",
  wiedergabedauer: "watch_time_seconds",
  watch_time_seconds: "watch_time_seconds",
  follower_gewinn: "follower_gain",
  follower_gain: "follower_gain",
  neue_follower: "follower_gain",
};

export type AccountRef = { id: number; handle: string; display_name: string; platform: string };

export type ParsedPost = {
  row: number;
  account_id: number;
  published_at: string | null;
  format: string;
  topic: string;
  url: string;
  dedup_key: string;
  metrics: Record<MetricField, number | null>;
};

export type RowError = { row: number; message: string };

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;

const UNKNOWN = new Set(["", "-", "–", "n/a", "na", "k.a.", "k. a.", "unbekannt", "null", "?"]);

/**
 * Zahl lesen. Leere/unbekannte Werte → null (nicht 0!).
 * Unterstützt 1234, 1.234 / 1 234 (Tausender), 12,5 (Dezimalkomma), 12.5 (Dezimalpunkt),
 * sowie Kurzformen wie 1,2K / 3M.
 */
export function parseMetric(raw: unknown, allowDecimal = false): { ok: true; value: number | null } | { ok: false } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  let v = String(raw).trim().toLowerCase();
  if (UNKNOWN.has(v)) return { ok: true, value: null };
  let factor = 1;
  const suffix = /^(.*?)(k|m|tsd\.?|mio\.?)$/.exec(v);
  if (suffix) {
    v = suffix[1].trim();
    factor = suffix[2].startsWith("k") || suffix[2].startsWith("t") ? 1_000 : 1_000_000;
  }
  v = v.replace(/\s/g, "");
  let num: number;
  if (/^\d{1,3}(\.\d{3})+$/.test(v) && factor === 1) num = Number(v.replace(/\./g, ""));
  else if (/^\d{1,3}(,\d{3})+$/.test(v) && factor === 1 && !allowDecimal) num = Number(v.replace(/,/g, ""));
  else if (/^\d+,\d+$/.test(v)) num = Number(v.replace(",", "."));
  else if (/^\d+(\.\d+)?$/.test(v)) num = Number(v);
  else return { ok: false };
  num *= factor;
  if (!Number.isFinite(num) || num < 0) return { ok: false };
  if (!allowDecimal) num = Math.round(num);
  return { ok: true, value: num };
}

export function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|si$|igsh|is_from_webapp|sender_device|trk|rcm)/i.test(k)) u.searchParams.delete(k);
    }
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const p = u.pathname.replace(/\/+$/, "");
    return `https://${host}${p}${u.search}`;
  } catch {
    return "";
  }
}

/** Stabiler Schlüssel gegen Doppel-Importe. */
export function dedupKey(p: { account_id: number; url: string; published_at: string | null; format: string; topic: string }) {
  if (p.url) return `url:${p.url}`;
  return `acc:${p.account_id}|${p.published_at ? p.published_at.slice(0, 16) : "?"}|${p.format.trim().toLowerCase()}|${p.topic.trim().toLowerCase()}`;
}

export function resolveAccount(value: string, accounts: AccountRef[]): AccountRef | null | "ambiguous" {
  const v = value.trim().toLowerCase().replace(/^@/, "");
  if (!v) return null;
  if (/^\d+$/.test(v)) return accounts.find((a) => a.id === Number(v)) ?? null;
  const byHandle = accounts.filter((a) => a.handle.toLowerCase().replace(/^@/, "") === v);
  if (byHandle.length === 1) return byHandle[0];
  const byName = accounts.filter((a) => a.display_name.toLowerCase() === v);
  if (byName.length === 1) return byName[0];
  const byPlatform = accounts.filter((a) => a.platform.toLowerCase() === v);
  if (byPlatform.length === 1) return byPlatform[0];
  if (byPlatform.length > 1 || byName.length > 1 || byHandle.length > 1) return "ambiguous";
  return null;
}

function normHeader(h: string) {
  return h.trim().toLowerCase().replace(/^﻿/, "").replace(/[\s-]+/g, "_");
}

export function parsePerformanceCsv(
  text: string,
  accounts: AccountRef[],
): { posts: ParsedPost[]; errors: RowError[]; unknownColumns: string[] } {
  const errors: RowError[] = [];
  if (text.length > MAX_CSV_BYTES) {
    return { posts: [], errors: [{ row: 0, message: "Datei ist größer als 2 MB." }], unknownColumns: [] };
  }
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normHeader,
  });
  const fields = result.meta.fields ?? [];
  const unknownColumns = fields.filter((f) => !HEADER_ALIASES[f]);
  const mapped = new Set(fields.map((f) => HEADER_ALIASES[f]).filter(Boolean));
  if (!mapped.has("account")) {
    return { posts: [], errors: [{ row: 1, message: "Pflichtspalte „account“ fehlt. Bitte die Vorlage verwenden." }], unknownColumns };
  }
  if (!mapped.has("url") && !mapped.has("published_at")) {
    return {
      posts: [],
      errors: [{ row: 1, message: "Es wird mindestens „link“ oder „veroeffentlicht_am“ benötigt, um Beiträge eindeutig zu erkennen." }],
      unknownColumns,
    };
  }
  for (const e of result.errors.slice(0, 20)) {
    errors.push({ row: (e.row ?? 0) + 2, message: `CSV-Formatfehler: ${e.message}` });
  }
  if (result.data.length > MAX_CSV_ROWS) {
    return { posts: [], errors: [{ row: 0, message: `Mehr als ${MAX_CSV_ROWS} Zeilen – bitte aufteilen.` }], unknownColumns };
  }

  const posts: ParsedPost[] = [];
  const seen = new Set<string>();
  result.data.forEach((raw, idx) => {
    const row = idx + 2; // Zeile 1 = Kopfzeile
    const rec: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const key = HEADER_ALIASES[k];
      if (key) rec[key] = typeof v === "string" ? v : String(v ?? "");
    }
    const acc = resolveAccount(rec.account ?? "", accounts);
    if (acc === "ambiguous") {
      errors.push({ row, message: `Account „${(rec.account ?? "").slice(0, 60)}“ ist mehrdeutig – bitte Handle verwenden (z. B. @beispiel_a).` });
      return;
    }
    if (!acc) {
      errors.push({ row, message: `Account „${(rec.account ?? "").slice(0, 60)}“ nicht gefunden.` });
      return;
    }
    let published_at: string | null = null;
    if (rec.published_at?.trim()) {
      published_at = parseFlexibleDate(rec.published_at);
      if (!published_at) {
        errors.push({ row, message: `Datum „${rec.published_at.slice(0, 40)}“ nicht lesbar (erwartet z. B. 2026-09-01 18:30 oder 01.09.2026 18:30).` });
        return;
      }
    }
    const rawUrl = (rec.url ?? "").trim();
    const url = normalizeUrl(rawUrl);
    if (rawUrl && !url) {
      errors.push({ row, message: "Link ist keine gültige http(s)-Adresse." });
      return;
    }
    if (!url && !published_at) {
      errors.push({ row, message: "Weder Link noch Veröffentlichungszeitpunkt vorhanden – Beitrag nicht eindeutig." });
      return;
    }
    const metrics = {} as Record<MetricField, number | null>;
    let bad: string | null = null;
    for (const f of METRIC_FIELDS) {
      const r = parseMetric(rec[f], f === "watch_time_seconds");
      if (!r.ok) {
        bad = `${METRIC_LABELS[f]}: „${String(rec[f]).slice(0, 20)}“ ist keine gültige, nicht-negative Zahl.`;
        break;
      }
      metrics[f] = r.value;
    }
    if (bad) {
      errors.push({ row, message: bad });
      return;
    }
    const format = (rec.format ?? "").trim().slice(0, 60);
    const topic = (rec.topic ?? "").trim().slice(0, 200);
    const key = dedupKey({ account_id: acc.id, url, published_at, format, topic });
    if (seen.has(key)) {
      errors.push({ row, message: "Doppelte Zeile innerhalb dieser Datei – übersprungen." });
      return;
    }
    seen.add(key);
    posts.push({ row, account_id: acc.id, published_at, format, topic, url, dedup_key: key, metrics });
  });
  return { posts, errors, unknownColumns };
}

/** Beim erneuten Import: bekannte Werte nie durch „unbekannt“ überschreiben. */
export function mergeMetrics(
  existing: Record<MetricField, number | null>,
  incoming: Record<MetricField, number | null>,
): { merged: Record<MetricField, number | null>; changed: boolean } {
  const merged = { ...existing };
  let changed = false;
  for (const f of METRIC_FIELDS) {
    const v = incoming[f];
    if (v !== null && v !== existing[f]) {
      merged[f] = v;
      changed = true;
    }
  }
  return { merged, changed };
}

export function templateCsv(): string {
  return CSV_COLUMNS.join(";") + "\n";
}
