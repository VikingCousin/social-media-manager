import "server-only";
// Schlüssel für die Token-Verschlüsselung. Reihenfolge:
// 1. CK_TOKEN_KEY (base64, 32 Byte) aus .env.local
// 2. sonst data/token.key – wird beim ersten Bedarf zufällig erzeugt (Dateirechte 600, nicht in Git, nicht im Backup-Ordner).
// Ohne diesen Schlüssel sind gespeicherte Tokens wertlos; nach einem Verlust müssen die Accounts neu verbunden werden.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { dbPath } from "@/lib/db";

let cached: Buffer | null = null;

export function keyFilePath() {
  return path.join(path.dirname(dbPath()), "token.key");
}

export function tokenKey(): Buffer {
  if (cached) return cached;
  const fromEnv = process.env.CK_TOKEN_KEY?.trim();
  if (fromEnv) {
    const k = Buffer.from(fromEnv, "base64");
    if (k.length !== 32) throw new Error("CK_TOKEN_KEY muss 32 Byte (base64) lang sein.");
    cached = k;
    return k;
  }
  const file = keyFilePath();
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600 });
  }
  const k = Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64");
  if (k.length !== 32) throw new Error(`Token-Schlüssel in ${file} ist ungültig.`);
  cached = k;
  return k;
}

export function tokenKeySource(): "umgebung" | "datei" {
  return process.env.CK_TOKEN_KEY?.trim() ? "umgebung" : "datei";
}
