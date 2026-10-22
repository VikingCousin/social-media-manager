import "server-only";
// Plattform-Verbindungen: OAuth-Austausch, Profilabruf, Token-Erneuerung, Speicherung.
// Tokens werden nur verschlüsselt gespeichert, nie geloggt und nie an den Browser gegeben.
import { getDb, nowIso } from "@/lib/db";
import {
  CALLBACK_PATH,
  PROVIDERS,
  expiresAt,
  parseScopes,
  type ProfileInfo,
  type ProviderId,
} from "@/lib/platforms";
import { openTokens, randomToken, sealTokens, type TokenSet } from "@/lib/token-box";
import { dedupKey, normalizeUrl, type MetricField } from "@/lib/csv";
import { tokenKey } from "./secrets";
import { upsertPost } from "./repo";

const TIMEOUT = 15_000;

export class ConnectionError extends Error {
  constructor(message: string, readonly kind: "konfiguration" | "abgelehnt" | "abgelaufen" | "netzwerk" | "plattform" = "plattform") {
    super(message);
  }
}

/* ---------- Konfiguration ---------- */

export type ProviderSetup = {
  configured: boolean;
  missing: string[];
  clientId: string;
  redirectBase: string;
  redirectUri: string;
  httpsOk: boolean;
  scopes: string[];
};

export function providerSetup(p: ProviderId): ProviderSetup {
  const cfg = PROVIDERS[p];
  const clientId = process.env[cfg.env.clientId]?.trim() ?? "";
  const secret = process.env[cfg.env.clientSecret]?.trim() ?? "";
  const base = (cfg.requiresHttps ? process.env.CK_HTTPS_BASE_URL : process.env.LINKEDIN_REDIRECT_BASE || "http://localhost:3210")?.trim().replace(/\/+$/, "") ?? "";
  const missing: string[] = [];
  if (!clientId) missing.push(cfg.env.clientId);
  if (!secret) missing.push(cfg.env.clientSecret);
  if (cfg.requiresHttps && !base) missing.push("CK_HTTPS_BASE_URL");
  const httpsOk = !cfg.requiresHttps || base.startsWith("https://");
  if (cfg.requiresHttps && base && !httpsOk) missing.push("CK_HTTPS_BASE_URL muss mit https:// beginnen");
  const scopes = parseScopes(process.env[cfg.env.scopes]) .length ? parseScopes(process.env[cfg.env.scopes]) : cfg.defaultScopes;
  return {
    configured: missing.length === 0,
    missing,
    clientId,
    redirectBase: base,
    redirectUri: base ? base + CALLBACK_PATH(p) : `<HTTPS-Adresse>${CALLBACK_PATH(p)}`,
    httpsOk,
    scopes,
  };
}

function secretOf(p: ProviderId) {
  const v = process.env[PROVIDERS[p].env.clientSecret]?.trim();
  if (!v) throw new ConnectionError(`${PROVIDERS[p].env.clientSecret} fehlt in .env.local.`, "konfiguration");
  return v;
}

/* ---------- OAuth-State ---------- */

export function createState(p: ProviderId, accountId: number, redirectUri: string): string {
  const state = randomToken(32);
  const now = Date.now();
  const db = getDb();
  db.prepare("DELETE FROM oauth_states WHERE expires_at < ?").run(new Date(now).toISOString());
  db.prepare("INSERT INTO oauth_states (state, provider, account_id, redirect_uri, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(state, p, accountId, redirectUri, new Date(now).toISOString(), new Date(now + 10 * 60_000).toISOString());
  return state;
}

/** Prüft und verbraucht den State (einmalig, 10 Minuten gültig, an Plattform gebunden). */
export function consumeState(p: ProviderId, state: string): { account_id: number; redirect_uri: string } {
  const db = getDb();
  const row = db.prepare("SELECT * FROM oauth_states WHERE state = ?").get(state) as
    | { provider: string; account_id: number; redirect_uri: string; expires_at: string }
    | undefined;
  if (row) db.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);
  if (!row) throw new ConnectionError("Sicherheitsprüfung fehlgeschlagen (unbekannter oder bereits verwendeter State). Bitte erneut verbinden.", "abgelehnt");
  if (row.provider !== p) throw new ConnectionError("Sicherheitsprüfung fehlgeschlagen (State gehört zu einer anderen Plattform).", "abgelehnt");
  if (Date.parse(row.expires_at) < Date.now()) throw new ConnectionError("Die Anmeldung hat zu lange gedauert (mehr als 10 Minuten). Bitte erneut verbinden.", "abgelaufen");
  return { account_id: row.account_id, redirect_uri: row.redirect_uri };
}

