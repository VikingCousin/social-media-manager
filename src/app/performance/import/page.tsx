import Link from "next/link";
import { getSetting, listAccounts } from "@/server/repo";
import { CSV_COLUMNS } from "@/lib/csv";
import { PLATFORMS } from "@/lib/domain";
import { formatDateTime } from "@/lib/time";
import { PageHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { importCsvAction, type ImportReport } from "@/app/actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

const COLUMN_HELP: Record<string, string> = {
  veroeffentlicht_am: "2026-09-01 18:30 oder 01.09.2026 18:30 (Berliner Zeit)",
  account: "Handle (z. B. @beispiel_a), Anzeigename oder Plattform, falls eindeutig",
  format: "z. B. Kurzvideo, LinkedIn-Textbeitrag",
  thema: "frei",
  link: "Beitrags-URL – bester Schlüssel gegen Duplikate",
  views: "Zahl",
  reichweite: "Zahl",
  likes: "Zahl",
  kommentare: "Zahl",
  shares: "Zahl",
  saves: "Zahl",
  wiedergabedauer_sek: "Ø Wiedergabedauer in Sekunden, Dezimalkomma erlaubt",
  follower_gewinn: "Zahl",
};

export default async function ImportPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const raw = sp.bericht ? getSetting("last_import_report") : null;
  let report: (ImportReport & { file?: string }) | null = null;
  try {
    report = raw ? JSON.parse(raw) : null;
  } catch {
    report = null;
  }
  const accounts = listAccounts(true);
  return (
    <>
      <PageHead title="CSV importieren" intro="Kennzahlen aus einer Tabelle übernehmen. Wiederholte Importe erzeugen keine Duplikate – vorhandene Beiträge werden nur um neue, bekannte Werte ergänzt.">
        <Link href="/performance" className="btn">Zurück</Link>
        <a href="/performance/vorlage" className="btn">Vorlage herunterladen</a>
      </PageHead>

      {report ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Ergebnis des letzten Imports</h2>
          <p className="small muted">{report.file ? `${report.file} · ` : ""}{formatDateTime(report.at)}</p>
          <div className="grid grid-3" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
            <div className="stat"><div className="v">{report.neu}</div><div className="l">neu angelegt</div></div>
            <div className="stat"><div className="v">{report.aktualisiert}</div><div className="l">ergänzt/aktualisiert</div></div>
            <div className="stat"><div className="v">{report.unveraendert}</div><div className="l">bereits vorhanden, unverändert</div></div>
            <div className="stat"><div className="v">{report.errors.length}</div><div className="l">Zeilen mit Fehlern</div></div>
          </div>
          {report.unknownColumns.length ? <p className="small muted" style={{ marginTop: 10 }}>Ignorierte Spalten: {report.unknownColumns.join(", ")}</p> : null}
          {report.errors.length ? (
            <div className="notice danger" style={{ marginTop: 12 }}>
              <strong>Nicht übernommen:</strong>
              <ul style={{ margin: "6px 0 0" }}>{report.errors.slice(0, 50).map((e, i) => <li key={i}>{e.row ? `Zeile ${e.row}: ` : ""}{e.message}</li>)}</ul>
            </div>
          ) : null}
          <p style={{ marginTop: 12 }}><Link href="/performance">Zur Auswertung →</Link></p>
        </div>
      ) : null}

      <div className="grid grid-main-side">
        <form action={importCsvAction} className="card">
          <h2>Datei auswählen</h2>
          <input type="file" name="file" accept=".csv,text/csv" required />
          <p className="small muted" style={{ marginTop: 8 }}>Max. 2 MB / 5.000 Zeilen. Trennzeichen Semikolon oder Komma werden erkannt. Inhalte werden nur als Daten gelesen.</p>
          <div className="row" style={{ marginTop: 12 }}><SubmitButton className="btn primary" pendingText="Importiert…">Importieren</SubmitButton></div>
        </form>
        <div className="card">
          <h3>Account-Werte in der Spalte „account“</h3>
          <ul className="small">
            {accounts.map((a) => <li key={a.id}><code>{a.handle || a.display_name}</code> – {PLATFORMS[a.platform]} · {a.display_name}</li>)}
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Spalten der Vorlage</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Spalte</th><th>Inhalt</th></tr></thead>
          <tbody>{CSV_COLUMNS.map((c) => <tr key={c}><td><code>{c}</code></td><td>{COLUMN_HELP[c]}</td></tr>)}</tbody>
        </table></div>
        <p className="small muted" style={{ marginTop: 10 }}>
          Pflicht: <code>account</code> und mindestens <code>link</code> oder <code>veroeffentlicht_am</code>. Leere Zellen, „-“ oder „n/a“ bedeuten unbekannt (nicht 0). Zahlen wie 1.234, 1,2K oder 3M werden erkannt.
          Doppelte Beiträge werden über den Link erkannt, ohne Link über Account + Zeitpunkt + Format + Thema.
        </p>
      </div>
    </>
  );
}
