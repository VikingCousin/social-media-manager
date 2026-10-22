// Meine Sprache: überprüfbare Merkmale aus den EIGENEN Texten (Originalgedanken, freigegebene Texte,
// „klingt nach mir“-Auszüge). Jedes Merkmal nennt seinen Beleg. Kontextanpassung für die KI – kein Modelltraining.

export type StyleSample = { text: string; source: string };

export type DerivedTrait = {
  key: string;
  text: string;
  evidence: string;
  example: string;
};

export const MIN_SAMPLES = 3;

function sentences(t: string): string[] {
  return t
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => /\p{L}/u.test(s));
}

function words(t: string): string[] {
  return t.split(/\s+/).filter((w) => /\p{L}/u.test(w));
}

function share(samples: StyleSample[], test: (t: string) => boolean) {
  const hits = samples.filter((s) => test(s.text));
  return { n: hits.length, of: samples.length, first: hits[0]?.text ?? "" };
}

function excerpt(text: string, re?: RegExp): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (re) {
    const m = re.exec(t);
    if (m) {
      const start = Math.max(0, m.index - 40);
      return (start > 0 ? "…" : "") + t.slice(start, m.index + m[0].length + 60).trim() + (m.index + m[0].length + 60 < t.length ? "…" : "");
    }
  }
  return t.length > 120 ? t.slice(0, 120) + "…" : t;
}

const ICH = /\b(ich|mein|meine|meinen|mir|mich)\b/i;
const DU = /\b(du|dein|deine|dir|dich)\b/i;
const HYPERBOLE = /\b(gefühlt|mega|krass|ewig|tausend|800|komplett|total|immer|nie|jede[rsn]?)\b/i;
const PARTICLES = /\b(halt|mal|eh|echt|irgendwie|eigentlich|einfach|schön)\b/i;

/** Leitet nur Merkmale ab, die sich in mindestens zwei Texten zeigen (ab drei Texten insgesamt). */
export function deriveStyleTraits(samples: StyleSample[]): DerivedTrait[] {
  const s = samples.filter((x) => x.text.trim().length >= 20);
  if (s.length < MIN_SAMPLES) return [];
  const out: DerivedTrait[] = [];
  const ofN = (n: number) => `in ${n} von ${s.length} deiner Texte`;

  const allSent = s.flatMap((x) => sentences(x.text));
  const avgWords = allSent.length ? allSent.reduce((a, x) => a + words(x).length, 0) / allSent.length : 0;
  if (avgWords && avgWords <= 14) {
    out.push({ key: "saetze_kurz", text: `Eher kurze Sätze (im Schnitt ${Math.round(avgWords)} Wörter)`, evidence: `${allSent.length} Sätze aus ${s.length} Texten gemessen`, example: excerpt(allSent[0] ?? "") });
  } else if (avgWords >= 22) {
    out.push({ key: "saetze_lang", text: `Eher lange Sätze (im Schnitt ${Math.round(avgWords)} Wörter)`, evidence: `${allSent.length} Sätze aus ${s.length} Texten gemessen`, example: excerpt(allSent[0] ?? "") });
  }
  const ich = share(s, (t) => ICH.test(t));
  if (ich.n >= 2 && ich.n / ich.of >= 0.5) out.push({ key: "ich_perspektive", text: "Erzählt aus der Ich-Perspektive", evidence: ofN(ich.n), example: excerpt(ich.first, ICH) });
  const du = share(s, (t) => DU.test(t));
  if (du.n >= 2) out.push({ key: "du_ansprache", text: "Spricht das Gegenüber direkt mit „du“ an", evidence: ofN(du.n), example: excerpt(du.first, DU) });
  const fragen = share(s, (t) => t.includes("?"));
  if (fragen.n >= 2) out.push({ key: "fragen", text: "Stellt Fragen, statt nur zu behaupten", evidence: ofN(fragen.n), example: excerpt(fragen.first, /[^.!?]*\?/) });
  const hyper = share(s, (t) => HYPERBOLE.test(t));
  if (hyper.n >= 2) out.push({ key: "ueberspitzung", text: "Überspitzt mit Übertreibungen (z. B. „gefühlt …“)", evidence: ofN(hyper.n), example: excerpt(hyper.first, HYPERBOLE) });
  const part = share(s, (t) => PARTICLES.test(t));
  if (part.n >= 2) out.push({ key: "umgangssprache", text: "Umgangssprachliche Füllwörter (z. B. „halt“, „mal“, „echt“)", evidence: ofN(part.n), example: excerpt(part.first, PARTICLES) });
  const ausruf = share(s, (t) => /!/.test(t));
  if (ausruf.n === 0) out.push({ key: "keine_ausrufe", text: "Verzichtet auf Ausrufezeichen", evidence: `in keinem von ${s.length} Texten`, example: "" });
  const emoji = share(s, (t) => /\p{Extended_Pictographic}/u.test(t));
  if (emoji.n === 0) out.push({ key: "keine_emojis", text: "Schreibt ohne Emojis", evidence: `in keinem von ${s.length} Texten`, example: "" });
  return out;
}
