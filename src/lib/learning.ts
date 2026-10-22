// Lernen aus den eigenen Überarbeitungen: einfache, nachvollziehbare Kennwerte statt Blackbox.

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

/** Ähnlichkeit zweier Texte (Jaccard über Wörter), 0 … 1. */
export function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export type EditPair = { original: string; final: string };

export type EditStats = {
  n: number;
  avgLengthRatio: number | null;
  heavilyEdited: number;
  summary: string[];
};

/** Wie stark wurden KI- oder extern erzeugte Entwürfe bis zur Freigabe verändert? */
export function editStats(pairs: EditPair[]): EditStats {
  const valid = pairs.filter((p) => p.original.trim() && p.final.trim());
  if (valid.length === 0) return { n: 0, avgLengthRatio: null, heavilyEdited: 0, summary: [] };
  const ratios = valid.map((p) => p.final.length / p.original.length);
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const heavily = valid.filter((p) => similarity(p.original, p.final) < 0.6).length;
  const summary: string[] = [];
  if (avg < 0.85) summary.push(`Du kürzt Vorschläge im Schnitt auf etwa ${Math.round(avg * 100)} % – schreibe knapper.`);
  else if (avg > 1.15) summary.push(`Du erweiterst Vorschläge im Schnitt auf etwa ${Math.round(avg * 100)} % – mehr Raum für konkrete Details lassen.`);
  if (heavily / valid.length >= 0.5) summary.push(`${heavily} von ${valid.length} Vorschlägen hast du stark umgeschrieben – eigene Formulierungen haben Vorrang vor der Vorlage.`);
  return { n: valid.length, avgLengthRatio: Math.round(avg * 100) / 100, heavilyEdited: heavily, summary };
}
