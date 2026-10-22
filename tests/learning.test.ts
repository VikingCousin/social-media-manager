import { test } from "node:test";
import assert from "node:assert/strict";
import { editStats, similarity } from "../src/lib/learning.ts";
import { suggestExperiments } from "../src/lib/experiments.ts";
import { summarize } from "../src/lib/analytics.ts";

test("Ähnlichkeit und Überarbeitungs-Kennwerte", () => {
  assert.equal(similarity("gleicher text hier", "gleicher text hier"), 1);
  const s = editStats([
    { original: "Ein langer Vorschlag mit vielen unnötigen Füllwörtern und Floskeln am Ende", final: "Kurzer eigener Satz." },
    { original: "Noch ein Vorschlag mit sehr vielen Worten und Wiederholungen", final: "Mein Satz." },
  ]);
  assert.equal(s.n, 2);
  assert.equal(s.heavilyEdited, 2);
  assert.ok(s.summary.some((x) => x.includes("kürzt")));
  assert.equal(editStats([]).n, 0);
});

test("Experimente: Datenlücke zuerst, Radar-Vorschläge als extern und unsicher markiert", () => {
  const ex = suggestExperiments(summarize([]), [], [{ key: "Karussell", n: 3 }], [{ key: "Frage", n: 4 }]);
  assert.equal(ex[0].source, "Datenlücke");
  const radar = ex.filter((e) => e.source === "Content-Radar (extern)");
  assert.equal(radar.length, 2);
  assert.ok(radar.every((e) => e.confidence === "niedrig"));
});