/* ---------- HTTP ---------- */

async function http(url: string, init: RequestInit, what: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  } catch {
    throw new ConnectionError(`${what}: keine Verbindung zur Plattform (Netzwerk oder Zeitüberschreitung).`, "netzwerk");
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const j = (json ?? {}) as Record<string, unknown>;
    const err = j.error as Record<string, unknown> | string | undefined;
    const detail =
      (typeof err === "object" && err ? (err.message as string) || (err.code as string) : (err as string)) ||
      (j.error_description as string) ||
      (j.message as string) ||
      `HTTP ${res.status}`;
    const kind = res.status === 401 ? "abgelaufen" : res.status === 403 ? "abgelehnt" : "plattform";
    throw new ConnectionError(`${what}: ${String(detail).slice(0, 200)}`, kind);
  }
  return json;
}

function form(data: Record<string, string>) {
  return { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(data).toString() };
}

/* ---------- Adapter ---------- */

type TokenResult = { tokens: TokenSet; accessExpiresAt: string | null; refreshExpiresAt: string | null; scopes: string[] };

async function exchangeCode(p: ProviderId, code: string, redirectUri: string): Promise<TokenResult> {
  const setup = providerSetup(p);
  const secret = secretOf(p);
  const now = Date.now();
  if (p === "linkedin") {
    const j = (await http("https://www.linkedin.com/oauth/v2/accessToken", form({ grant_type: "authorization_code", code, client_id: setup.clientId, client_secret: secret, redirect_uri: redirectUri }), "LinkedIn-Token")) as Record<string, unknown>;
    return {
      tokens: { access_token: String(j.access_token), refresh_token: (j.refresh_token as string) ?? null },
      accessExpiresAt: expiresAt(now, j.expires_in as number),
      refreshExpiresAt: expiresAt(now, j.refresh_token_expires_in as number),
      scopes: parseScopes(j.scope as string),
    };
  }
  if (p === "tiktok") {
    const j = (await http("https://open.tiktokapis.com/v2/oauth/token/", form({ client_key: setup.clientId, client_secret: secret, code: decodeURIComponent(code), grant_type: "authorization_code", redirect_uri: redirectUri }), "TikTok-Token")) as Record<string, unknown>;
    if (!j.access_token) throw new ConnectionError(`TikTok-Token: ${String(j.error_description ?? j.error ?? "keine Antwort")}`);
    return {
      tokens: { access_token: String(j.access_token), refresh_token: (j.refresh_token as string) ?? null },
      accessExpiresAt: expiresAt(now, j.expires_in as number),
      refreshExpiresAt: expiresAt(now, j.refresh_expires_in as number),
      scopes: parseScopes(j.scope as string),
    };
  }
  // Instagram: kurzlebigen Token holen und serverseitig gegen langlebigen (60 Tage) tauschen.
  const short = (await http("https://api.instagram.com/oauth/access_token", form({ client_id: setup.clientId, client_secret: secret, grant_type: "authorization_code", redirect_uri: redirectUri, code }), "Instagram-Token")) as Record<string, unknown>;
  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", secret);
  longUrl.searchParams.set("access_token", String(short.access_token));
  const long = (await http(longUrl.toString(), { method: "GET" }, "Instagram-Langzeit-Token")) as Record<string, unknown>;
  return {
    tokens: { access_token: String(long.access_token), refresh_token: null },
    accessExpiresAt: expiresAt(now, long.expires_in as number),
    refreshExpiresAt: null,
    scopes: parseScopes(Array.isArray(short.permissions) ? (short.permissions as string[]).join(",") : (short.permissions as string)),
  };
}

