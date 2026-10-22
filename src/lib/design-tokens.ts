// Lesezugriff auf design/tokens.json (einzige Quelle) für Stellen außerhalb von CSS:
// App-Symbol, Web-App-Manifest und Theme-Farbe. Werte sind Arbeitswerte (markenseitig OFFEN).
import tokens from "../../design/tokens.json";

type ColorToken = { $value: string; $extensions?: { "de.smm.mode.dark"?: string } };

function pick(path: string): ColorToken {
  let node: unknown = tokens;
  for (const k of path.split(".")) node = (node as Record<string, unknown>)[k];
  if (!node || typeof (node as ColorToken).$value !== "string") throw new Error(`Token fehlt: ${path}`);
  return node as ColorToken;
}

export function color(path: string, mode: "light" | "dark" = "light"): string {
  const t = pick(path);
  return mode === "dark" ? t.$extensions?.["de.smm.mode.dark"] ?? t.$value : t.$value;
}

export const brandStatus = (tokens as { $extensions: { "de.smm.status": Record<string, string> } }).$extensions["de.smm.status"];
