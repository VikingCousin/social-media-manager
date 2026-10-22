import { test } from "node:test";
import assert from "node:assert/strict";
import { engagementRate, median, summarize, type PostRow } from "../src/lib/analytics.ts";

const p = (id: number, format: string, views: number | null, likes: number | null = 1): PostRow => ({
  id, published_at: null, format, topic: "t", url: "",
  views, reach: null, likes, comments: 0, shares: 0, saves: 0, watch_time_seconds: null, follower_gain: null,
});

test("Median", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test("Interaktionsrate nur bei vollständigen Werten", () => {
  assert.equal(engagementRate(p(1, "a", 100, null)), null);
  assert.deepEqual(engagementRate(p(1, "a", 100, 4)), { rate: 0.04, base: "views" });
});

test("wenige Daten → vorsichtige Formulierung, keine Muster", () => {
  const s = summarize([p(1, "a", 100), p(2, "b", 200)]);
  assert.equal(s.enoughData, false);
  assert.match(s.notes[0], /Erst 2 Beiträge/);
});

test("unbekannte Views werden nicht als 0 gezählt", () => {
  const s = summarize([p(1, "a", 100), p(2, "a", null), p(3, "a", 300)]);
  assert.equal(s.medianViews, 200);
  assert.equal(s.coverage.views, 2);
  assert.ok(s.notes.some((n) => n.includes("1 von 3")));
});

test("ab genug Daten werden Formate verglichen", () => {
  const s = summarize([p(1, "Video", 1000), p(2, "Video", 800), p(3, "Foto", 100), p(4, "Foto", 200), p(5, "Foto", 150)]);
  assert.equal(s.enoughData, true);
  assert.ok(s.notes.some((n) => n.includes("„Video“")));
});