async function fetchProfile(p: ProviderId, accessToken: string): Promise<ProfileInfo> {
  const auth = { Authorization: `Bearer ${accessToken}` };
  if (p === "linkedin") {
    const j = (await http("https://api.linkedin.com/v2/userinfo", { headers: auth }, "LinkedIn-Profil")) as Record<string, string>;
    return { externalId: j.sub, name: j.name ?? [j.given_name, j.family_name].filter(Boolean).join(" "), username: "", avatarUrl: j.picture ?? "", profileUrl: "" };
  }
  if (p === "tiktok") {
    const fields = "open_id,union_id,avatar_url,display_name,username,profile_deep_link";
    const j = (await http(`https://open.tiktokapis.com/v2/user/info/?fields=${fields}`, { headers: auth }, "TikTok-Profil")) as {
      data?: { user?: Record<string, string> };
      error?: { code?: string; message?: string };
    };
    if (j.error && j.error.code && j.error.code !== "ok") throw new ConnectionError(`TikTok-Profil: ${j.error.message || j.error.code}`);
    const u = j.data?.user ?? {};
    if (!u.open_id) throw new ConnectionError("TikTok-Profil: keine open_id erhalten.");
    return { externalId: u.open_id, name: u.display_name ?? "", username: u.username ?? "", avatarUrl: u.avatar_url ?? "", profileUrl: u.profile_deep_link ?? (u.username ? `https://www.tiktok.com/@${u.username}` : "") };
  }
  const url = new URL("https://graph.instagram.com/me");
  url.searchParams.set("fields", "user_id,username,account_type,profile_picture_url");
  url.searchParams.set("access_token", accessToken);
  const j = (await http(url.toString(), { method: "GET" }, "Instagram-Profil")) as Record<string, string>;
  return { externalId: String(j.user_id ?? j.id), name: j.username ?? "", username: j.username ?? "", avatarUrl: j.profile_picture_url ?? "", profileUrl: j.username ? `https://www.instagram.com/${j.username}/` : "" };
}

async function refreshTokens(p: ProviderId, tokens: TokenSet): Promise<TokenResult | null> {
  const setup = providerSetup(p);
  const now = Date.now();
  if (p === "tiktok" && tokens.refresh_token) {
    const j = (await http("https://open.tiktokapis.com/v2/oauth/token/", form({ client_key: setup.clientId, client_secret: secretOf(p), grant_type: "refresh_token", refresh_token: tokens.refresh_token }), "TikTok-Erneuerung")) as Record<string, unknown>;
    if (!j.access_token) throw new ConnectionError("TikTok-Erneuerung fehlgeschlagen – bitte erneut autorisieren.", "abgelaufen");
    return {
      tokens: { access_token: String(j.access_token), refresh_token: (j.refresh_token as string) ?? tokens.refresh_token },
      accessExpiresAt: expiresAt(now, j.expires_in as number),
      refreshExpiresAt: expiresAt(now, j.refresh_expires_in as number),
      scopes: parseScopes(j.scope as string),
    };
  }
  if (p === "linkedin" && tokens.refresh_token) {
    // Programmatische Refresh-Tokens gibt es laut LinkedIn nur für ausgewählte Partner.
    const j = (await http("https://www.linkedin.com/oauth/v2/accessToken", form({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: setup.clientId, client_secret: secretOf(p) }), "LinkedIn-Erneuerung")) as Record<string, unknown>;
    return {
      tokens: { access_token: String(j.access_token), refresh_token: (j.refresh_token as string) ?? tokens.refresh_token },
      accessExpiresAt: expiresAt(now, j.expires_in as number),
      refreshExpiresAt: expiresAt(now, j.refresh_token_expires_in as number),
      scopes: parseScopes(j.scope as string),
    };
  }
  if (p === "instagram") {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", tokens.access_token);
    const j = (await http(url.toString(), { method: "GET" }, "Instagram-Erneuerung")) as Record<string, unknown>;
    return { tokens: { access_token: String(j.access_token), refresh_token: null }, accessExpiresAt: expiresAt(now, j.expires_in as number), refreshExpiresAt: null, scopes: [] };
  }
  return null;
}

/* ---------- Ablauf: Callback → Bestätigung → Speichern ---------- */

export type PendingConnection = {
  id: string;
  provider: ProviderId;
  account_id: number;
  external_id: string;
  external_name: string;
  external_username: string;
  avatar_url: string;
  profile_url: string;
  scopes: string;
  created_at: string;
  expires_at: string;
};

