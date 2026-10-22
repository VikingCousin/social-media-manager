// Plattform-Verbindungen: Konfiguration, Fähigkeiten und reine Hilfsfunktionen (testbar, ohne Netzwerk).
// Quellen und Prüfdatum stehen in docs/ROADMAP-INTEGRATIONEN.md und docs/VERBINDUNGEN.md.

export type ProviderId = "linkedin" | "tiktok" | "instagram";

export type CapabilityKey = "identitaet" | "eigene_daten" | "veroeffentlichen" | "fremde_profile";
export type CapabilityState = "verfuegbar" | "vorbereitet" | "gesperrt" | "nicht_verfuegbar";

export const CAPABILITY_LABELS: Record<CapabilityKey, string> = {
  identitaet: "Identität verbinden",
  eigene_daten: "Eigene Beiträge und Kennzahlen lesen",
  veroeffentlichen: "Nach Freigabe veröffentlichen",
  fremde_profile: "Fremde öffentliche Profile analysieren",
};

export const CAPABILITY_STATE_LABELS: Record<CapabilityState, string> = {
  verfuegbar: "verfügbar",
  vorbereitet: "vorbereitet",
  gesperrt: "gesperrt",
  nicht_verfuegbar: "nicht verfügbar",
};

export type Capability = { state: CapabilityState; detail: string; needs?: string };

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  authorizeUrl: string;
  scopeSeparator: " " | ",";
  defaultScopes: string[];
  /** Laut offizieller Doku ist eine HTTPS-Callback-Adresse Pflicht. */
  requiresHttps: boolean;
  env: { clientId: string; clientSecret: string; scopes: string };
  devPortal: string;
  capabilities: Record<CapabilityKey, Capability>;
};

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    scopeSeparator: " ",
    defaultScopes: ["openid", "profile", "w_member_social"],
    // Doku verlangt HTTPS; LinkedIns eigene Beispiel-App registriert http://localhost:8080/login.
    requiresHttps: false,
    env: { clientId: "LINKEDIN_CLIENT_ID", clientSecret: "LINKEDIN_CLIENT_SECRET", scopes: "LINKEDIN_SCOPES" },
    devPortal: "https://www.linkedin.com/developers/apps",
    capabilities: {
      identitaet: { state: "verfuegbar", detail: "OpenID Connect: Name, Profilbild und Mitglieds-ID.", needs: "Produkt „Sign In with LinkedIn using OpenID Connect“ (Scopes openid, profile)" },
      eigene_daten: { state: "gesperrt", detail: "Eigene Beiträge lesen (r_member_social) ist laut LinkedIn eingeschränkt und nur für freigegebene Nutzer; Kennzahlen (r_member_postAnalytics) erfordern einen gesonderten Zugang. Bis dahin: manuell oder per CSV.", needs: "Freischaltung durch LinkedIn" },
      veroeffentlichen: { state: "vorbereitet", detail: "Posts API mit w_member_social. Freigabe-Prüfung und Vorschau der Anfrage sind eingebaut; das Senden ist noch nicht freigeschaltet.", needs: "Produkt „Share on LinkedIn“ (Scope w_member_social)" },
      fremde_profile: { state: "nicht_verfuegbar", detail: "Keine offizielle API zum Lesen fremder Profile für Einzelpersonen bekannt. Fremde Beiträge erfasst du manuell im Content-Radar." },
    },
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    scopeSeparator: ",",
    defaultScopes: ["user.info.basic", "user.info.profile"],
    requiresHttps: true,
    env: { clientId: "TIKTOK_CLIENT_KEY", clientSecret: "TIKTOK_CLIENT_SECRET", scopes: "TIKTOK_SCOPES" },
    devPortal: "https://developers.tiktok.com/apps/",
    capabilities: {
      identitaet: { state: "verfuegbar", detail: "Login Kit: open_id, Anzeigename, Benutzername, Profilbild. Jeder der beiden Accounts wird einzeln autorisiert.", needs: "Login Kit mit user.info.basic und user.info.profile, HTTPS-Callback" },
      eigene_daten: { state: "vorbereitet", detail: "Eigene Videos mit Views, Likes, Kommentaren, Shares über video.list; wird beim Synchronisieren in „Performance“ übernommen, sobald der Scope erteilt ist.", needs: "Scope video.list (optional user.info.stats)" },
      veroeffentlichen: { state: "gesperrt", detail: "Content Posting API: Beiträge nicht geprüfter Apps sind nur privat sichtbar; öffentliches Posten erst nach TikTok-Audit.", needs: "Content Posting API + Audit durch TikTok" },
      fremde_profile: { state: "nicht_verfuegbar", detail: "Fremde Profile sind über Login Kit nicht abrufbar (Research API nur für Forschende, ungeprüft). Manuell im Content-Radar." },
    },
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    authorizeUrl: "https://www.instagram.com/oauth/authorize",
    scopeSeparator: ",",
    defaultScopes: ["instagram_business_basic"],
    requiresHttps: true,
    env: { clientId: "INSTAGRAM_APP_ID", clientSecret: "INSTAGRAM_APP_SECRET", scopes: "INSTAGRAM_SCOPES" },
    devPortal: "https://developers.facebook.com/apps/",
    capabilities: {
      identitaet: { state: "gesperrt", detail: "Die Instagram-API funktioniert nur mit professionellen Konten. Ein privates Konto müsste dafür umgestellt werden – das entscheidest du selbst.", needs: "Professionelles Konto (macht das Konto öffentlich), Meta-App, HTTPS-Callback" },
      eigene_daten: { state: "gesperrt", detail: "Insights eigener Beiträge erst nach Umstellung und Verbindung.", needs: "instagram_business_manage_insights" },
      veroeffentlichen: { state: "gesperrt", detail: "Veröffentlichen erfordert öffentlich per URL erreichbare Medien – für eine lokale App derzeit nicht erfüllt.", needs: "instagram_business_content_publish + öffentliches Medien-Hosting" },
      fremde_profile: { state: "gesperrt", detail: "Business Discovery liest öffentliche Daten fremder Business-/Creator-Konten, braucht aber den Zugang über Facebook Login.", needs: "Professionelles Konto + Facebook Login + Berechtigungen" },
    },
  },
};

