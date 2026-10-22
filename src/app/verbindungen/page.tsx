import Link from "next/link";
import { listAccounts } from "@/server/repo";
import { listConnections, providerSetup } from "@/server/connections";
import { tokenKeySource } from "@/server/secrets";
import {
  CAPABILITY_LABELS,
  CAPABILITY_STATE_LABELS,
  CONN_STATE_LABELS,
  PROVIDERS,
  connectionState,
  parseScopes,
  providerForPlatform,
  type CapabilityKey,
  type ProviderId,
} from "@/lib/platforms";
import { PLATFORMS } from "@/lib/domain";
import { formatDateTime } from "@/lib/time";
import { PageHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { CopyButton } from "@/components/CopyButton";
import { disconnectAction, startConnectionAction, syncConnectionAction } from "@/app/actions";

const STATE_TONE: Record<string, string> = { verfuegbar: "ok", vorbereitet: "accent", gesperrt: "warn", nicht_verfuegbar: "" };
const CONN_TONE: Record<string, string> = { verbunden: "ok", laeuft_ab: "warn", abgelaufen: "danger", fehler: "danger" };

function SetupGuide({ p }: { p: ProviderId }) {
  const s = providerSetup(p);
  const cfg = PROVIDERS[p];
  const envLines = [`${cfg.env.clientId}=…`, `${cfg.env.clientSecret}=…`, ...(cfg.requiresHttps ? ["CK_HTTPS_BASE_URL=https://…"] : [])].join("\n");
  return (
    <details className="setup" open={!s.configured}>
      <summary><strong>Einrichtung {cfg.label}</strong> {s.configured ? <span className="badge ok">eingerichtet</span> : <span className="badge warn">fehlt: {s.missing.join(", ")}</span>}</summary>
      {p === "linkedin" ? (
        <ol className="small">
          <li>Entwickler-App anlegen: <a href="https://www.linkedin.com/developers/apps/new" target="_blank" rel="noopener noreferrer">linkedin.com/developers/apps/new</a>. Name z. B. „Social Media Manager (privat)“; LinkedIn verlangt dabei die Zuordnung zu einer LinkedIn-Seite und ein Logo.</li>
          <li>Tab <strong>Products</strong>: „Sign In with LinkedIn using OpenID Connect“ und „Share on LinkedIn“ hinzufügen.</li>
          <li>Tab <strong>Auth</strong> → Authorized redirect URLs: <code>{s.redirectUri}</code> <CopyButton text={s.redirectUri} label="Kopieren" /></li>
          <li>Client ID und Primary Client Secret aus dem Tab Auth <strong>selbst</strong> in <code>.env.local</code> eintragen (nicht in den Chat):<pre>{envLines}</pre></li>
          <li>App neu starten. Danach erscheint hier „Mit LinkedIn verbinden“.</li>
        </ol>
      ) : p === "tiktok" ? (
        <ol className="small">
          <li>HTTPS-Adresse bereitstellen: TikTok akzeptiert nur Rückleitungen, die mit https beginnen. Empfohlen ist die private Tailscale-Adresse (siehe <code>docs/VERBINDUNGEN.md</code>) – keine öffentliche Freigabe.</li>
          <li>Entwickler-App anlegen: <a href="https://developers.tiktok.com/apps/" target="_blank" rel="noopener noreferrer">developers.tiktok.com/apps</a> → App erstellen. Produkt <strong>Login Kit</strong> hinzufügen.</li>
          <li>Scopes: <code>user.info.basic</code>, <code>user.info.profile</code> (für den Benutzernamen); für eigene Videos zusätzlich <code>video.list</code> und in <code>.env.local</code> <code>TIKTOK_SCOPES=user.info.basic,user.info.profile,video.list</code>.</li>
          <li>Redirect URI (Web): <code>{s.redirectUri}</code> {s.redirectBase ? <CopyButton text={s.redirectUri} label="Kopieren" /> : null}</li>
          <li>Eine App reicht für beide TikTok-Accounts – jeder wird einzeln autorisiert. Im Sandbox-Modus beide Accounts als Testnutzer eintragen (ungeprüft).</li>
          <li>In <code>.env.local</code> eintragen:<pre>{envLines}</pre></li>
        </ol>
      ) : (
        <ol className="small">
          <li><strong>Erst entscheiden</strong> (siehe Kasten „Instagram: Entscheidung vor dem Verbinden“).</li>
          <li>Meta-App: <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">developers.facebook.com/apps</a> → Produkt „Instagram“ → „API setup with Instagram login“.</li>
          <li>Redirect URI: <code>{s.redirectUri}</code> (HTTPS erforderlich).</li>
          <li>In <code>.env.local</code>:<pre>{envLines}</pre></li>
        </ol>
      )}
    </details>
  );
}

export default async function ConnectionsPage() {
  const accounts = listAccounts();
  const conns = new Map(listConnections().map((c) => [c.account_id, c]));
  const now = new Date().toISOString();
  const providersInUse = [...new Set(accounts.map((a) => providerForPlatform(a.platform)).filter(Boolean))] as ProviderId[];

  return (
    <>
      <PageHead title="Verbindungen" intro="Echte Anbindung deiner Accounts über die offiziellen Schnittstellen. Zugangsdaten bleiben verschlüsselt auf diesem Mac; nichts wird ohne deine Freigabe veröffentlicht." />

      <div className="stack">
        {accounts.map((a) => {
          const p = providerForPlatform(a.platform);
          const c = conns.get(a.id);
          const cfg = p ? PROVIDERS[p] : null;
          const setup = p ? providerSetup(p) : null;
          const st = c ? connectionState(c, now) : null;
          const scopes = c ? parseScopes(c.scopes) : [];
          return (
            <section key={a.id} id={`account-${a.id}`} className="card">
              <div className="card-head">
                <div>
                  <div className="small muted">{PLATFORMS[a.platform] ?? a.platform}</div>
                  <h2 style={{ margin: 0 }}>{a.display_name} <span className="muted" style={{ fontWeight: 400 }}>{a.handle.startsWith("@") ? a.handle : ""}</span></h2>
                </div>
                {c && st ? <span className={`badge ${CONN_TONE[st]}`}>{CONN_STATE_LABELS[st]}</span> : <span className="badge">nicht verbunden</span>}
              </div>

              {c ? (
                <div className="conn-profile">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.avatar_url ? <img src={c.avatar_url} alt="" width={44} height={44} referrerPolicy="no-referrer" /> : null}
                  <div className="small">
                    <strong>{c.external_name || c.external_username}</strong>{c.external_username ? ` · @${c.external_username.replace(/^@/, "")}` : ""}
                    <div className="muted">ID {c.external_id.slice(0, 12)}… · verbunden {formatDateTime(c.connected_at)}</div>
                    <div className="muted">Letzte erfolgreiche Synchronisierung: {c.last_sync_at ? formatDateTime(c.last_sync_at) : "noch keine"} · Zugriff gültig bis {c.access_expires_at ? formatDateTime(c.access_expires_at) : "unbekannt"}{c.refresh_expires_at ? ` · erneuerbar bis ${formatDateTime(c.refresh_expires_at)}` : " · keine automatische Erneuerung"}</div>
                    <div className="muted">Erteilte Berechtigungen: {scopes.length ? scopes.join(", ") : "keine gemeldet"}</div>
                  </div>
                </div>
              ) : null}
              {c?.last_error ? <div className="notice danger small" style={{ marginTop: 10 }}>Letzter Fehler ({formatDateTime(c.last_error_at)}): {c.last_error}</div> : null}

              {cfg ? (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table>
                    <thead><tr><th>Funktion</th><th>Stand</th><th>Was dafür nötig ist</th></tr></thead>
                    <tbody>
                      {(Object.keys(CAPABILITY_LABELS) as CapabilityKey[]).map((k) => {
                        const cap = cfg.capabilities[k];
                        const live = k === "identitaet" && c && st !== "abgelaufen";
                        return (
                          <tr key={k}>
                            <td>{CAPABILITY_LABELS[k]}</td>
                            <td><span className={`badge ${live ? "ok" : STATE_TONE[cap.state]}`}>{live ? "aktiv" : CAPABILITY_STATE_LABELS[cap.state]}</span></td>
                            <td className="small">{cap.detail}{cap.needs ? <><br /><span className="muted">Benötigt: {cap.needs}</span></> : null}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {p === "instagram" && !c ? (
                <div className="notice warn small" style={{ marginTop: 12 }}>
                  <strong>Instagram: Entscheidung vor dem Verbinden.</strong> Die offizielle Instagram-API funktioniert nur mit einem <em>professionellen Konto</em> (Creator oder Business). Laut Instagram-Hilfe gilt:
                  <ul style={{ margin: "6px 0" }}>
                    <li>Professionelle Konten können nicht privat sein – ein privates Konto würde öffentlich.</li>
                    <li>Alle offenen Follow-Anfragen werden beim Umstellen automatisch angenommen (vorher ggf. ablehnen).</li>
                    <li>Öffentliche professionelle Konten können in Suchmaschinen auftauchen.</li>
                    <li>Du bekommst Insights; Kategorie und Kontaktdaten lassen sich ausblenden.</li>
                    <li>Zurückwechseln zum privaten Konto ist möglich, dann entfallen Insights und die API-Verbindung.</li>
                  </ul>
                  Die Umstellung nimmst du selbst in der Instagram-App vor (Einstellungen → Kontotyp und Tools). Hier wird nichts automatisch geändert.
                </div>
              ) : null}

              {p && setup ? (
                <div className="row" style={{ marginTop: 12 }}>
                  {setup.configured ? (
                    <form action={startConnectionAction}>
                      <input type="hidden" name="account_id" value={a.id} />
                      <SubmitButton className={`btn ${c ? "" : "primary"}`} pendingText="Weiterleitung…">{c ? "Erneut autorisieren" : `Mit ${PROVIDERS[p].label} verbinden`}</SubmitButton>
                    </form>
                  ) : (
                    <span className="small muted">Verbinden ist möglich, sobald die Einrichtung unten abgeschlossen ist.</span>
                  )}
                  {c ? (
                    <>
                      <form action={syncConnectionAction}>
                        <input type="hidden" name="account_id" value={a.id} />
                        <SubmitButton className="btn" pendingText="Prüft…">Jetzt synchronisieren</SubmitButton>
                      </form>
                      <form action={disconnectAction}>
                        <input type="hidden" name="account_id" value={a.id} />
                        <SubmitButton className="btn danger" confirm={`Verbindung von „${a.display_name}“ trennen? Der gespeicherte Zugang wird gelöscht.`}>Verbindung trennen</SubmitButton>
                      </form>
                    </>
                  ) : null}
                </div>
              ) : null}
              {p === "tiktok" ? <p className="small muted" style={{ marginTop: 8 }}>Tipp: Melde dich bei TikTok vorher im Browser mit genau diesem Konto ({a.handle}) an. Vor dem Speichern zeigt dir die App, welches Profil tatsächlich verbunden wurde.</p> : null}
            </section>
          );
        })}

        <div className="card">
          <h2>Einrichtung je Plattform</h2>
          <p className="small muted">Client-IDs und Secrets trägst du selbst in <code>.env.local</code> ein (nie in den Chat, nie in Git). Tokens werden verschlüsselt gespeichert (Schlüssel: {tokenKeySource() === "umgebung" ? "CK_TOKEN_KEY in .env.local" : "data/token.key, nur auf diesem Mac"}).</p>
          <div className="stack">{providersInUse.map((p) => <SetupGuide key={p} p={p} />)}</div>
          <p className="small muted" style={{ marginTop: 10 }}>Details, Quellen und Prüfdatum: <code>docs/VERBINDUNGEN.md</code>. <Link href="/einstellungen">Einstellungen</Link></p>
        </div>
      </div>
    </>
  );
}
