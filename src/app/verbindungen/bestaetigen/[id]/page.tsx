import Link from "next/link";
import { getAccount } from "@/server/repo";
import { conflictingConnection, getPending } from "@/server/connections";
import { PROVIDERS, checkMatch, parseScopes } from "@/lib/platforms";
import { PageHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { confirmConnectionAction, discardConnectionAction } from "@/app/actions";

// Vor dem Speichern: Welches echte Profil wurde verbunden – passt es zum gewählten Account?
export default async function ConfirmConnectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPending(id);
  if (!p) {
    return (
      <>
        <PageHead title="Bestätigung abgelaufen" />
        <div className="card"><p>Diese Bestätigung ist nicht mehr gültig (15 Minuten) oder wurde bereits erledigt. Es wurde nichts gespeichert.</p><Link href="/verbindungen" className="btn">Zu den Verbindungen</Link></div>
      </>
    );
  }
  const account = getAccount(p.account_id);
  const profile = { externalId: p.external_id, name: p.external_name, username: p.external_username, avatarUrl: p.avatar_url, profileUrl: p.profile_url };
  const match = account ? checkMatch(account, profile) : { level: "unklar" as const, message: "Account nicht gefunden." };
  const conflict = conflictingConnection(p.provider, p.external_id, p.account_id);
  return (
    <>
      <PageHead title="Verbindung prüfen" intro={`${PROVIDERS[p.provider].label} hat die Anmeldung bestätigt. Prüfe vor dem Speichern, ob das richtige Profil verbunden wurde.`} />
      <div className="card">
        <div className="grid grid-2">
          <div>
            <h3>Verbundenes Profil (von {PROVIDERS[p.provider].label})</h3>
            <div className="conn-profile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.avatar_url ? <img src={p.avatar_url} alt="" width={56} height={56} referrerPolicy="no-referrer" /> : null}
              <div>
                <strong>{p.external_name || "(ohne Namen)"}</strong>
                {p.external_username ? <div>@{p.external_username.replace(/^@/, "")}</div> : null}
                <div className="small muted">Plattform-ID {p.external_id}</div>
                {p.profile_url ? <a className="small" href={p.profile_url} target="_blank" rel="noopener noreferrer">Profil öffnen ↗</a> : null}
              </div>
            </div>
            <p className="small muted">Berechtigungen: {parseScopes(p.scopes).join(", ") || "keine gemeldet"}</p>
          </div>
          <div>
            <h3>Wird zugeordnet zu</h3>
            <p><strong>{account?.display_name}</strong> {account?.handle}</p>
          </div>
        </div>
        <div className={`notice ${match.level === "passt" ? "ok" : match.level === "abweichung" ? "danger" : "warn"}`} style={{ marginTop: 12 }}>
          <strong>{match.level === "passt" ? "Passt: " : match.level === "abweichung" ? "Achtung, Abweichung: " : "Bitte prüfen: "}</strong>{match.message}
        </div>
        {conflict ? <div className="notice danger" style={{ marginTop: 10 }}>Dieses Profil ist bereits mit „{conflict.display_name}“ {conflict.handle} verbunden und kann nicht doppelt zugeordnet werden.</div> : null}
        <div className="row" style={{ marginTop: 14 }}>
          {!conflict ? (
            <form action={confirmConnectionAction}>
              <input type="hidden" name="pending_id" value={p.id} />
              <SubmitButton className={`btn ${match.level === "abweichung" ? "danger" : "primary"}`} confirm={match.level === "abweichung" ? "Das verbundene Profil weicht vom erwarteten Account ab. Trotzdem speichern?" : undefined}>
                {match.level === "abweichung" ? "Trotzdem speichern" : "Verbindung speichern"}
              </SubmitButton>
            </form>
          ) : null}
          <form action={discardConnectionAction}>
            <input type="hidden" name="pending_id" value={p.id} />
            <SubmitButton className="btn">Verwerfen</SubmitButton>
          </form>
        </div>
      </div>
    </>
  );
}
