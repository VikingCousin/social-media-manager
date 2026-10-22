import { test } from "node:test";
import assert from "node:assert/strict";
import { localInputToUtc, parseFlexibleDate, utcToLocalInput } from "../src/lib/time.ts";

test("Berliner Ortszeit ↔ UTC (Sommer- und Winterzeit)", () => {
  assert.equal(localInputToUtc("2026-07-01T09:00"), "2026-07-01T07:00:00.000Z");
  assert.equal(localInputToUtc("2026-12-01T09:00"), "2026-12-01T08:00:00.000Z");
  assert.equal(utcToLocalInput("2026-07-01T07:00:00.000Z"), "2026-07-01T09:00");
  assert.equal(utcToLocalInput("2026-12-01T08:00:00.000Z"), "2026-12-01T09:00");
});

test("Rundreise über die Zeitumstellung", () => {
  for (const v of ["2026-03-29T01:30", "2026-03-29T03:30", "2026-10-25T01:30", "2026-10-25T03:30"]) {
    assert.equal(utcToLocalInput(localInputToUtc(v)), v);
  }
});

test("flexible Datumsformate", () => {
  assert.equal(parseFlexibleDate("01.09.2026 18:30"), "2026-09-01T16:30:00.000Z");
  assert.equal(parseFlexibleDate("2026-09-01T18:30:00Z"), "2026-09-01T18:30:00.000Z");
  assert.equal(parseFlexibleDate("31.02.2026"), null);
  assert.equal(parseFlexibleDate("gestern"), null);
});
