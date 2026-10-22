import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCss } from "../scripts/build-tokens.mjs";

const tokens = JSON.parse(fs.readFileSync("design/tokens.json", "utf8"));

function value(path: string, mode: "light" | "dark"): string {
  let node = tokens;
  for (const k of path.split(".")) node = node[k];
  return mode === "dark" ? node.$extensions?.["de.smm.mode.dark"] ?? node.$value : node.$value;
}

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const SURFACES = ["color.bg.canvas", "color.bg.surface", "color.bg.surface-sunken"];
// [Vordergrund, Hintergründe, Mindestkontrast] nach WCAG 2.2 AA
const PAIRS: [string, string[], number][] = [
  ["color.text.primary", [...SURFACES, "color.feedback.info.bg", "color.selection.bg"], 4.5],
  ["color.text.secondary", SURFACES, 4.5],
  ["color.text.tertiary", [...SURFACES, "color.border.subtle"], 4.5],
  ["color.text.link", SURFACES, 4.5],
  ["color.action.primary.text", ["color.action.primary.bg"], 4.5],
  ["color.selection.text", ["color.selection.bg"], 4.5],
  ["color.feedback.success.text", ["color.feedback.success.bg"], 4.5],
  ["color.feedback.warning.text", ["color.feedback.warning.bg"], 4.5],
  ["color.feedback.error.text", ["color.feedback.error.bg"], 4.5],
  ["color.feedback.info.text", ["color.feedback.info.bg"], 4.5],
  ["color.border.strong", SURFACES, 3],
  ["color.focus.ring", SURFACES, 3],
  ["color.action.primary.bg", SURFACES, 3],
];

for (const mode of ["light", "dark"] as const) {
  test(`Kontrastnachweis (${mode === "light" ? "hell" : "dunkel"}): alle Paare erfüllen WCAG 2.2 AA`, () => {
    const failures: string[] = [];
    for (const [fg, bgs, min] of PAIRS) {
      for (const bg of bgs) {
        const r = contrast(value(fg, mode), value(bg, mode));
        if (r < min) failures.push(`${fg} auf ${bg}: ${r.toFixed(2)} < ${min}`);
      }
    }
    assert.deepEqual(failures, []);
  });
}

test("Kontrastformel liefert bekannte Referenzwerte", () => {
  assert.equal(contrast("#000000", "#ffffff").toFixed(1), "21.0");
  assert.equal(contrast("#777777", "#ffffff").toFixed(2), "4.48");
});

test("tokens.css ist aktuell aus design/tokens.json erzeugt (npm run tokens)", () => {
  assert.equal(fs.readFileSync("src/app/tokens.css", "utf8"), buildCss(tokens));
});

test("Typografie: Fließtext ≥ 16 px, keine Schrift unter 12 px", () => {
  assert.equal(value("text.body.md", "light"), "16px");
  const css = fs.readFileSync("src/app/globals.css", "utf8");
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)(rem|px)/g)].map((m) => (m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1])));
  assert.ok(sizes.length > 10);
  assert.deepEqual(sizes.filter((px) => px < 12), []);
  assert.match(css, /body \{[^}]*font-size: 16px/);
});

test("Markenstatus ist ehrlich: Entwurf, Arbeitswerte", () => {
  const s = tokens.$extensions["de.smm.status"];
  assert.equal(s.brandKit, "ENTWURF");
  assert.equal(s.values, "ARBEITSWERTE (OFFEN)");
});
