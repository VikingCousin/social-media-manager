// Content-Paket: alles, was aus einem Gedanken einen drehfertigen Beitrag macht.
// Gespeichert am Entwurf (drafts.package_json). Skript bzw. Beitragstext steht in drafts.body,
// der Titel in drafts.title – nichts wird doppelt gehalten.

export type ContentPackage = {
  account_reason: string;
  alternative: string;
  angle: string;
  effect: string;
  hook_spoken: string;
  hook_text: string;
  hook_visual: string;
  hook_combo: string;
  throughline: string[];
  shoot_say: string;
  shoot_show: string;
  shoot_broll: string;
  shoot_location: string;
  caption: string;
  questions: string[];
  examples_needed: string[];
};

export const PACKAGE_TEXT_FIELDS = [
  "account_reason",
  "alternative",
  "angle",
  "effect",
  "hook_spoken",
  "hook_text",
  "hook_visual",
  "hook_combo",
  "shoot_say",
  "shoot_show",
  "shoot_broll",
  "shoot_location",
  "caption",
] as const;
export const PACKAGE_LIST_FIELDS = ["throughline", "questions", "examples_needed"] as const;

export const PACKAGE_LABELS: Record<keyof ContentPackage, string> = {
  account_reason: "Warum dieser Account",
  alternative: "Alternative",
  angle: "Blickwinkel",
  effect: "Gewünschte Wirkung",
  hook_spoken: "Gesprochener Einstieg",
  hook_text: "Text im Bild",
  hook_visual: "Visuelles Anfangsmotiv",
  hook_combo: "Empfohlene Kombination",
  throughline: "Roter Faden",
  shoot_say: "Sagen",
  shoot_show: "Zeigen",
  shoot_broll: "Ergänzend filmen",
  shoot_location: "Drehort",
  caption: "Caption",
  questions: "Offene Fragen an dich",
  examples_needed: "Benötigte persönliche Beispiele",
};

export function emptyPackage(): ContentPackage {
  return {
    account_reason: "", alternative: "", angle: "", effect: "",
    hook_spoken: "", hook_text: "", hook_visual: "", hook_combo: "",
    throughline: [], shoot_say: "", shoot_show: "", shoot_broll: "", shoot_location: "",
    caption: "", questions: [], examples_needed: [],
  };
}

export function parsePackageJson(raw: string | null | undefined): ContentPackage | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<ContentPackage>;
    const p = emptyPackage();
    for (const k of PACKAGE_TEXT_FIELDS) if (typeof j[k] === "string") p[k] = j[k] as string;
    for (const k of PACKAGE_LIST_FIELDS) if (Array.isArray(j[k])) p[k] = (j[k] as unknown[]).map(String).filter((s) => s.trim());
    return p;
  } catch {
    return null;
  }
}

/** Liste aus Mehrzeilen-Text (eine Zeile = ein Eintrag, Aufzählungszeichen werden entfernt). */
export function linesToList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 30);
}

/* ---------- Extern erzeugtes Ergebnis (kopierbarer Prompt) einlesen ---------- */

/** Überschriften, die der kopierbare Prompt vorgibt – Reihenfolge = Antwortgliederung. */
export const PACKAGE_HEADINGS: { heading: string; field: keyof ContentPackage | "account" | "script" | "title" }[] = [
  { heading: "Empfohlener Account", field: "account" },
  { heading: "Warum dieser Account", field: "account_reason" },
  { heading: "Alternative", field: "alternative" },
  { heading: "Blickwinkel", field: "angle" },
  { heading: "Gewünschte Wirkung", field: "effect" },
  { heading: "Gesprochener Einstieg", field: "hook_spoken" },
  { heading: "Text im Bild", field: "hook_text" },
  { heading: "Visuelles Anfangsmotiv", field: "hook_visual" },
  { heading: "Empfohlene Kombination", field: "hook_combo" },
  { heading: "Roter Faden", field: "throughline" },
  { heading: "Skript", field: "script" },
  { heading: "Sagen", field: "shoot_say" },
  { heading: "Zeigen", field: "shoot_show" },
  { heading: "Ergänzend filmen", field: "shoot_broll" },
  { heading: "Drehort", field: "shoot_location" },
  { heading: "Titel", field: "title" },
  { heading: "Caption", field: "caption" },
  { heading: "Offene Fragen", field: "questions" },
  { heading: "Benötigte persönliche Beispiele", field: "examples_needed" },
];

