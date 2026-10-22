// Erstellt eine konsistente Kopie der SQLite-Datenbank (auch während die App läuft).
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { resolveDbPath, stamp } from "./db-path.mjs";

const src = resolveDbPath();
if (!fs.existsSync(src)) {
  console.error(`Keine Datenbank gefunden unter ${src}. Wurde die App schon einmal gestartet?`);
  process.exit(1);
}
const outDir = path.resolve(process.argv[2] || path.join(process.cwd(), "backups"));
fs.mkdirSync(outDir, { recursive: true });
const target = path.join(outDir, `contentkompass_${stamp()}.db`);
const db = new Database(src, { readonly: true, fileMustExist: true });
await db.backup(target);
db.close();
console.log(`Backup erstellt: ${target}`);
