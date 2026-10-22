// Einfache, nachvollziehbare Auswertungen innerhalb EINES Accounts.
// Keine Prognosen, keine Vergleiche zwischen Plattformen. Unbekannte Werte werden ausgelassen, nicht als 0 gezählt.
import { METRIC_FIELDS, type MetricField } from "./csv.ts";

export type PostRow = {
  id: number;
  published_at: string | null;
  format: string;
  topic: string;
  url: string;
} & Record<MetricField, number | null>;

export const MIN_POSTS_FOR_PATTERNS = 5;
export const MIN_GROUP_SIZE = 2;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Interaktionen = Likes + Kommentare + Shares + Saves – nur wenn alle vier bekannt sind. */
export function interactions(p: PostRow): number | null {
  const parts = [p.likes, p.comments, p.shares, p.saves];
  if (parts.some((v) => v === null)) return null;
  return parts.reduce<number>((a, b) => a + (b as number), 0);
}

/** Interaktionsrate bezogen auf Views (falls bekannt), sonst Reichweite. */
export function engagementRate(p: PostRow): { rate: number; base: "views" | "reach" } | null {
  const i = interactions(p);
  if (i === null) return null;
  if (p.views && p.views > 0) return { rate: i / p.views, base: "views" };
  if (p.reach && p.reach > 0) return { rate: i / p.reach, base: "reach" };
  return null;
}

export type Coverage = Record<MetricField, number>;

export type GroupStat = { key: string; n: number; medianViews: number | null; medianRate: number | null };

export type AccountSummary = {
  n: number;
  coverage: Coverage;
  medianViews: number | null;
  medianRate: number | null;
  byFormat: GroupStat[];
  byTopic: GroupStat[];
  topByViews: PostRow[];
  enoughData: boolean;
  notes: string[];
};

function groupStats(posts: PostRow[], keyOf: (p: PostRow) => string): GroupStat[] {
  const groups = new Map<string, PostRow[]>();
  for (const p of posts) {
    const k = keyOf(p).trim() || "(ohne Angabe)";
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return [...groups.entries()]
    .map(([key, ps]) => ({
      key,
      n: ps.length,
      medianViews: median(ps.map((p) => p.views).filter((v): v is number => v !== null)),
      medianRate: median(ps.map((p) => engagementRate(p)?.rate).filter((v): v is number => v !== undefined)),
    }))
    .sort((a, b) => b.n - a.n);
}

export function summarize(posts: PostRow[]): AccountSummary {
  const coverage = Object.fromEntries(
    METRIC_FIELDS.map((f) => [f, posts.filter((p) => p[f] !== null).length]),
  ) as Coverage;
  const views = posts.map((p) => p.views).filter((v): v is number => v !== null);
  const rates = posts.map((p) => engagementRate(p)?.rate).filter((v): v is number => v !== undefined);
  const enoughData = posts.length >= MIN_POSTS_FOR_PATTERNS;
  const notes: string[] = [];

  const byFormat = groupStats(posts, (p) => p.format);
  const byTopic = groupStats(posts, (p) => p.topic);

  if (posts.length === 0) {
    notes.push("Noch keine Beiträge erfasst.");
  } else if (!enoughData) {
    notes.push(
      `Erst ${posts.length} ${posts.length === 1 ? "Beitrag" : "Beiträge"} erfasst. Für belastbare Muster sind mindestens ${MIN_POSTS_FOR_PATTERNS} nötig – die Zahlen unten sind nur eine Bestandsaufnahme.`,
    );
  } else {
    const overall = median(views);
    const comparable = byFormat.filter((g) => g.n >= MIN_GROUP_SIZE && g.medianViews !== null);
    if (overall !== null && comparable.length >= 2) {
      const best = [...comparable].sort((a, b) => (b.medianViews ?? 0) - (a.medianViews ?? 0))[0];
      notes.push(
        `Format „${best.key}“ hat mit ${Math.round(best.medianViews!).toLocaleString("de-DE")} den höchsten Median an Views (n=${best.n}, Account-Median ${Math.round(overall).toLocaleString("de-DE")}). Hinweis, kein Beleg – kleine Stichproben schwanken stark.`,
      );
    }
    const topics = byTopic.filter((g) => g.n >= MIN_GROUP_SIZE && g.medianRate !== null);
    if (topics.length >= 2) {
      const best = [...topics].sort((a, b) => (b.medianRate ?? 0) - (a.medianRate ?? 0))[0];
      notes.push(
        `Thema „${best.key}“ hat die höchste mittlere Interaktionsrate (${(best.medianRate! * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %, n=${best.n}).`,
      );
    }
    if (notes.length === 0) notes.push("Noch keine Gruppe mit genügend vergleichbaren Beiträgen (mind. 2 je Format/Thema mit bekannten Werten).");
  }
  const missingViews = posts.length - coverage.views;
  if (posts.length > 0 && missingViews > 0) {
    notes.push(`Bei ${missingViews} von ${posts.length} Beiträgen sind die Views unbekannt; sie fließen nicht in Mediane ein.`);
  }

  return {
    n: posts.length,
    coverage,
    medianViews: median(views),
    medianRate: median(rates),
    byFormat,
    byTopic,
    topByViews: posts.filter((p) => p.views !== null).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5),
    enoughData,
    notes,
  };
}