export type ParsedExternal = { pkg: ContentPackage; account: string; script: string; title: string; unmatched: string };

function normHeading(h: string) {
  return h.toLowerCase().replace(/[#*:_]/g, "").replace(/\s+/g, " ").trim();
}

export function parsePackageMarkdown(text: string): ParsedExternal {
  const pkg = emptyPackage();
  const out: ParsedExternal = { pkg, account: "", script: "", title: "", unmatched: "" };
  const sections: { field: string | null; lines: string[] }[] = [{ field: null, lines: [] }];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const m = /^\s{0,3}(?:#{1,6}\s*|\*\*)(.+?)(?:\*\*)?\s*:?\s*$/.exec(line);
    if (m) {
      const h = normHeading(m[1]);
      const hit = PACKAGE_HEADINGS.find((x) => h.startsWith(normHeading(x.heading)));
      if (hit) {
        sections.push({ field: hit.field, lines: [] });
        continue;
      }
    }
    sections[sections.length - 1].lines.push(line);
  }
  for (const s of sections) {
    const body = s.lines.join("\n").trim();
    if (!body) continue;
    if (!s.field) {
      out.unmatched += (out.unmatched ? "\n\n" : "") + body;
    } else if (s.field === "account") out.account = body;
    else if (s.field === "script") out.script = body;
    else if (s.field === "title") out.title = body.replace(/^["„“]|["“”]$/g, "").split("\n")[0].trim();
    else if ((PACKAGE_LIST_FIELDS as readonly string[]).includes(s.field)) (pkg[s.field as (typeof PACKAGE_LIST_FIELDS)[number]] as string[]) = linesToList(body);
    else (pkg[s.field as (typeof PACKAGE_TEXT_FIELDS)[number]] as string) = body;
  }
  return out;
}

/* ---------- Sicherheit beim Dreh ---------- */

const DRIVING = /(während (der|ich) (fahr|auto)|beim (auto)?fahren|am steuer|hinterm steuer|während der fahrt|fahrend|im fahrenden)/i;
const PARKED = /(geparkt|parkend|stehende[nm]? auto|park(platz|t))/i;

/** Warnt, wenn Drehhinweise Filmen oder Skriptbedienung während der Fahrt nahelegen. */
export function drivingRisk(pkg: Pick<ContentPackage, "shoot_say" | "shoot_show" | "shoot_broll" | "shoot_location" | "hook_visual">): boolean {
  const all = [pkg.shoot_say, pkg.shoot_show, pkg.shoot_broll, pkg.shoot_location, pkg.hook_visual].join("\n");
  return all.split(/\n|(?<=[.!?])\s/).some((s) => DRIVING.test(s) && !PARKED.test(s) && !/nicht|nie|kein/i.test(s));
}

/** Was fehlt noch, damit das Paket drehfertig ist? */
export function packageGaps(pkg: ContentPackage, script: string): string[] {
  const gaps: string[] = [];
  if (!pkg.hook_spoken.trim() && !pkg.hook_text.trim() && !pkg.hook_visual.trim()) gaps.push("Einstieg");
  if (!pkg.throughline.length && !script.trim()) gaps.push("Roter Faden oder Skript");
  if (!pkg.shoot_say.trim() && !pkg.shoot_show.trim()) gaps.push("Aufnahmehinweise");
  if (!pkg.caption.trim()) gaps.push("Caption");
  if (/\[[A-ZÄÖÜ][A-ZÄÖÜ ]{3,}[^\]]*\]/.test(script + pkg.caption + pkg.hook_spoken)) gaps.push("Platzhalter durch eigene Angaben ersetzen");
  if (pkg.examples_needed.length) gaps.push("persönliche Beispiele ergänzen");
  return gaps;
}
