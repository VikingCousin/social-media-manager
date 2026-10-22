import { test } from "node:test";
import assert from "node:assert/strict";
import { drivingRisk, emptyPackage, linesToList, packageGaps, parsePackageJson, parsePackageMarkdown } from "../src/lib/package.ts";
import { approvalHash } from "../src/lib/domain.ts";
import { deriveStyleTraits } from "../src/lib/voice.ts";

test("Extern erzeugtes Paket wird anhand der Überschriften in die Felder verteilt", () => {
  const md = `## Empfohlener Account
TikTok @beispiel_a (Account-ID 3)
## Warum dieser Account
Alltagsbeobachtung mit Selbstironie.
## Gesprochener Einstieg
Am ersten Tag: Hemd gebügelt.
## Text im Bild
Tag 1 vs. Tag 300
## Visuelles Anfangsmotiv
Bügeleisen in Nahaufnahme
## Roter Faden
1. Tag 1
2. Monat 3
- Heute
## Skript
Sprechtext …
## Drehort
Zu Hause vor dem Kleiderschrank
## Titel
„Tag 1 vs. Tag 300“
## Caption
Wer kennt’s?
## Offene Fragen
- Was hast du am ersten Tag getragen?
## Benötigte persönliche Beispiele
- [DEIN OUTFIT HEUTE]`;
  const r = parsePackageMarkdown(md);
  assert.match(r.account, /Account-ID 3/);
  assert.equal(r.pkg.hook_spoken, "Am ersten Tag: Hemd gebügelt.");
  assert.equal(r.pkg.hook_text, "Tag 1 vs. Tag 300");
  assert.deepEqual(r.pkg.throughline, ["Tag 1", "Monat 3", "Heute"]);
  assert.equal(r.script, "Sprechtext …");
  assert.equal(r.title, "Tag 1 vs. Tag 300");
  assert.equal(r.pkg.shoot_location, "Zu Hause vor dem Kleiderschrank");
  assert.deepEqual(r.pkg.questions, ["Was hast du am ersten Tag getragen?"]);
  assert.equal(r.unmatched, "");
});

test("Unbekannte Überschriften gehen nicht verloren", () => {
  const r = parsePackageMarkdown("Vorrede\n## Caption\nText\n");
  assert.equal(r.unmatched, "Vorrede");
  assert.equal(r.pkg.caption, "Text");
});

test("Warnung bei Drehhinweisen während der Fahrt – nicht bei geparktem Auto oder Verbot", () => {
  const p = emptyPackage();
  assert.equal(drivingRisk({ ...p, shoot_show: "Filme dich während der Fahrt auf der Autobahn." }), true);
  assert.equal(drivingRisk({ ...p, shoot_location: "Im geparkten Auto auf dem Firmenparkplatz" }), false);
  assert.equal(drivingRisk({ ...p, shoot_location: "Nie während der Fahrt filmen; zu Hause aufnehmen." }), false);
  assert.equal(drivingRisk({ ...p, shoot_say: "Ich am Steuer, Skript ablesen" }), true);
});

test("Lücken: Paket ist erst mit Einstieg, Ablauf, Drehhinweisen und Caption drehfertig", () => {
  const p = emptyPackage();
  assert.deepEqual(packageGaps(p, ""), ["Einstieg", "Roter Faden oder Skript", "Aufnahmehinweise", "Caption"]);
  const full = { ...p, hook_spoken: "x", shoot_say: "y", caption: "z", throughline: ["a"] };
  assert.deepEqual(packageGaps(full, ""), []);
  assert.ok(packageGaps({ ...full, caption: "[DEIN BEISPIEL: …]" }, "").includes("Platzhalter durch eigene Angaben ersetzen"));
});

test("Listen und JSON robust einlesen", () => {
  assert.deepEqual(linesToList("1. a\n- b\n\n• c"), ["a", "b", "c"]);
  assert.equal(parsePackageJson("kaputt"), null);
  assert.equal(parsePackageJson(JSON.stringify({ caption: "c", throughline: ["x", ""] }))!.throughline.length, 1);
});

test("Freigabe umfasst das Paket – ältere Freigaben ohne Paket bleiben gültig", () => {
  const base = { account_id: 1, format: "Kurzvideo", title: "T", body: "B", scheduled_at: null };
  assert.equal(approvalHash(base), approvalHash({ ...base, package_json: null }));
  const a = approvalHash({ ...base, package_json: JSON.stringify({ caption: "A" }) });
  const b = approvalHash({ ...base, package_json: JSON.stringify({ caption: "B" }) });
  assert.notEqual(a, b);
});

test("Sprachmerkmale nur mit Beleg aus mehreren eigenen Texten", () => {
  assert.deepEqual(deriveStyleTraits([{ text: "Nur ein einzelner Text hier drin.", source: "x" }]), []);
  const samples = [
    { text: "Beispieltext eins: Morgens trinke ich erst einen Kaffee, dann schaue ich auf den Plan.", source: "Beispiel" },
    { text: "Beispieltext zwei: Der Bus kam heute gefühlt ewig nicht, und ich stand im Regen. Lohnt sich das Warten?", source: "Beispiel" },
    { text: "Beispieltext drei: Ich habe ein neues Rezept ausprobiert. Es war einfacher als gedacht. Würde ich es wieder kochen?", source: "Beispiel" },
  ];
  const t = deriveStyleTraits(samples);
  const keys = t.map((x) => x.key);
  assert.ok(keys.includes("fragen"), "Fragen kommen in 2 Texten vor");
  assert.ok(keys.includes("keine_emojis"));
  assert.ok(keys.includes("keine_ausrufe"));
  assert.ok(t.every((x) => x.evidence.length > 0), "jedes Merkmal hat einen Beleg");
  assert.ok(!keys.includes("du_ansprache"), "kein „du“ in den Texten – darf nicht behauptet werden");
});