export async function completeAuthorization(p: ProviderId, code: string, state: string): Promise<string> {
  const { account_id, redirect_uri } = consumeState(p, state);
  const result = await exchangeCode(p, code, redirect_uri);
  const profile = await fetchProfile(p, result.tokens.access_token);
  const id = randomToken(18);
  const now = Date.now();
  getDb().prepare("DELETE FROM pending_connections WHERE expires_at < ?").run(new Date(now).toISOString());
  getDb()
    .prepare(`INSERT INTO pending_connections (id, provider, account_id, external_id, external_name, external_username, avatar_url, profile_url, scopes, token_box, access_expires_at, refresh_expires_at, created_at, expires_at)
      VALUES (@id, @provider, @account_id, @external_id, @external_name, @external_username, @avatar_url, @profile_url, @scopes, @token_box, @access_expires_at, @refresh_expires_at, @created_at, @expires_at)`)
    .run({
      id,
      provider: p,
      account_id,
      external_id: profile.externalId,
      external_name: profile.name,
      external_username: profile.username,
      avatar_url: profile.avatarUrl,
      profile_url: profile.profileUrl,
      scopes: result.scopes.join(" "),
      token_box: sealTokens(result.tokens, tokenKey()),
      access_expires_at: result.accessExpiresAt,
      refresh_expires_at: result.refreshExpiresAt,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + 15 * 60_000).toISOString(),
    });
  return id;
}

export function getPending(id: string): (PendingConnection & { token_box: string; access_expires_at: string | null; refresh_expires_at: string | null }) | undefined {
  const row = getDb().prepare("SELECT * FROM pending_connections WHERE id = ?").get(id) as
    | (PendingConnection & { token_box: string; access_expires_at: string | null; refresh_expires_at: string | null })
    | undefined;
  if (!row || Date.parse(row.expires_at) < Date.now()) return undefined;
  return row;
}

export function discardPending(id: string) {
  getDb().prepare("DELETE FROM pending_connections WHERE id = ?").run(id);
}

/** Ist dieses Plattform-Profil bereits einem ANDEREN Account zugeordnet? */
export function conflictingConnection(provider: string, externalId: string, accountId: number) {
  return getDb()
    .prepare("SELECT c.account_id, a.display_name, a.handle FROM connections c JOIN accounts a ON a.id = c.account_id WHERE c.provider = ? AND c.external_id = ? AND c.account_id != ?")
    .get(provider, externalId, accountId) as { account_id: number; display_name: string; handle: string } | undefined;
}

export function confirmPending(id: string): number {
  const p = getPending(id);
  if (!p) throw new ConnectionError("Die Bestätigung ist abgelaufen (15 Minuten). Bitte erneut verbinden.", "abgelaufen");
  const conflict = conflictingConnection(p.provider, p.external_id, p.account_id);
  if (conflict) throw new ConnectionError(`Dieses Profil ist bereits mit „${conflict.display_name}“ verbunden. Ein Profil kann nur einem Account zugeordnet sein.`, "abgelehnt");
  const db = getDb();
  const now = nowIso();
  db.transaction(() => {
    db.prepare(`INSERT INTO connections (account_id, provider, external_id, external_name, external_username, avatar_url, profile_url, scopes, token_box, access_expires_at, refresh_expires_at, status, last_sync_at, last_error, last_error_at, connected_at, updated_at)
        VALUES (@account_id, @provider, @external_id, @external_name, @external_username, @avatar_url, @profile_url, @scopes, @token_box, @access_expires_at, @refresh_expires_at, 'verbunden', @now, NULL, NULL, @now, @now)
        ON CONFLICT(account_id) DO UPDATE SET provider=excluded.provider, external_id=excluded.external_id, external_name=excluded.external_name,
          external_username=excluded.external_username, avatar_url=excluded.avatar_url, profile_url=excluded.profile_url, scopes=excluded.scopes,
          token_box=excluded.token_box, access_expires_at=excluded.access_expires_at, refresh_expires_at=excluded.refresh_expires_at,
          status='verbunden', last_sync_at=excluded.last_sync_at, last_error=NULL, last_error_at=NULL, updated_at=excluded.updated_at`)
      .run({ ...p, now });
    db.prepare("UPDATE accounts SET api_status = 'verbunden', updated_at = ? WHERE id = ?").run(now, p.account_id);
    db.prepare("DELETE FROM pending_connections WHERE id = ?").run(id);
  })();
  return p.account_id;
}

/* ---------- Verbindungen lesen, prüfen, trennen ---------- */

export type Connection = {
  id: number;
  account_id: number;
  provider: ProviderId;
  external_id: string;
  external_name: string;
  external_username: string;
  avatar_url: string;
  profile_url: string;
  scopes: string;
  access_expires_at: string | null;
  refresh_expires_at: string | null;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  connected_at: string;
  updated_at: string;
  has_refresh: boolean;
};

const PUBLIC_COLS = "id, account_id, provider, external_id, external_name, external_username, avatar_url, profile_url, scopes, access_expires_at, refresh_expires_at, status, last_sync_at, last_error, last_error_at, connected_at, updated_at, (refresh_expires_at IS NOT NULL) AS has_refresh";

