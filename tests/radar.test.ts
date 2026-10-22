import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyHook, outlierLabel, profileStats, radarOverview, type RadarPostLite } from "../src/lib/radar.ts";

test("Einstiege werden grob eingeordnet", () => {
  assert.equal(classifyHook("Warum scheitern so viele KI-Projekte?"), "Frage");
  assert.equal(classifyHook("5 Fehler, die ich als Projektleiter gemacht habe"), "Zahl oder Liste");
  assert.equal(classifyHook("Alle denken, Meetings sind das Problem. Falsch."), "Kontrast oder Widerspruch");
  assert.equal(classifyHook("Ich habe gestern zum ersten Mal …"), "Persönliche Erfahrung");
  assert.equal(classifyHook("So automatisierst du dein Reporting in 3 Schritten"), "Anleitung");
  assert.equal(classifyHook(""), "unklar");
});

const p = (id: number, profile_id: number | null, views: number | null, format = "Reel", hook = ""): RadarPostLite => ({
  id, profile_id, platform: "instagram", format, hook, views, likes: null, comments: null, shares: null,
});

test("Ausreißer: Werte 100/120/110/400 → Faktor 3,6 gegenüber Median 110 der übrigen drei", () => {
  const s = profileStats([p(1, 1, 100), p(2, 1, 120), p(3, 1, 110), p(4, 1, 400), p(5, 1, null)])[0];
  assert.equal(s.knownViews, 4);
  assert.equal(s.medianViews, 115); // beschreibender Median über alle vier
  assert.deepEqual(s.outliers, [{ id: 4, views: 400, factor: 3.6, baselineMedian: 110, baselineN: 3 }]);
});

test("Ausreißer: Werte 100/120/110/1.200 (wie im Browsertest) → 10,9 statt der früheren 10,4", () => {
  const [o] = profileStats([p(1, 1, 100), p(2, 1, 120), p(3, 1, 110), p(4, 1, 1200)])[0].outliers;
  assert.equal(o.baselineMedian, 110);
  assert.equal(o.factor, 10.9); // früher 1200 / 115 = 10,4, weil der Beitrag seinen eigenen Median anhob
});

test("Der bewertete Beitrag zählt nicht zu seiner eigenen Vergleichsbasis", () => {
  // Übrige: 100, 100, 120 → Median 100. 210 ≥ 2 × 100 → Ausreißer.
  // Mit sich selbst im Median (110) läge 210 unter der Schwelle von 220 – genau diese Verzerrung ist behoben.
  const [o] = profileStats([p(1, 1, 100), p(2, 1, 100), p(3, 1, 120), p(4, 1, 210)])[0].outliers;
  assert.deepEqual(o, { id: 4, views: 210, factor: 2.1, baselineMedian: 100, baselineN: 3 });
});

test("Ohne mindestens 3 Vergleichswerte gibt es keine Ausreißer; unbekannte Views zählen nicht", () => {
  assert.deepEqual(profileStats([p(1, 1, 100), p(2, 1, 110), p(3, 1, 900)])[0].outliers, []);
  assert.deepEqual(profileStats([p(1, 1, 100), p(2, 1, 110), p(3, 1, null), p(4, 1, 900)])[0].outliers, []);
  assert.deepEqual(profileStats([p(1, null, 100), p(2, null, 110), p(3, null, 120), p(4, null, 900)]), []);
});

test("Mehrere Ausreißer werden einzeln gegen ihre übrigen Beiträge gemessen und absteigend sortiert", () => {
  const out = profileStats([p(1, 1, 100), p(2, 1, 110), p(3, 1, 120), p(4, 1, 1000), p(5, 1, 1100)])[0].outliers;
  assert.deepEqual(out.map((o) => [o.id, o.factor, o.baselineMedian]), [[5, 9.6, 115], [4, 8.7, 115]]);
});

test("Anzeige nennt Faktor, Vergleichs-Median und Anzahl der Vergleichswerte", () => {
  assert.equal(outlierLabel({ factor: 3.6, baselineMedian: 110, baselineN: 3 }), "↑ 3,6× ggü. Median 110 der 3 übrigen erfassten Beiträge");
  assert.equal(outlierLabel({ factor: 2, baselineMedian: 1234.5, baselineN: 5 }), "↑ 2,0× ggü. Median 1.235 der 5 übrigen erfassten Beiträge");
});

test("Radar-Überblick zählt Formate und markiert Lücken", () => {
  const o = radarOverview([p(1, null, null, "Reel", "Warum?"), p(2, null, null, "Reel"), p(3, null, null, "Karussell")]);
  assert.deepEqual(o.formats[0], { key: "Reel", n: 2 });
  assert.ok(o.notes.some((n) => n.includes("kein Einstieg notiert")));
});
