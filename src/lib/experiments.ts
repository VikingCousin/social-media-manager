// Nächste Experimente je Account – regelbasiert, mit Quelle und ehrlicher Einschätzung der Belastbarkeit.
import { MIN_GROUP_SIZE, MIN_POSTS_FOR_PATTERNS, type AccountSummary } from "./analytics.ts";

export type Experiment = {
  title: string;
  why: string;
  source: "Eigene Daten" | "Content-Radar (extern)" | "Datenlücke";
  confidence: "niedrig" | "mittel";
};

export function suggestExperiments(
  summary: AccountSummary,
  ownFormats: string[],
  radarFormats: { key: string; n: number }[],
  radarHookTypes: { key: string; n: number }[],
): Experiment[] {
  const out: Experiment[] = [];
  const n = summary.n;

  if (n < MIN_POSTS_FOR_PATTERNS) {
    out.push({
      title: `Basis aufbauen: die nächsten ${MIN_POSTS_FOR_PATTERNS - n} Beiträge mit Kennzahlen erfassen`,
      why: `Erst ab ${MIN_POSTS_FOR_PATTERNS} Beiträgen lassen sich eigene Muster vorsichtig ablesen (aktuell ${n}).`,
      source: "Datenlücke",
      confidence: "mittel",
    });
  } else if (summary.coverage.views < n / 2) {
    out.push({
      title: "Views konsequenter erfassen",
      why: `Nur bei ${summary.coverage.views} von ${n} Beiträgen sind Views bekannt – Vergleiche bleiben sonst wackelig.`,
      source: "Datenlücke",
      confidence: "mittel",
    });
  }

  if (summary.enoughData) {
    const comparable = summary.byFormat.filter((g) => g.n >= MIN_GROUP_SIZE && g.medianViews !== null);
    if (comparable.length >= 2) {
      const best = [...comparable].sort((a, b) => (b.medianViews ?? 0) - (a.medianViews ?? 0))[0];
      out.push({
        title: `„${best.key}“ zweimal mit neuem Thema wiederholen`,
        why: `Bisher höchster Median an Views (n=${best.n}). Mit anderem Thema zeigt sich, ob das Format oder das Thema trägt.`,
        source: "Eigene Daten",
        confidence: best.n >= 4 ? "mittel" : "niedrig",
      });
    }
  }

  const own = new Set(ownFormats.map((f) => f.trim().toLowerCase()).filter(Boolean));
  const unseen = radarFormats.filter((f) => f.n >= 2 && !own.has(f.key.toLowerCase()));
  if (unseen.length) {
    const f = unseen[0];
    out.push({
      title: `Format „${f.key}“ einmal ausprobieren`,
      why: `Bei ${f.n} beobachteten Beiträgen im Radar gesehen, von dir noch nicht genutzt. Externe Beobachtung – kein Beleg, dass es bei deinem Publikum funktioniert.`,
      source: "Content-Radar (extern)",
      confidence: "niedrig",
    });
  }
  const hook = radarHookTypes.find((h) => h.key !== "unklar" && h.n >= 2);
  if (hook) {
    out.push({
      title: `Einstieg vom Typ „${hook.key}“ testen`,
      why: `Häufigster Einstiegs-Typ unter den beobachteten Beiträgen (${hook.n}×, automatische Grobeinordnung). Externe Beobachtung.`,
      source: "Content-Radar (extern)",
      confidence: "niedrig",
    });
  }
  return out;
}
