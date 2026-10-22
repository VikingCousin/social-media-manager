import { createHash } from "node:crypto";

export const PLATFORMS: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  threads: "Threads",
  sonstiges: "Sonstiges",
};

export const DRAFT_STATUSES = ["idee", "entwurf", "bereit", "freigegeben", "geplant", "veroeffentlicht"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const STATUS_LABELS: Record<DraftStatus, string> = {
  idee: "Idee",
  entwurf: "Entwurf",
  bereit: "Bereit zur Freigabe",
  freigegeben: "Freigegeben",
  geplant: "Geplant",
  veroeffentlicht: "Veröffentlicht",
};

export const FORMAT_SUGGESTIONS = [
  "LinkedIn-Textbeitrag",
  "LinkedIn-Karussell",
  "LinkedIn-Kommentar",
  "Kurzvideo",
  "Reel",
  "Story",
  "Foto-Beitrag",
  "Karussell",
  "Text",
];

export const API_STATUS_LABEL: Record<string, string> = {
  nicht_verbunden: "Nicht verbunden",
};

export type Account = {
  id: number;
  platform: string;
  display_name: string;
  handle: string;
  profile_url: string;
  api_status: string;
  positioning: string;
  audience: string;
  topics: string;
  tone: string;
  formats: string;
  goals: string;
  boundaries: string;
  notes: string;
  snapshot: string;
  archived: number;
  created_at: string;
  updated_at: string;
};

export const ACCOUNT_PROFILE_FIELDS = [
  ["positioning", "Positionierung / Bio"],
  ["audience", "Zielgruppe"],
  ["topics", "Themen / Content-Säulen"],
  ["tone", "Tonalität"],
  ["formats", "Gewünschte Formate"],
  ["goals", "Ziele"],
  ["boundaries", "Grenzen / No-Gos"],
  ["notes", "Notizen"],
] as const;

export function isOpen(v: string | null | undefined): boolean {
  const t = (v ?? "").trim().toLowerCase();
  return t === "" || t === "noch offen" || t.startsWith("noch offen");
}

/** Positionierung gilt als unklar, wenn Zielgruppe, Ziele oder Tonalität noch offen sind. */
export function positioningGaps(a: Pick<Account, "audience" | "goals" | "tone" | "topics">): string[] {
  const gaps: string[] = [];
  if (isOpen(a.audience)) gaps.push("Zielgruppe");
  if (isOpen(a.goals)) gaps.push("Ziele");
  if (isOpen(a.tone)) gaps.push("Tonalität");
  if (isOpen(a.topics) || /ausrichtung:\s*noch offen/i.test(a.topics)) gaps.push("Themen/Ausrichtung");
  return gaps;
}

export function accountLabel(a: Pick<Account, "platform" | "display_name" | "handle">): string {
  const p = PLATFORMS[a.platform] ?? a.platform;
  const h = a.handle && a.handle.startsWith("@") ? ` ${a.handle}` : "";
  return `${p} – ${a.display_name}${h}`;
}

/** Freigabe-Fingerabdruck: bindet Inhalt, Account, Format und Termin. */
export function approvalHash(d: { account_id: number | null; format: string; title: string; body: string; scheduled_at: string | null; package_json?: string | null }) {
  const parts: unknown[] = [d.account_id, d.format.trim(), d.title.trim(), d.body.trim(), d.scheduled_at ?? ""];
  // Content-Paket (Caption, Einstiege, Drehhinweise) gehört zur Freigabe – nur wenn vorhanden, damit ältere Freigaben gültig bleiben.
  if (d.package_json) parts.push(d.package_json);
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function splitTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,;\n]/)
        .map((t) => t.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean)
        .map((t) => t.slice(0, 40)),
    ),
  ].slice(0, 20);
}

export function safeHttpUrl(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}
