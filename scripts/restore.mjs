// Stellt eine Sicherung wieder her. Die App muss dafür beendet sein.
// Vor dem Überschreiben wird die aktuelle Datenbank zusätzlich gesichert.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { resolveDbPath, stamp } from "./db-path.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Aufruf: npm run restore -- backups/contentkompass_<datum>.db");
  process.exit(1);
}
const source = path.resolve(file);
if (!fs.existsSync(source)) {
  console.error(`Datei nicht gefunden: ${source}`);
  process.exit(1);
}

// Prüfen, ob die Datei eine Social-Media-Manager-Datenbank ist.
try {
  const check = new Database(source, { readonly: true, fileMustExist: true });
  const tables = check.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  const ok = check.pragma("integrity_check", { simple: true });
  check.close();
  for (const t of ["accounts", "ideas", "drafts", "posts"]) {
    if (!tables.includes(t)) throw new Error(`Tabelle „${t}“ fehlt`);
  }
  if (ok !== "ok") throw new Error(`Integritätsprüfung: ${ok}`);
} catch (err) {
  console.error(`Keine gültige Social-Media-Manager-Sicherung: ${err.message}`);
  process.exit(1);
}

const target = resolveDbPath();
if (fs.existsSync(target)) {
  const safety = path.join(path.dirname(target), `vor-wiederherstellung_${stamp()}.db`);
  const cur = new Database(target, { readonly: true });
  await cur.backup(safety);
  cur.close();
  console.log(`Aktuelle Daten zusätzlich gesichert: ${safety}`);
}
for (const suffix of ["-wal", "-shm"]) {
  if (fs.existsSync(target + suffix)) fs.rmSync(target + suffix);
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`Wiederhergestellt: ${source} → ${target}`);
console.log("Jetzt die App neu starten (npm run dev oder npm start).");
