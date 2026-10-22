// Erzeugt src/app/tokens.css aus design/tokens.json (einzige Quelle der Design-Tokens).
// Aufruf: npm run tokens
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(node, prefix, out) {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith("$") || typeof v !== "object" || v === null) continue;
    const name = [...prefix, k];
    if ("$value" in v) out.push({ name: name.join("-"), value: v.$value, dark: v.$extensions?.["de.smm.mode.dark"], type: v.$type });
    else walk(v, name, out);
  }
  return out;
}

function fmt(t, value) {
  if (t.type === "fontFamily" && Array.isArray(value)) return value.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(", ");
  return String(value);
}

export function buildCss(tokens) {
  const all = walk(tokens, [], []);
  const light = all.map((t) => `  --${t.name}: ${fmt(t, t.value)};`).join("\n");
  const dark = all.filter((t) => t.dark !== undefined).map((t) => `    --${t.name}: ${fmt(t, t.dark)};`).join("\n");
  return `/* AUTOMATISCH ERZEUGT aus design/tokens.json – nicht von Hand bearbeiten (npm run tokens). */
/* Status: Arbeitswerte, markenseitig OFFEN (siehe design/BRAND-STATUS.md). */
:root {
${light}
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
${dark}
    color-scheme: dark;
  }
}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tokens = JSON.parse(fs.readFileSync(path.join(root, "design/tokens.json"), "utf8"));
  fs.writeFileSync(path.join(root, "src/app/tokens.css"), buildCss(tokens));
  console.log("src/app/tokens.css aktualisiert.");
}
