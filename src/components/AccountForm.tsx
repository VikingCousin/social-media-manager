import { saveAccountAction } from "@/app/actions";
import { ACCOUNT_PROFILE_FIELDS, PLATFORMS, type Account } from "@/lib/domain";
import { SubmitButton } from "./SubmitButton";

export function AccountForm({ account }: { account?: Account }) {
  return (
    <form action={saveAccountAction} className="card">
      {account ? <input type="hidden" name="id" value={account.id} /> : null}
      <h2>Grunddaten</h2>
      <div className="grid grid-2">
        <div className="field">
          <label htmlFor="platform">Plattform</label>
          <select id="platform" name="platform" defaultValue={account?.platform ?? ""} required>
            <option value="" disabled>Bitte wählen</option>
            {Object.entries(PLATFORMS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="display_name">Anzeigename</label>
          <input id="display_name" name="display_name" type="text" defaultValue={account?.display_name} required maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="handle">Handle</label>
          <input id="handle" name="handle" type="text" defaultValue={account?.handle} placeholder="@name" maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="profile_url">Profil-Link</label>
          <input id="profile_url" name="profile_url" type="url" defaultValue={account?.profile_url} placeholder="https://…" />
          <div className="hint">Nur ein Link – keine Verbindung zur Plattform.</div>
        </div>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label>API-Verbindungsstatus</label>
        <div className="row">
          <span className="badge">Nicht verbunden</span>
          <span className="small muted">In Version 1 gibt es keine Plattform-Anbindung. Dieses Feld wird erst mit einer offiziellen Integration änderbar.</span>
        </div>
      </div>

      <h2 style={{ marginTop: 24 }}>Steckbrief</h2>
      <p className="small muted">„Noch offen“ ist ausdrücklich erlaubt. Leere Felder gelten ebenfalls als offen – der Content-Coach kennzeichnet Empfehlungen dann als vorläufig.</p>
      <div className="grid grid-2">
        {ACCOUNT_PROFILE_FIELDS.map(([key, label]) => (
          <div className="field" key={key} style={{ marginTop: 0 }}>
            <label htmlFor={key}>{label}</label>
            <textarea id={key} name={key} defaultValue={account?.[key] ?? ""} placeholder="Noch offen" maxLength={4000} />
          </div>
        ))}
      </div>
      <div className="field">
        <label htmlFor="snapshot">Momentaufnahme (optional)</label>
        <input id="snapshot" name="snapshot" type="text" defaultValue={account?.snapshot} maxLength={2000} placeholder="z. B. „Stand 28.09.2026: … Follower (laut Screenshot)“" />
        <div className="hint">Manuell notierte Zahlen sind nur eine Momentaufnahme und werden nicht automatisch aktualisiert.</div>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <SubmitButton className="btn primary" pendingText="Speichert…">{account ? "Steckbrief speichern" : "Account anlegen"}</SubmitButton>
      </div>
    </form>
  );
}
