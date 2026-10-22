import path from "node:path";
import fs from "node:fs";

// Liest CONTENTKOMPASS_DB auch aus .env.local, damit Skripte dieselbe Datei wie die App verwenden.
export function resolveDbPath() {
  let fromEnv = process.env.CONTENTKOMPASS_DB;
  const envFile = path.join(process.cwd(), ".env.local");
  if (!fromEnv && fs.existsSync(envFile)) {
    const m = /^CONTENTKOMPASS_DB=(.+)$/m.exec(fs.readFileSync(envFile, "utf8"));
    if (m) fromEnv = m[1].trim().replace(/^["']|["']$/g, "");
  }
  return path.resolve(fromEnv || path.join(process.cwd(), "data", "contentkompass.db"));
}

export function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}
