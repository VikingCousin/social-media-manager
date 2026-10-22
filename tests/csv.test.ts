import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupKey, mergeMetrics, normalizeUrl, parseMetric, parsePerformanceCsv, templateCsv, type AccountRef } from "../src/lib/csv.ts";

const accounts: AccountRef[] = [
  { id: 1, platform: "linkedin", display_name: "Beispiel LinkedIn", handle: "beispiel-profil" },
  { id: 2, platform: "instagram", display_name: "beispiel_insta", handle: "@beispiel_insta" },
  { id: 3, platform: "tiktok", display_name: "Beispielkanal A", handle: "@beispiel_a" },
  { id: 4, platform: "tiktok", display_name: "Beispielkanal B", handle: "@beispiel_b" },
];

test("fehlende Kennzahlen bleiben unbekannt (null), nicht 0", () => {
  assert.deepEqual(parseMetric(""), { ok: true, value: null });
  assert.deepEqual(parseMetric("-"), { ok: true, value: null });
  assert.deepEqual(parseMetric("n/a"), { ok: true, value: null });
  assert.deepEqual(parseMetric("0"), { ok: true, value: 0 });
});

test("Zahlenformate", () => {
  assert.deepEqual(parseMetric("1.234"), { ok: true, value: 1234 });
  assert.deepEqual(parseMetric("1 234"), { ok: true, value: 1234 });
  assert.deepEqual(parseMetric("1,2K"), { ok: true, value: 1200 });
  assert.deepEqual(parseMetric("3M"), { ok: true, value: 3000000 });
  assert.deepEqual(parseMetric("12,5", true), { ok: true, value: 12.5 });
  assert.deepEqual(parseMetric("-5"), { ok: false });
  assert.deepEqual(parseMetric("abc"), { ok: false });
});

test("URL-Normalisierung entfernt Tracking und www", () => {
  assert.equal(normalizeUrl("https://www.tiktok.com/@x/video/1?is_from_webapp=1&sender_device=pc"), "https://tiktok.com/@x/video/1");
  assert.equal(normalizeUrl("javascript:alert(1)"), "");
  assert.equal(normalizeUrl("kein link"), "");
});

test("CSV mit Semikolon, Handles und fehlenden Werten", () => {
  const csv = `${templateCsv()}01.09.2026 18:30;@beispiel_a;Kurzvideo;Reise;https://www.tiktok.com/@beispiel_a/video/1;1.200;;80;;;;12,5;\n2026-09-02;linkedin;LinkedIn-Textbeitrag;KI;;;900;20;3;1;0;;2\n`;
  const r = parsePerformanceCsv(csv, accounts);
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
  assert.equal(r.posts.length, 2);
  const [a, b] = r.posts;
  assert.equal(a.account_id, 3);
  assert.equal(a.metrics.views, 1200);
  assert.equal(a.metrics.reach, null);
  assert.equal(a.metrics.comments, null);
  assert.equal(a.metrics.watch_time_seconds, 12.5);
  assert.equal(a.published_at, "2026-09-01T16:30:00.000Z"); // Sommerzeit Berlin = UTC+2
  assert.equal(b.account_id, 1);
  assert.equal(b.metrics.views, null);
  assert.equal(b.metrics.saves, 0);
  assert.ok(b.dedup_key.startsWith("acc:1|"));
});

test("mehrdeutige Plattform und unbekannter Account werden gemeldet", () => {
  const csv = "account;link\ntiktok;https://tiktok.com/a\n@gibtsnicht;https://tiktok.com/b\n";
  const r = parsePerformanceCsv(csv, accounts);
  assert.equal(r.posts.length, 0);
  assert.match(r.errors[0].message, /mehrdeutig/);
  assert.match(r.errors[1].message, /nicht gefunden/);
});

test("Pflichtspalten und ungültige Werte", () => {
  assert.match(parsePerformanceCsv("foo;bar\n1;2\n", accounts).errors[0].message, /account/);
  const r = parsePerformanceCsv("account;link;views\n@beispiel_b;https://x.com/1;viele\n@beispiel_b;;\n", accounts);
  assert.equal(r.posts.length, 0);
  assert.equal(r.errors.length, 2);
});

test("Duplikate innerhalb einer Datei", () => {
  const r = parsePerformanceCsv("account;link\n@beispiel_b;https://tiktok.com/v/1\n@beispiel_b;https://www.tiktok.com/v/1/\n", accounts);
  assert.equal(r.posts.length, 1);
  assert.equal(r.errors.length, 1);
});

test("Dedup-Schlüssel ist stabil über Importe", () => {
  const k1 = dedupKey({ account_id: 1, url: "", published_at: "2026-09-02T10:00:00.000Z", format: "Text ", topic: "KI" });
  const k2 = dedupKey({ account_id: 1, url: "", published_at: "2026-09-02T10:00:00.000Z", format: "text", topic: "ki" });
  assert.equal(k1, k2);
});

test("Merge überschreibt bekannte Werte nie mit unbekannt", () => {
  const base = { views: 100, reach: null, likes: 5, comments: null, shares: null, saves: null, watch_time_seconds: null, follower_gain: null };
  const same = mergeMetrics(base, { ...base, views: null, likes: null });
  assert.equal(same.changed, false);
  assert.equal(same.merged.views, 100);
  const upd = mergeMetrics(base, { ...base, reach: 300 });
  assert.equal(upd.changed, true);
  assert.equal(upd.merged.reach, 300);
  assert.equal(upd.merged.views, 100);
});