export function listConnections(): Connection[] {
  return (getDb().prepare(`SELECT ${PUBLIC_COLS} FROM connections`).all() as Connection[]).map((c) => ({ ...c, has_refresh: Boolean(c.has_refresh) }));
}

export function getConnectionByAccount(accountId: number): Connection | undefined {
  const c = getDb().prepare(`SELECT ${PUBLIC_COLS} FROM connections WHERE account_id = ?`).get(accountId) as Connection | undefined;
  return c ? { ...c, has_refresh: Boolean(c.has_refresh) } : undefined;
}

function loadTokens(accountId: number): TokenSet {
  const row = getDb().prepare("SELECT token_box FROM connections WHERE account_id = ?").get(accountId) as { token_box: string } | undefined;
  if (!row) throw new ConnectionError("Nicht verbunden.", "konfiguration");
  try {
    return openTokens(row.token_box, tokenKey());
  } catch {
    throw new ConnectionError("Gespeicherte Zugangsdaten lassen sich nicht entschlüsseln (Schlüssel geändert?). Bitte erneut autorisieren.", "abgelaufen");
  }
}

function recordError(accountId: number, err: ConnectionError) {
  const now = nowIso();
  getDb()
    .prepare("UPDATE connections SET status = ?, last_error = ?, last_error_at = ?, updated_at = ? WHERE account_id = ?")
    .run(err.kind === "abgelaufen" ? "abgelaufen" : "fehler", err.message, now, now, accountId);
}

/** Liefert einen gültigen Access-Token; erneuert ihn bei Bedarf (TikTok, Instagram, ggf. LinkedIn). */
async function validAccessToken(c: Connection): Promise<string> {
  const tokens = loadTokens(c.account_id);
  const left = c.access_expires_at ? Date.parse(c.access_expires_at) - Date.now() : Infinity;
  const igOldEnough = c.provider === "instagram" && Date.now() - Date.parse(c.updated_at) > 24 * 3600_000;
  const needsRefresh = left < 3600_000 || (c.provider === "instagram" && igOldEnough && left < 30 * 86_400_000);
  if (!needsRefresh) return tokens.access_token;
  if (left <= 0 && !c.has_refresh && c.provider !== "instagram") {
    throw new ConnectionError("Der Zugriff ist abgelaufen. Bitte erneut autorisieren.", "abgelaufen");
  }
  const r = await refreshTokens(c.provider, tokens);
  if (!r) {
    if (left <= 0) throw new ConnectionError("Der Zugriff ist abgelaufen. Bitte erneut autorisieren.", "abgelaufen");
    return tokens.access_token;
  }
  getDb()
    .prepare("UPDATE connections SET token_box = ?, access_expires_at = ?, refresh_expires_at = COALESCE(?, refresh_expires_at), scopes = CASE WHEN ? != '' THEN ? ELSE scopes END, updated_at = ? WHERE account_id = ?")
    .run(sealTokens(r.tokens, tokenKey()), r.accessExpiresAt, r.refreshExpiresAt, r.scopes.join(" "), r.scopes.join(" "), nowIso(), c.account_id);
  return r.tokens.access_token;
}

export type SyncReport = { profileOk: boolean; postsImported: { neu: number; aktualisiert: number; unveraendert: number } | null; note: string };

/** Prüft die Verbindung (Profil abrufen) und liest – wo erlaubt – eigene Beiträge mit Kennzahlen. */
export async function syncConnection(accountId: number): Promise<SyncReport> {
  const c = getConnectionByAccount(accountId);
  if (!c) throw new ConnectionError("Dieser Account ist nicht verbunden.", "konfiguration");
  try {
    const token = await validAccessToken(c);
    const profile = await fetchProfile(c.provider, token);
    if (profile.externalId !== c.external_id) {
      throw new ConnectionError("Die Plattform meldet ein anderes Profil als gespeichert. Bitte Verbindung trennen und neu verbinden.", "abgelehnt");
    }
    let postsImported: SyncReport["postsImported"] = null;
    let note = "Identität bestätigt.";
    if (c.provider === "tiktok" && parseScopes(c.scopes).includes("video.list")) {
      postsImported = await importTikTokVideos(c, token);
      note = `Identität bestätigt, ${postsImported.neu} neue und ${postsImported.aktualisiert} aktualisierte Videos übernommen.`;
    } else if (c.provider === "linkedin") {
      note = "Identität bestätigt. Beiträge und Kennzahlen sind bei LinkedIn für Einzelpersonen gesperrt.";
    }
    const now = nowIso();
    getDb()
      .prepare("UPDATE connections SET external_name = ?, external_username = ?, avatar_url = ?, profile_url = COALESCE(NULLIF(?, ''), profile_url), status = 'verbunden', last_sync_at = ?, last_error = NULL, last_error_at = NULL, updated_at = ? WHERE account_id = ?")
      .run(profile.name, profile.username, profile.avatarUrl, profile.profileUrl, now, now, accountId);
    return { profileOk: true, postsImported, note };
  } catch (err) {
    const e = err instanceof ConnectionError ? err : new ConnectionError("Unerwarteter Fehler bei der Synchronisierung.");
    recordError(accountId, e);
    throw e;
  }
}

