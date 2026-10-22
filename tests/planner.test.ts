import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTasks, recommendNext, type PlannerInput } from "../src/lib/planner.ts";

const base: PlannerInput = {
  now: "2026-10-14T10:00:00.000Z",
  accounts: [
    { id: 1, label: "LinkedIn", gaps: ["Zielgruppe"] },
    { id: 2, label: "Instagram", gaps: [] },
  ],
  drafts: [],
  ideas: [],
  lastPublished: {},
  postsWithMetrics: {},
};

test("leere Pipeline ergibt keine erfundene Empfehlung", () => {
  assert.deepEqual(recommendNext(base), []);
});

test("geplanter Beitrag schlägt Ideen; Gründe tragen Quellen, Lücken werden genannt", () => {
  const r = recommendNext({
    ...base,
    drafts: [
      { id: 7, account_id: 1, title: "Planung", body: "Text [DEIN BEISPIEL: …]", format: "", status: "geplant", scheduled_at: "2026-10-15T07:00:00.000Z", approval_valid: true, idea_id: null },
    ],
    ideas: [{ id: 3, title: "Idee", body: "x", account_ids: [2], coach: null, has_draft: false }],
  });
  assert.equal(r[0].key, "d7");
  assert.equal(r[0].reasons[0].source, "Redaktionsplan");
  assert.ok(r[0].missing.some((m) => m.includes("Platzhalter")));
  assert.ok(r[0].missing.some((m) => m.includes("Zielgruppe")));
  assert.ok(r[0].uncertainty.some((u) => u.includes("Planungsstand")));
  assert.equal(r[1].key, "i3");
});

test("Coach-Empfehlung wird als vorläufig und mit offenen Fragen ausgewiesen", () => {
  const [r] = recommendNext({
    ...base,
    ideas: [{ id: 1, title: "", body: "Gedanke", account_ids: [], coach: { account_id: 2, provisional: true, questions: ["Welches Projekt?"], created_at: "" }, has_draft: false }],
  });
  assert.equal(r.account_id, 2);
  assert.equal(r.reasons[0].source, "KI-Coach");
  assert.ok(r.uncertainty.some((u) => u.includes("vorläufig")));
  assert.ok(r.missing.some((m) => m.includes("Welches Projekt?")));
});

test("lange Pause auf einem Account wird mit Quelle eigene Daten begründet", () => {
  const [r] = recommendNext({
    ...base,
    lastPublished: { 2: "2026-09-20T10:00:00.000Z" },
    ideas: [{ id: 1, title: "", body: "x", account_ids: [2], coach: null, has_draft: false }],
  });
  assert.ok(r.reasons.some((x) => x.source === "Eigene Daten" && x.text.includes("24 Tagen")));
});

test("Aufgaben: Überfälliges zuerst, offene Freigaben, fehlende Kennzahlen", () => {
  const tasks = buildTasks({
    now: base.now,
    accounts: base.accounts,
    drafts: [
      { id: 1, account_id: 1, title: "Alt", body: "x", format: "", status: "geplant", scheduled_at: "2026-10-10T07:00:00.000Z", approval_valid: true, idea_id: null },
      { id: 2, account_id: 1, title: "Neu", body: "x", format: "", status: "bereit", scheduled_at: null, approval_valid: false, idea_id: null },
    ],
    postsMissingMetrics: [{ id: 9, title: "Post", published_at: "2026-10-01T00:00:00.000Z" }],
    staleProfiles: [],
    unassignedOldIdeas: 0,
  });
  assert.match(tasks[0].text, /war geplant/);
  assert.match(tasks[1].text, /freigeben/);
  assert.ok(tasks.some((t) => t.text.includes("Kennzahlen")));
});
