import Link from "next/link";
import { notFound } from "next/navigation";
import { getIdea, listAccounts, listCoachResults, listDrafts, packageDraftsForIdea, voiceFeedbackForDraft } from "@/server/repo";
import { aiConfigured, currentModel } from "@/server/ai";
import { FORMAT_SUGGESTIONS } from "@/lib/domain";
import { copyablePackagePrompt } from "@/lib/prompts";
import { packageGaps, parsePackageJson } from "@/lib/package";
import { learningContextText } from "@/server/context";
import { formatDateTime } from "@/lib/time";
import { AccountChip, PageHead, StatusBadge } from "@/components/ui";
import { AccountChecks, AccountSelect } from "@/components/AccountChecks";
import { SubmitButton } from "@/components/SubmitButton";
import { CopyButton } from "@/components/CopyButton";
import { CoachResult } from "@/components/CoachResult";
import { PackageFields } from "@/components/PackageFields";
import { VoiceFeedbackForm } from "@/components/VoiceFeedbackForm";
import { archiveIdeaAction, elaborateIdeaAction, importPackageAction, saveDraftAction, updateIdeaAction } from "@/app/actions";

const MODE_LABEL: Record<string, string> = { schnell: "schnell festgehalten", ruhig: "im ruhigen Modus festgehalten", formular: "über das Formular erfasst" };

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idea = /^\d+$/.test(id) ? getIdea(Number(id)) : undefined;
  if (!idea) notFound();
  const accounts = listAccounts();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const legacy = listCoachResults(idea.id).filter((r) => r.kind === "coach");
  const drafts = listDrafts().filter((d) => d.idea_id === idea.id);
  const packages = packageDraftsForIdea(idea.id);
  const current = packages[0];
  const pkg = current ? parsePackageJson(current.package_json) : null;
  const ai = aiConfigured();
  const original = idea.original_text ?? idea.body;
  const promptInput = { title: idea.title, body: idea.body, notes: idea.notes, tags: idea.tags, preferredAccountIds: idea.account_ids, original };
  const prompt = copyablePackagePrompt(promptInput, accounts, true, learningContextText(accounts));
  const back = `/ideen/${idea.id}#paket`;

  return (
    <>
      <PageHead title={idea.title || "Idee"} intro={<>Festgehalten {formatDateTime(idea.created_at)} · {MODE_LABEL[idea.capture_mode] ?? idea.capture_mode}{idea.archived ? " · archiviert" : ""}</>}>
        <Link href="/ideen" className="btn">Zur Inbox</Link>
        <form action={archiveIdeaAction}>
          <input type="hidden" name="id" value={idea.id} />
          <input type="hidden" name="archived" value={idea.archived ? "0" : "1"} />
          <input type="hidden" name="back" value={idea.archived ? `/ideen/${idea.id}` : "/ideen"} />
          <SubmitButton className="btn">{idea.archived ? "Wiederherstellen" : "Archivieren"}</SubmitButton>
        </form>
      </PageHead>

      <div className="grid grid-main-side">
        <div className="stack">
          <div className="card">
            <h2>Dein Originalgedanke</h2>
            <p className="original">{original}</p>
            <p className="small muted" style={{ marginTop: 8 }}>Wortlaut und Zeitpunkt bleiben unverändert erhalten – auch wenn du unten eine Arbeitsfassung bearbeitest.</p>
          </div>

          <details className="card">
            <summary><strong>Arbeitsfassung, Notizen & Accounts bearbeiten</strong></summary>
            <form action={updateIdeaAction} style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={idea.id} />
              <div className="field"><label htmlFor="body">Arbeitsfassung</label><textarea id="body" name="body" defaultValue={idea.body} required maxLength={10000} /></div>
              <div className="field"><label htmlFor="notes">Notizen und Antworten auf offene Fragen</label><textarea id="notes" name="notes" defaultValue={idea.notes} maxLength={10000} placeholder="Konkrete Erfahrungen, Beispiele, Zahlen – nur was wirklich stimmt." /></div>
              <div className="grid grid-2" style={{ marginTop: 12 }}>
                <div><label htmlFor="title">Titel</label><input id="title" name="title" type="text" defaultValue={idea.title} maxLength={200} /></div>
                <div><label htmlFor="tags">Tags</label><input id="tags" name="tags" type="text" defaultValue={idea.tags.split(",").filter(Boolean).join(", ")} maxLength={500} /></div>
              </div>
              <div className="field"><label>Mögliche Accounts</label><AccountChecks accounts={accounts} selected={idea.account_ids} short /></div>
              <div className="row" style={{ marginTop: 12 }}><SubmitButton className="btn primary">Speichern</SubmitButton></div>
            </form>
          </details>

          <section id="paket" className="stack">
            <div className="card">
              <div className="card-head"><h2>Content-Paket</h2>{current ? <StatusBadge status={current.status} /> : null}</div>
              {ai ? (
                <form action={elaborateIdeaAction} className="row">
                  <input type="hidden" name="id" value={idea.id} />
                  <label className="check"><input type="checkbox" name="with_script" value="1" defaultChecked /> Skript ausformulieren</label>
                  <SubmitButton className={`btn ${current ? "" : "primary"}`} pendingText="Arbeitet aus … (bis zu einer Minute)">{current ? "Neu ausarbeiten" : "Ausarbeiten"}</SubmitButton>
                  <span className="small muted">Modell {currentModel()} · nur auf deinen Klick · kostenpflichtig</span>
                </form>
              ) : (
                <details open={!current}>
                  <summary><strong>{current ? "Neu ausarbeiten (ohne API-Schlüssel)" : "Ausarbeiten (ohne API-Schlüssel)"}</strong></summary>
                  <p className="small notice warn" style={{ marginTop: 8 }}>Für „Ausarbeiten“ per Klick braucht die App einen eigenen Anthropic-API-Schlüssel (<Link href="/einstellungen">Einstellungen</Link>). Bis dahin: Prompt kopieren, in einem KI-Tool einfügen, Antwort unten einfügen – sie wird automatisch in die Felder verteilt.</p>
                  <div className="row" style={{ margin: "8px 0" }}><CopyButton text={prompt} label="Prompt kopieren" /></div>
                  <div className="copybox"><pre>{prompt}</pre></div>
                  <form action={importPackageAction} style={{ marginTop: 10 }}>
                    <input type="hidden" name="id" value={idea.id} />
                    <label htmlFor="ext-result">Antwort einfügen</label>
                    <textarea id="ext-result" name="result" required maxLength={30000} placeholder="## Empfohlener Account …" />
                    <div className="row" style={{ marginTop: 8 }}><SubmitButton className="btn primary">Antwort übernehmen</SubmitButton></div>
                  </form>
                </details>
              )}
              {!current ? <p className="small muted" style={{ marginTop: 10 }}>Noch kein Paket. „Ausarbeiten“ erstellt Kanalempfehlung, Einstiege, roten Faden, Skript, Drehplan, Titel und Caption – direkt hier an der Idee.</p> : null}
            </div>

            {current && pkg ? (
              <form action={saveDraftAction} className="card">
                <input type="hidden" name="id" value={current.id} />
                <input type="hidden" name="back" value={back} />
                <p className="small muted">
                  {current.source === "ki" ? "KI-Vorschlag" : current.source === "extern" ? "Extern erzeugt" : "Manuell"} vom {formatDateTime(current.created_at)} – prüfe alles, ersetze Platzhalter durch eigene Angaben. Keine Garantie für Reichweite oder Zuschauerbindung.
                </p>
                {(() => {
                  const gaps = packageGaps(pkg, current.body);
                  return gaps.length ? <p className="notice warn small">Noch offen: {gaps.join(" · ")}</p> : <p className="notice ok small">Drehfertig – alle Bausteine sind ausgefüllt.</p>;
                })()}
                <fieldset className="pkg-group">
                  <legend>Kanal & Format</legend>
                  <div className="grid grid-2">
                    <div><label>Empfohlener Account</label><AccountSelect accounts={accounts} value={current.account_id} /></div>
                    <div><label htmlFor="p-format">Format</label><input id="p-format" name="format" type="text" list="formats" defaultValue={current.format} maxLength={60} /></div>
                  </div>
                  <div className="field"><label htmlFor="p-title">Titel</label><input id="p-title" name="title" type="text" defaultValue={current.title} maxLength={200} /></div>
                </fieldset>
                <PackageFields pkg={pkg} />
                <fieldset className="pkg-group">
                  <legend>Skript</legend>
                  <label htmlFor="p-body" className="sr">Skript</label>
                  <textarea id="p-body" name="body" defaultValue={current.body} className="tall" maxLength={30000} placeholder="Optional – ausformulierter Sprechtext bzw. Beitragstext." />
                </fieldset>
                <div className="row sticky-actions">
                  <SubmitButton className="btn primary" pendingText="Speichert…">Paket speichern</SubmitButton>
                  <Link href={`/entwuerfe/${current.id}`} className="btn">Freigeben & planen</Link>
                </div>
              </form>
            ) : null}

            {current ? (
              <div className="card">
                <h3>Klingt das nach dir?</h3>
                <VoiceFeedbackForm draftId={current.id} back={back} history={voiceFeedbackForDraft(current.id)} />
              </div>
            ) : null}

            {packages.length > 1 ? (
              <details className="card">
                <summary>Frühere Fassungen ({packages.length - 1})</summary>
                <ul className="list">
                  {packages.slice(1).map((d) => (
                    <li key={d.id} className="small"><Link href={`/entwuerfe/${d.id}`}>{d.title || "Ohne Titel"}</Link> · {formatDateTime(d.created_at)} · <StatusBadge status={d.status} /></li>
                  ))}
                </ul>
              </details>
            ) : null}

            {legacy.map((r) => (
              <div key={r.id}><CoachResult row={r} accounts={accounts} ideaId={idea.id} /></div>
            ))}
          </section>
        </div>

        <aside className="stack">
          <div className="card">
            <h3>Verknüpfte Accounts</h3>
            {idea.account_ids.length ? (
              <div className="row">{idea.account_ids.map((a) => <AccountChip key={a} account={byId.get(a)} />)}</div>
            ) : (
              <p className="small muted">Noch keinem Account zugeordnet – das übernimmt die Ausarbeitung als Vorschlag.</p>
            )}
          </div>
          <div className="card">
            <h3>Entwürfe zu dieser Idee</h3>
            {drafts.length ? (
              <ul className="list">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <Link href={`/entwuerfe/${d.id}`} className="item-title">{d.title || d.body.slice(0, 60) || "Ohne Titel"}</Link>
                    <div className="row small" style={{ marginTop: 4 }}><StatusBadge status={d.status} /><AccountChip account={d.account_id ? byId.get(d.account_id) : null} /></div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Noch kein Entwurf.</p>
            )}
          </div>
        </aside>
      </div>
      <datalist id="formats">{FORMAT_SUGGESTIONS.map((f) => <option key={f} value={f} />)}</datalist>
    </>
  );
}
