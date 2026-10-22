import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { openTokens, sealTokens } from "../src/lib/token-box.ts";
import {
  PROVIDERS,
  buildAuthorizeUrl,
  checkMatch,
  connectionState,
  escapeLittleText,
  linkedInPostRequest,
  linkedInReadiness,
  parseScopes,
} from "../src/lib/platforms.ts";

test("Tokens werden verschlüsselt und nur mit dem richtigen Schlüssel lesbar", () => {
  const key = randomBytes(32);
  const box = sealTokens({ access_token: "geheim-123", refresh_token: "r-456" }, key);
  assert.ok(!box.includes("geheim-123"), "Klartext darf nicht im Speicherformat stehen");
  assert.deepEqual(openTokens(box, key), { access_token: "geheim-123", refresh_token: "r-456" });
  assert.throws(() => openTokens(box, randomBytes(32)));
  const tampered = box.slice(0, -2) + (box.endsWith("A") ? "BB" : "AA");
  assert.throws(() => openTokens(tampered, key), "manipulierte Daten werden erkannt");
  assert.notEqual(sealTokens({ access_token: "x" }, key), sealTokens({ access_token: "x" }, key), "zufälliger IV");
});

test("Autorisierungs-URLs entsprechen der jeweiligen Plattform", () => {
  const li = new URL(buildAuthorizeUrl(PROVIDERS.linkedin, { clientId: "cid", redirectUri: "http://localhost:3210/api/oauth/linkedin/callback", state: "s1", scopes: ["openid", "profile", "w_member_social"] }));
  assert.equal(li.origin + li.pathname, "https://www.linkedin.com/oauth/v2/authorization");
  assert.equal(li.searchParams.get("client_id"), "cid");
  assert.equal(li.searchParams.get("scope"), "openid profile w_member_social");
  assert.equal(li.searchParams.get("state"), "s1");
  assert.equal(li.searchParams.get("response_type"), "code");

  const tt = new URL(buildAuthorizeUrl(PROVIDERS.tiktok, { clientId: "ck", redirectUri: "https://x.ts.net/api/oauth/tiktok/callback", state: "s2", scopes: ["user.info.basic", "user.info.profile"] }));
  assert.equal(tt.searchParams.get("client_key"), "ck");
  assert.equal(tt.searchParams.get("client_id"), null);
  assert.equal(tt.searchParams.get("scope"), "user.info.basic,user.info.profile");
  assert.equal(tt.searchParams.get("disable_auto_auth"), "1", "Kontowahl immer zeigen");

  const ig = new URL(buildAuthorizeUrl(PROVIDERS.instagram, { clientId: "ig", redirectUri: "https://x.ts.net/api/oauth/instagram/callback", state: "s3", scopes: ["instagram_business_basic"] }));
  assert.equal(ig.searchParams.get("force_reauth"), "true");
});

test("Scopes aus Komma- oder Leerzeichenlisten", () => {
  assert.deepEqual(parseScopes("openid profile,w_member_social"), ["openid", "profile", "w_member_social"]);
  assert.deepEqual(parseScopes(undefined), []);
});

test("Profilabgleich verhindert Verwechslung der beiden TikTok-Accounts", () => {
  const tiktok1 = { platform: "tiktok", handle: "@beispiel_a", display_name: "Beispielkanal A" };
  const profile = (username: string) => ({ externalId: "o1", name: "x", username, avatarUrl: "", profileUrl: "" });
  assert.equal(checkMatch(tiktok1, profile("beispiel_a")).level, "passt");
  assert.equal(checkMatch(tiktok1, profile("@Beispiel_A")).level, "passt");
  const wrong = checkMatch(tiktok1, profile("beispiel_b"));
  assert.equal(wrong.level, "abweichung");
  assert.match(wrong.message, /@beispiel_b.*@beispiel_a/);
  assert.equal(checkMatch(tiktok1, profile("")).level, "unklar");
  const li = { platform: "linkedin", handle: "beispiel-profil", display_name: "Beispiel LinkedIn" };
  assert.equal(checkMatch(li, { externalId: "s", name: "Beispiel LinkedIn", username: "", avatarUrl: "", profileUrl: "" }).level, "passt");
  assert.equal(checkMatch(li, { externalId: "s", name: "Jemand Anders", username: "", avatarUrl: "", profileUrl: "" }).level, "abweichung");
});

test("Verbindungsstatus berücksichtigt Ablauf und Erneuerbarkeit", () => {
  const now = "2026-10-15T12:00:00.000Z";
  const base = { status: "verbunden", refresh_expires_at: null, has_refresh: false };
  assert.equal(connectionState({ ...base, access_expires_at: "2026-12-01T00:00:00.000Z" }, now), "verbunden");
  assert.equal(connectionState({ ...base, access_expires_at: "2026-10-18T00:00:00.000Z" }, now), "laeuft_ab");
  assert.equal(connectionState({ ...base, access_expires_at: "2026-10-01T00:00:00.000Z" }, now), "abgelaufen");
  // TikTok: Access-Token abgelaufen, Refresh-Token noch gültig → wird erneuert
  assert.equal(connectionState({ status: "verbunden", access_expires_at: "2026-10-14T00:00:00.000Z", refresh_expires_at: "2027-10-14T00:00:00.000Z", has_refresh: true }, now), "verbunden");
  assert.equal(connectionState({ ...base, status: "fehler", access_expires_at: null }, now), "fehler");
});

test("LinkedIn: Text wird für das little-Format maskiert, Autor ist die Person-URN", () => {
  assert.equal(escapeLittleText("KI (mit #Hashtag) & @Name [Link] *fett*"), "KI \\(mit \\#Hashtag\\) & \\@Name \\[Link\\] \\*fett\\*");
  const r = linkedInPostRequest("abc123", "Hallo", "202609");
  assert.equal(r.body.author, "urn:li:person:abc123");
  assert.equal(r.headers["Linkedin-Version"], "202609");
  assert.ok(!JSON.stringify(r).match(/Bearer [A-Za-z0-9]{10,}/), "Vorschau enthält keinen echten Token");
});

test("LinkedIn-Prüfliste blockiert ohne Freigabe, Berechtigung oder mit Platzhaltern", () => {
  const ok = linkedInReadiness({ connected: true, state: "verbunden", scopes: ["openid", "profile", "w_member_social"], approvalValid: true, text: "Text", hasPlaceholder: false });
  assert.ok(ok.every((c) => c.ok));
  const bad = linkedInReadiness({ connected: true, state: "verbunden", scopes: ["openid", "profile"], approvalValid: false, text: "x".repeat(3001), hasPlaceholder: true });
  assert.equal(bad.filter((c) => !c.ok).length, 4);
});
