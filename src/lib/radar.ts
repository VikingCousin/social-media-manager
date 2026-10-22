// Content-Radar: Auswertung beobachteter, fremder Beiträge.
// Das sind EXTERNE Beobachtungen – sie werden nie mit den eigenen Leistungsdaten vermischt.
import { median } from "./analytics.ts";

export const RELATIONS: Record<string, string> = {
  konkurrenz: "Konkurrenz",
  vorbild: "Vorbild",
  inspiration: "Inspiration",
  zielgruppe: "Stimme aus der Zielgruppe",
};

export const HOOK_TYPES = [
  "Frage",
  "Zahl oder Liste",
  "Kontrast oder Widerspruch",
  "Persönliche Erfahrung",
  "Anleitung",
  "These",
  "unklar",
] as const;
export type HookType = (typeof HOOK_TYPES)[number];

/**
 * Regelbasierte Grobeinordnung eines Einstiegs. Bewusst einfach und nachvollziehbar –
 * in der Oberfläche als „automatische Grobeinordnung“ gekennzeichnet.
 */
export function classifyHook(raw: string): HookType {
  const t = raw.trim().toLowerCase();
  if (!t) return "unklar";
  if (/^(wie|so)\b.*\b(du|ihr|man)\b|schritt|anleitung|how to|tutorial|in \d+ schritten/.test(t)) return "Anleitung";
  if (/^\d+|\b\d+ (dinge|gründe|fehler|tipps|tools|wege|lektionen|things|reasons|mistakes|tips)\b/.test(t)) return "Zahl oder Liste";
  if (/\b(aber|statt|stattdessen|nicht .* sondern|niemand|alle denken|falsch|mythos|vs\.?|versus|but|instead|nobody|everyone thinks|wrong)\b/.test(t)) return "Kontrast oder Widerspruch";
  if (/^(ich|mein|meine|gestern|letzte woche|als ich|i |my |when i)\b/.test(t)) return "Persönliche Erfahrung";
  if (t.includes("?")) return "Frage";
  if (t.length > 0 && t.length <= 160) return "These";
  return "unklar";
}

export type RadarPostLite = {
  id: number;
  profile_id: number | null;
  platform: string;
  format: string;
  hook: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
};

export type Outlier = {
  id: number;
  views: number;
  /** Views geteilt durch den Vergleichs-Median, auf eine Nachkommastelle gerundet. */
  factor: number;
  /** Median der Views der ÜBRIGEN erfassten Beiträge desselben Profils (ohne den bewerteten Beitrag). */
  baselineMedian: number;
  /** Anzahl der Vergleichswerte (übrige Beiträge mit bekannten Views). */
  baselineN: number;
};

export type ProfileStat = {
  profile_id: number;
  n: number;
  knownViews: number;
  /** Median aller erfassten Beiträge mit bekannten Views (beschreibend, nicht für Ausreißer). */
  medianViews: number | null;
  outliers: Outlier[];
};

/**
 * Ausreißer: Beitrag mit mindestens doppelt so vielen Views wie der Median der ÜBRIGEN erfassten
 * Beiträge desselben Profils. Der bewertete Beitrag zählt nicht zu seiner eigenen Vergleichsbasis,
 * sonst würde ein starker Ausreißer seine Basis selbst anheben. Es braucht mindestens
 * OUTLIER_MIN_BASELINE Vergleichswerte. Basis sind nur selbst erfasste Beiträge – keine
 * vollständige Stichprobe des Profils.
 */
export const OUTLIER_FACTOR = 2;
export const OUTLIER_MIN_BASELINE = 3;

export function outlierFactor(views: number, baselineMedian: number): number {
  return Math.round((views / baselineMedian) * 10) / 10;
}

export function profileStats(posts: RadarPostLite[]): ProfileStat[] {
  const byProfile = new Map<number, RadarPostLite[]>();
  for (const p of posts) {
    if (p.profile_id === null) continue;
    byProfile.set(p.profile_id, [...(byProfile.get(p.profile_id) ?? []), p]);
  }
  return [...byProfile.entries()].map(([profile_id, ps]) => {
    const known = ps.filter((p) => p.views !== null) as (RadarPostLite & { views: number })[];
    const outliers: Outlier[] = [];
    for (const p of known) {
      const others = known.filter((o) => o.id !== p.id).map((o) => o.views);
      if (others.length < OUTLIER_MIN_BASELINE) continue;
      const base = median(others);
      if (!base || base <= 0) continue;
      if (p.views >= base * OUTLIER_FACTOR) {
        outliers.push({ id: p.id, views: p.views, factor: outlierFactor(p.views, base), baselineMedian: base, baselineN: others.length });
      }
    }
    outliers.sort((a, b) => b.factor - a.factor || a.id - b.id);
    return { profile_id, n: ps.length, knownViews: known.length, medianViews: median(known.map((p) => p.views)), outliers };
  });
}

/** Kurztext für die Anzeige, z. B. „↑ 3,6× ggü. Median 110 der 3 übrigen erfassten Beiträge“. */
export function outlierLabel(o: Pick<Outlier, "factor" | "baselineMedian" | "baselineN">): string {
  const f = o.factor.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const m = Math.round(o.baselineMedian).toLocaleString("de-DE");
  return `↑ ${f}× ggü. Median ${m} der ${o.baselineN} übrigen erfassten Beiträge`;
}

export function countBy<T>(items: T[], key: (t: T) => string): { key: string; n: number }[] {
  const m = new Map<string, number>();
  for (const i of items) {
    const k = key(i).trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

export type RadarOverview = {
  n: number;
  formats: { key: string; n: number }[];
  hookTypes: { key: string; n: number }[];
  profiles: ProfileStat[];
  notes: string[];
};

export function radarOverview(posts: RadarPostLite[]): RadarOverview {
  const formats = countBy(posts, (p) => p.format);
  const hookTypes = countBy(
    posts.filter((p) => p.hook.trim()),
    (p) => classifyHook(p.hook),
  );
  const profiles = profileStats(posts);
  const notes: string[] = [];
  if (posts.length === 0) notes.push("Noch keine Beiträge im Radar erfasst.");
  else if (posts.length < 10) notes.push(`Erst ${posts.length} erfasste Beiträge – Häufigkeiten sind nur ein erster Eindruck.`);
  const withHooks = posts.filter((p) => p.hook.trim()).length;
  if (posts.length && withHooks < posts.length) notes.push(`Bei ${posts.length - withHooks} von ${posts.length} Beiträgen ist kein Einstieg notiert.`);
  return { n: posts.length, formats, hookTypes, profiles, notes };
}
