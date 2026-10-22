import { aiConfigured, currentModel, DEFAULT_MODEL } from "@/server/ai";
import { getSetting } from "@/server/repo";
import { dbPath } from "@/lib/db";
import { PageHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { saveSettingsAction } from "@/app/actions";
import { brandStatus } from "@/lib/design-tokens";

export default async function SettingsPage() {
  const ai = aiConfigured();
  const override = getSetting("ai_model");
  const envModel = process.env.ANTHROPIC_MODEL?.trim();
  return (
    <>
      <PageHead title="Einstellungen" intro="KI-Anbindung, Datenhaltung und Grenzen dieser Version." />
      <div className="grid grid-2">
        <div className="card">
          <h2>KI-Anbindung (Anthropic API)</h2>
          {ai ? (
            <div className="notice ok" style={{ marginBottom: 12 }}>Ein API-Schlüssel ist serverseitig hinterlegt. Er wird nie im Browser angezeigt.</div>
          ) : (
            <div className="notice warn" style={{ marginBottom: 12 }}>
              Kein API-Schlüssel hinterlegt. Accounts, Ideen, Entwürfe, Planung und Import funktionieren trotzdem. Für KI-Funktionen gibt es überall einen kopierbaren Prompt.
            </div>
          )}
          <p className="small">So richtest du die KI ein:</p>
          <ol className="small">
            <li>Unter <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a> einen API-Schlüssel erzeugen. Ein Claude- oder Claude-Code-Abo ist <strong>kein</strong> API-Zugang; die API wird separat nach Nutzung abgerechnet.</li>
            <li>Im Projektordner <code>.env.example</code> nach <code>.env.local</code> kopieren und <code>ANTHROPIC_API_KEY=…</code> eintragen.</li>
            <li>App neu starten. KI-Aufrufe passieren nur, wenn du einen entsprechenden Button klickst.</li>
          </ol>
          <form action={saveSettingsAction} style={{ marginTop: 14 }}>
            <label htmlFor="ai_model">Modell</label>
            <input id="ai_model" name="ai_model" type="text" defaultValue={override ?? ""} placeholder={envModel || DEFAULT_MODEL} maxLength={100} />
            <div className="hint">Aktiv: <code>{currentModel()}</code>. Leer = {envModel ? <>Wert aus <code>ANTHROPIC_MODEL</code></> : <>Standard <code>{DEFAULT_MODEL}</code></>}.</div>
            <div className="row" style={{ marginTop: 10 }}><SubmitButton className="btn">Modell speichern</SubmitButton></div>
          </form>
        </div>

        <div className="card">
          <h2>Daten & Backup</h2>
          <p className="small">Alle Daten liegen lokal in einer SQLite-Datei:</p>
          <p><code className="small">{dbPath()}</code></p>
          <p className="small">Backup (im Projektordner, App darf laufen):</p>
          <pre className="small">npm run backup</pre>
          <p className="small">Erstellt eine konsistente Kopie unter <code>backups/</code>. Wiederherstellen (App vorher beenden):</p>
          <pre className="small">npm run restore -- backups/&lt;datei&gt;.db</pre>
          <p className="small muted">Details in der README.</p>
        </div>

        <div className="card">
          <h2>Plattform-Verbindungen</h2>
          <p className="small">In Version 1 ist <strong>kein</strong> Account mit LinkedIn, Instagram oder TikTok verbunden. Profil-Links sind nur Links. Es gibt keine automatischen Likes, Kommentare, Nachrichten oder Veröffentlichungen und kein Auslesen von Kennzahlen.</p>
          <p className="small muted">Die geplanten offiziellen Integrationen stehen in <code>docs/ROADMAP-INTEGRATIONEN.md</code>.</p>
        </div>

        <div className="card">
          <h2>iPhone</h2>
          <p className="small">Social Media Manager lässt sich über Safari zum Home-Bildschirm hinzufügen. <a href="/installieren">Anleitung</a> · Zugriff von unterwegs: siehe <code>docs/IPHONE-ZUGRIFF.md</code>.</p>
        </div>

        <div className="card">
          <h2>Gestaltung & Marke</h2>
          <p className="small">
            Gesamtstatus: <span className="badge warn">{brandStatus.brandKit}</span> · Werte: <span className="badge">{brandStatus.values}</span>
          </p>
          <ul className="small">
            <li>Neutrale Standardwerte, geprüft auf WCAG-2.2-AA-Kontraste (siehe <code>tests/design.test.ts</code>).</li>
            <li>Keine Marke hinterlegt – Farben, Schrift, Symbol und Anrede sind Arbeitswerte und in <code>design/tokens.json</code> anpassbar.</li>
            <li>Entschieden ist nur der Name „Social Media Manager“.</li>
          </ul>
          <p className="small muted">Details und Kontrastnachweis: <code>design/BRAND-STATUS.md</code></p>
        </div>

        <div className="card">
          <h2>Region</h2>
          <p className="small">Sprache: Deutsch · Zeitzone: Europe/Berlin. Zeiten werden intern in UTC gespeichert und in Berliner Zeit angezeigt.</p>
        </div>
      </div>
    </>
  );
}