async function importTikTokVideos(c: Connection, token: string) {
  const fields = "id,create_time,share_url,title,video_description,duration,view_count,like_count,comment_count,share_count";
  const counts = { neu: 0, aktualisiert: 0, unveraendert: 0 };
  let cursor: number | undefined;
  for (let page = 0; page < 5; page++) {
    const j = (await http(`https://open.tiktokapis.com/v2/video/list/?fields=${fields}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cursor ? { max_count: 20, cursor } : { max_count: 20 }),
    }, "TikTok-Videos")) as { data?: { videos?: Record<string, unknown>[]; cursor?: number; has_more?: boolean }; error?: { code?: string; message?: string } };
    if (j.error && j.error.code && j.error.code !== "ok") throw new ConnectionError(`TikTok-Videos: ${j.error.message || j.error.code}`);
    for (const v of j.data?.videos ?? []) {
      const url = normalizeUrl(String(v.share_url ?? ""));
      const published_at = typeof v.create_time === "number" ? new Date(v.create_time * 1000).toISOString() : null;
      const topic = String(v.title || v.video_description || "").slice(0, 200);
      const metrics = {
        views: num(v.view_count), reach: null, likes: num(v.like_count), comments: num(v.comment_count), shares: num(v.share_count),
        saves: null, watch_time_seconds: null, follower_gain: null,
      } as Record<MetricField, number | null>;
      const key = url ? dedupKey({ account_id: c.account_id, url, published_at, format: "Kurzvideo", topic }) : `tiktok:${v.id}`;
      const r = upsertPost({ account_id: c.account_id, published_at, format: "Kurzvideo", topic, url, dedup_key: key, metrics }, "api");
      counts[r.outcome]++;
    }
    if (!j.data?.has_more) break;
    cursor = j.data.cursor;
  }
  return counts;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Trennt die Verbindung: Token wird – wo möglich – bei der Plattform widerrufen und lokal gelöscht. */
export async function disconnect(accountId: number): Promise<{ revokedRemote: boolean; hint: string }> {
  const c = getConnectionByAccount(accountId);
  if (!c) return { revokedRemote: false, hint: "" };
  let revokedRemote = false;
  let hint = "";
  if (c.provider === "tiktok") {
    try {
      const t = loadTokens(accountId);
      await http("https://open.tiktokapis.com/v2/oauth/revoke/", form({ client_key: providerSetup("tiktok").clientId, client_secret: secretOf("tiktok"), token: t.access_token }), "TikTok-Widerruf");
      revokedRemote = true;
    } catch {
      hint = "Der Widerruf bei TikTok hat nicht geklappt; der lokale Zugang ist trotzdem gelöscht. Entferne die App ggf. in den TikTok-Einstellungen.";
    }
  } else {
    hint = `Der lokale Zugang ist gelöscht. Um den Zugriff auch bei ${PROVIDERS[c.provider].label} zu entziehen, entferne die App in den Konto-Einstellungen unter den verbundenen bzw. berechtigten Apps.`;
  }
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM connections WHERE account_id = ?").run(accountId);
    db.prepare("UPDATE accounts SET api_status = 'nicht_verbunden', updated_at = ? WHERE id = ?").run(nowIso(), accountId);
  })();
  return { revokedRemote, hint };
}

/** Nur für die LinkedIn-Vorschau: Person-ID der Verbindung (kein Token). */
export function linkedInPersonId(accountId: number): string | null {
  const c = getConnectionByAccount(accountId);
  return c && c.provider === "linkedin" ? c.external_id : null;
}
