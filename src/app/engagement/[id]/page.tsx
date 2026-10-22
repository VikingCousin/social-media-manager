import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount, getEngagement, listAccounts } from "@/server/repo";
import { aiConfigured, currentModel } from "@/server/ai";
import { copyableEngagementPrompt } from "@/lib/prompts";
import { formatDateTime } from "@/lib/time";
import { PageHead } from "@/components/ui";
import { AccountSelect } from "@/components/AccountChecks";
import { SubmitButton } from "@/components/SubmitButton";
import { CopyButton } from "@/components/CopyButton";
import { deleteEngagementAction, generateEngagementAction, saveEngagementAction } from "@/app/actions";

export default async function EngagementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = /^\d+$/.test(id) ? getEngagement(Number(id)) : undefined;
  if (!e) notFound();
  const accounts = listAccounts();
  const ai = aiConfigured();
  const prompt = copyableEngagementPrompt(e, e.account_id ? getAccount(e.account_id) : undefined);
  return (
    <>
      <PageHead title="Kommentarentwurf" intro={<>Zuletzt geändert {formatDateTime(e.updated_at)}{e.source === "ki" ? " · enthält KI-Vorschlag" : ""}</>}>
        <Link href="/engagement" className="btn">Zurück</Link>
        <form action={deleteEngagementAction}>
          <input type="hidden" name="id" value={e.id} />
          <SubmitButton className="btn danger" confirm="Diesen Entwurf löschen?">Löschen</SubmitButton>
        </form>
      </PageHead>
      <div className="grid grid-main-side">
        <form action={saveEngagementAction} className="card">
          <input type="hidden" name="id" value={e.id} />
          <div className="grid grid-2">
            <div><label>Mein Account</label><AccountSelect accounts={accounts} value={e.account_id} /></div>
            <div>
              <label htmlFor="source_url">Link zum Beitrag</label>
              <input id="source_url" name="source_url" type="url" defaultValue={e.source_url} />
              {e.source_url ? <a className="small" href={e.source_url} target="_blank" rel="noopener noreferrer">Beitrag öffnen ↗</a> : null}
            </div>
          </div>
          <div className="field"><label htmlFor="source_text">Beitragstext / Zusammenfassung</label><textarea id="source_text" name="source_text" defaultValue={e.source_text} maxLength={20000} /></div>
          <div className="field"><label htmlFor="my_notes">Meine Notizen / Haltung</label><textarea id="my_notes" name="my_notes" defaultValue={e.my_notes} maxLength={10000} /></div>
          <div className="field">
            <div className="row between"><label htmlFor="comment">Kommentar</label>{e.comment ? <CopyButton text={e.comment} label="Kommentar kopieren" /> : null}</div>
            <textarea id="comment" name="comment" defaultValue={e.comment} maxLength={5000} style={{ minHeight: 140 }} />
            <div className="hint">Vor dem Posten prüfen: Geht der Kommentar auf einen konkreten Punkt ein? Stimmt jede Aussage über dich?</div>
          </div>
          <div className="field">
            <label className="check" style={{ display: "inline-flex" }}>
              <input type="checkbox" name="status" value="verwendet" defaultChecked={e.status === "verwendet"} /> Habe ich manuell auf LinkedIn verwendet
            </label>
          </div>
          <div className="row" style={{ marginTop: 12 }}><SubmitButton className="btn primary">Speichern</SubmitButton></div>
        </form>
        <aside className="stack">
          {ai ? (
            <form action={generateEngagementAction} className="card">
              <h3>Kommentar mit KI entwerfen</h3>
              <p className="small muted">Nutzt den gespeicherten Beitrag und deine Notizen. Ein vorhandener Kommentar wird ersetzt – bitte vorher speichern.</p>
              <input type="hidden" name="id" value={e.id} />
              <SubmitButton className="btn primary" pendingText="Entwirft…" confirm={e.comment ? "Vorhandenen Kommentar durch einen neuen KI-Entwurf ersetzen?" : undefined}>Entwurf erzeugen</SubmitButton>
              <p className="small muted" style={{ marginTop: 8 }}>Modell: {currentModel()}</p>
            </form>
          ) : (
            <div className="card">
              <h3>Ohne API-Schlüssel</h3>
              <p className="small muted">Prompt kopieren, extern ausführen und das Ergebnis links ins Kommentarfeld einfügen.</p>
              <div className="row" style={{ marginBottom: 8 }}><CopyButton text={prompt} label="Prompt kopieren" /></div>
              <div className="copybox"><pre>{prompt}</pre></div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
