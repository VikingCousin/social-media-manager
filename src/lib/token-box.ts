// Verschlüsselung von OAuth-Tokens (AES-256-GCM). Reine Funktionen, testbar.
// Format: "v1:<iv base64url>:<tag base64url>:<ciphertext base64url>"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type TokenSet = {
  access_token: string;
  refresh_token?: string | null;
  token_type?: string | null;
};

export function sealTokens(tokens: TokenSet, key: Buffer): string {
  if (key.length !== 32) throw new Error("Token-Schlüssel muss 32 Byte lang sein.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(":");
}

export function openTokens(box: string, key: Buffer): TokenSet {
  const [v, iv, tag, ct] = box.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unbekanntes Token-Format.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const pt = Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]);
  return JSON.parse(pt.toString("utf8")) as TokenSet;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