export const CALLBACK_PATH = (p: ProviderId) => `/api/oauth/${p}/callback`;

export function providerForPlatform(platform: string): ProviderId | null {
  return platform === "linkedin" || platform === "tiktok" || platform === "instagram" ? platform : null;
}

export function buildAuthorizeUrl(
  p: ProviderConfig,
  o: { clientId: string; redirectUri: string; state: string; scopes: string[] },
): string {
  const u = new URL(p.authorizeUrl);
  u.searchParams.set(p.id === "tiktok" ? "client_key" : "client_id", o.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", o.redirectUri);
  u.searchParams.set("state", o.state);
  u.searchParams.set("scope", o.scopes.join(p.scopeSeparator));
  // TikTok: Autorisierungsseite immer zeigen, damit bewusst das richtige Konto gewählt wird.
  if (p.id === "tiktok") u.searchParams.set("disable_auto_auth", "1");
  // Instagram: Login erzwingen, damit nicht versehentlich ein anderes Konto übernommen wird.
  if (p.id === "instagram") u.searchParams.set("force_reauth", "true");
  return u.toString();
}

export function parseScopes(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ---------- Zuordnung prüfen: richtiges Profil? ---------- */

export type ProfileInfo = { externalId: string; name: string; username: string; avatarUrl: string; profileUrl: string };
export type MatchResult = { level: "passt" | "abweichung" | "unklar"; message: string };

function norm(s: string) {
  return s.trim().toLowerCase().replace(/^@/, "");
}

export function checkMatch(
  account: { platform: string; handle: string; display_name: string },
  profile: ProfileInfo,
): MatchResult {
  const handle = norm(account.handle);
  if (profile.username) {
    if (handle && norm(profile.username) === handle) return { level: "passt", message: `Benutzername @${norm(profile.username)} stimmt mit dem Account überein.` };
    if (handle && account.platform !== "linkedin") {
      return { level: "abweichung", message: `Verbunden wurde @${norm(profile.username)}, erwartet war @${handle}. Prüfe, ob du im richtigen Konto angemeldet warst.` };
    }
  }
  if (account.platform === "linkedin") {
    const a = norm(account.display_name);
    const b = norm(profile.name);
    if (a && b && a === b) return { level: "passt", message: `Name „${profile.name}“ stimmt mit dem Account überein.` };
    if (a && b) return { level: "abweichung", message: `Verbunden wurde „${profile.name}“, erwartet war „${account.display_name}“.` };
  }
  return { level: "unklar", message: "Das Profil liefert keinen Benutzernamen zum Abgleich – bitte anhand von Name und Bild prüfen." };
}

/* ---------- Verbindungsstatus ---------- */

export type ConnState = "verbunden" | "laeuft_ab" | "abgelaufen" | "fehler";

export const CONN_STATE_LABELS: Record<ConnState, string> = {
  verbunden: "verbunden",
  laeuft_ab: "läuft bald ab",
  abgelaufen: "abgelaufen – erneut autorisieren",
  fehler: "Fehler",
};

export function connectionState(
  c: { status: string; access_expires_at: string | null; refresh_expires_at: string | null; has_refresh: boolean },
  nowIso: string,
): ConnState {
  if (c.status === "fehler") return "fehler";
  const now = Date.parse(nowIso);
  const accessLeft = c.access_expires_at ? Date.parse(c.access_expires_at) - now : Infinity;
  const refreshLeft = c.refresh_expires_at ? Date.parse(c.refresh_expires_at) - now : c.has_refresh ? Infinity : -1;
  if (accessLeft <= 0 && refreshLeft <= 0) return "abgelaufen";
  if (accessLeft <= 0 && refreshLeft > 0) return "verbunden"; // wird beim nächsten Zugriff erneuert
  const soon = 7 * 86_400_000;
  if (accessLeft < soon && refreshLeft <= 0) return "laeuft_ab";
  return "verbunden";
}

export function expiresAt(nowMs: number, seconds: number | null | undefined): string | null {
  return typeof seconds === "number" && seconds > 0 ? new Date(nowMs + seconds * 1000).toISOString() : null;
}

/* ---------- LinkedIn: Veröffentlichung vorbereiten (wird noch nicht gesendet) ---------- */

/** Escaping für LinkedIns „little“-Textformat (commentary der Posts API). */
export function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => `\\${c}`);
}

