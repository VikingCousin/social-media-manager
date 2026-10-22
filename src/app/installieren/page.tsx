import Link from "next/link";
import { PageHead } from "@/components/ui";
import { InstallStatus } from "@/components/InstallHint";

export default function InstallPage() {
  return (
    <>
      <PageHead title="Auf dem iPhone installieren" intro="Social Media Manager lässt sich über Safari wie eine App auf den Home-Bildschirm legen – mit eigenem Symbol und ohne Browserleiste." />
      <div className="stack">
        <InstallStatus />

        <div className="card">
          <h2>Voraussetzung: Das iPhone muss den Server erreichen</h2>
          <p className="small">
            Social Media Manager läuft auf deinem Mac und speichert dort alle Daten. Die Adresse <code>localhost</code> funktioniert nur auf dem Mac selbst – auf dem iPhone führt sie ins Leere.
            Erst wenn der Mac über eine sichere Verbindung erreichbar ist (empfohlen: privates Netzwerk mit Tailscale, siehe <code>docs/IPHONE-ZUGRIFF.md</code>), kannst du die App auf dem iPhone öffnen und installieren.
          </p>
        </div>

        <div className="card">
          <h2>So legst du Social Media Manager auf den Home-Bildschirm</h2>
          <ol>
            <li>Öffne die Adresse des Social Media Managers in <strong>Safari</strong>.</li>
            <li>Tippe auf das <strong>Teilen-Symbol</strong> (Quadrat mit Pfeil nach oben). Je nach iOS-Version liegt es hinter dem Menü <strong>„…“</strong>.</li>
            <li>Wähle <strong>„Zum Home-Bildschirm“</strong> – falls nicht sichtbar, in der Liste nach unten scrollen bzw. „Mehr“ öffnen.</li>
            <li>Falls die Option <strong>„Als Web-App öffnen“</strong> angezeigt wird, eingeschaltet lassen.</li>
            <li>Namen prüfen („Social Media“) und auf <strong>„Hinzufügen“</strong> tippen.</li>
          </ol>
          <p className="small muted">Die Bezeichnungen können je nach iOS-Version leicht abweichen.</p>
        </div>

        <div className="card">
          <h2>Was die App kann – und was nicht</h2>
          <ul className="small">
            <li>Die Home-Bildschirm-App ist ein Fenster auf deinen Social-Media-Manager-Server. Alle Funktionen sind dieselben wie im Browser.</li>
            <li><strong>Keine Offline-Funktion:</strong> Ohne Verbindung zum Server kannst du weder Ideen sehen noch speichern. Ist die Verbindung weg, zeigt die App einen Hinweis.</li>
            <li>Es gibt keine Push-Benachrichtigungen und keine Veröffentlichung auf LinkedIn, Instagram oder TikTok.</li>
            <li>Innerhalb der App gibt es keine Zurück-Taste des Browsers – nutze die Zurück-Links auf den Seiten und die Leiste unten.</li>
          </ul>
        </div>

        <div className="card row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/apple-icon" alt="App-Symbol von Social Media Manager" width={60} height={60} style={{ borderRadius: 14 }} />
          <div className="small">So sieht das Symbol auf dem Home-Bildschirm aus – ein <strong>Arbeitsentwurf</strong>, kein freigegebenes Logo (Marke OFFEN).<br /><Link href="/">Zur Übersicht</Link></div>
        </div>
      </div>
    </>
  );
}
