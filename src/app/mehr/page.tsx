import Link from "next/link";
import { PageHead } from "@/components/ui";

const LINKS = [
  { href: "/engagement", label: "LinkedIn-Engagement", hint: "Kommentarentwürfe zu fremden Beiträgen" },
  { href: "/performance", label: "Performance & Analyse", hint: "Kennzahlen erfassen, auswerten, Experimente ableiten" },
  { href: "/radar", label: "Content-Radar", hint: "Konkurrenz und Inspiration beobachten, Beiträge auswerten" },
  { href: "/accounts", label: "Accounts & Strategie", hint: "Zielgruppe, Positionierung, Themen, Tonalität, Ziele" },
  { href: "/sprache", label: "Meine Sprache", hint: "Sprachprofil und Rückmeldungen – damit Vorschläge nach dir klingen" },
  { href: "/verbindungen", label: "Verbindungen", hint: "LinkedIn, Instagram und TikTok anbinden" },
  { href: "/einstellungen", label: "Einstellungen", hint: "KI, Daten & Backup" },
  { href: "/installieren", label: "Auf dem iPhone installieren", hint: "Als App zum Home-Bildschirm hinzufügen" },
];

export default function MorePage() {
  return (
    <>
      <PageHead title="Mehr" />
      <div className="card">
        <ul className="list">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="row between" style={{ textDecoration: "none" }}>
                <span>
                  <span className="item-title">{l.label}</span>
                  <br />
                  <span className="small muted">{l.hint}</span>
                </span>
                <span className="muted" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>Europe/Berlin · Es wird nichts extern veröffentlicht.</p>
    </>
  );
}