export const LINKEDIN_COMMENTARY_MAX = 3000;

export function linkedInPostRequest(personId: string, text: string, apiVersion: string) {
  return {
    method: "POST",
    url: "https://api.linkedin.com/rest/posts",
    headers: {
      Authorization: "Bearer ••••• (wird serverseitig eingesetzt)",
      "Content-Type": "application/json",
      "Linkedin-Version": apiVersion,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: {
      author: `urn:li:person:${personId}`,
      commentary: escapeLittleText(text),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    },
  };
}

export type ReadinessItem = { ok: boolean; text: string };

export function linkedInReadiness(o: {
  connected: boolean;
  state: ConnState | null;
  scopes: string[];
  approvalValid: boolean;
  text: string;
  hasPlaceholder: boolean;
}): ReadinessItem[] {
  return [
    { ok: o.connected, text: o.connected ? "LinkedIn-Account ist verbunden" : "LinkedIn-Account verbinden (unter Verbindungen)" },
    { ok: o.state === "verbunden" || o.state === "laeuft_ab", text: o.state === "abgelaufen" ? "Verbindung abgelaufen – erneut autorisieren" : "Verbindung ist gültig" },
    { ok: o.scopes.includes("w_member_social"), text: o.scopes.includes("w_member_social") ? "Berechtigung w_member_social erteilt" : "Berechtigung w_member_social fehlt (Produkt „Share on LinkedIn“)" },
    { ok: o.approvalValid, text: o.approvalValid ? "Inhalt, Account und Termin sind freigegeben" : "Entwurf freigeben (Freigabe bindet Text, Account und Termin)" },
    { ok: o.text.trim().length > 0 && o.text.length <= LINKEDIN_COMMENTARY_MAX, text: `Textlänge ${o.text.length} von höchstens ${LINKEDIN_COMMENTARY_MAX} Zeichen` },
    { ok: !o.hasPlaceholder, text: o.hasPlaceholder ? "Platzhalter in [ECKIGEN KLAMMERN] ersetzen" : "Keine Platzhalter im Text" },
  ];
}
