import Link from "next/link";
import { notFound } from "next/navigation";
import { getDraft, getIdea, listAccounts } from "@/server/repo";
import { FORMAT_SUGGESTIONS, approvalHash } from "@/lib/domain";
import { formatDateTime, utcToLocalInput } from "@/lib/time";
import { PageHead, StatusBadge } from "@/components/ui";
import { AccountSelect } from "@/components/AccountChecks";
import { SubmitButton } from "@/components/SubmitButton";
import { CopyButton } from "@/components/CopyButton";
import { deleteDraftAction, markPublishedAction, saveDraftAction, setDraftStatusAction } from "@/app/actions";
import { getAccount as getAccountById, voiceFeedbackForDraft } from "@/server/repo";
import { parsePackageJson } from "@/lib/package";
import { PackageFields } from "@/components/PackageFields";
import { VoiceFeedbackForm } from "@/components/VoiceFeedbackForm";
import { getConnectionByAccount } from "@/server/connections";
import { connectionState, linkedInPostRequest, linkedInReadiness, parseScopes } from "@/lib/platforms";

function StatusButton({ id, status, children, primary = false }: { id: number; status: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <form action={setDraftStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton className={`btn small ${primary ? "primary" : ""}`}>{children}</SubmitButton>
    </form>
  );
}

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = /^\d+$/.test(id) ? getDraft(Number(id)) : undefined;
  if (!d) notFound();
  const accounts = listAccounts(true).filter((a) => !a.archived || a.id === d.account_id);
  const idea = d.idea_id ? getIdea(d.idea_id) : undefined;
  const approvalValid = Boolean(d.approved_hash && d.approved_hash === approvalHash(d));
  const pkg = parsePackageJson(d.package_json);
  const published = d.status === "veroeffentlicht";
  const words = d.body.trim() ? d.body.trim().split(/\s+/).length : 0;

  return (
    <>
      <PageHead title={d.title || "Entwurf"} intro={<>Angelegt {formatDateTime(d.created_at)} · geändert {formatDateTime(d.updated_at)}{idea ? <> · aus Idee <Link href={`/ideen/${idea.id}`}>{idea.title || "#" + idea.id}</Link></> : null}</>}>
        <Link href="/entwuerfe" className="btn">Zur Liste</Link>
        <form action={deleteDraftAction}>
          <input type="hidden" name="id" value={d.id} />
          <SubmitButton className="btn danger" confirm="Entwurf endgültig löschen?">Löschen</SubmitButton>
        </form>
      </PageHead>

      {idea ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="small muted">Dein Originalgedanke ({formatDateTime(idea.created_at)})</div>
          <p className="original">{idea.original_text ?? idea.body}</p>
        </div>
      ) : null}
      <div className="grid grid-main-side draft-layout">
        <form action={saveDraftAction} className="card">
          <input type="hidden" name="id" value={d.id} />
          <div className="grid grid-2">
            <div><label htmlFor="title">Titel / Thema</label><input id="title" name="title" type="text" defaultValue={d.title} maxLength={200} /></div>
            <div><label htmlFor="format">Format</label><input id="format" name="format" type="text" list="formats" defaultValue={d.format} maxLength={60} /></div>
            <div><label>Account</label><AccountSelect accounts={accounts} value={d.account_id} /></div>
            <div>
              <label htmlFor="scheduled_at">Geplanter Zeitpunkt (Berlin)</label>
              <input id="scheduled_at" name="scheduled_at" type="datetime-local" defaultValue={utcToLocalInput(d.scheduled_at)} />
            </div>
          </div>
          <div className="field">
            <div className="row between"><label htmlFor="body">Skript / Text</label><span className="row small muted">{words} Wörter · {d.body.length} Zeichen <CopyButton text={d.body} /></span></div>
            <textarea id="body" name="body" className="tall" defaultValue={d.body} maxLength={30000} />
          </div>
          {pkg ? <div style={{ marginTop: 14 }}><PackageFields pkg={pkg} /></div> : null}
          <div>
            <div className="hint">Platzhalter in [ECKIGEN KLAMMERN] vor der Freigabe durch echte Angaben ersetzen.</div>
          </div>
          {/\[[A-ZÄÖÜ ]{4,}[^\]]*\]/.test(d.body) ? <div className="notice warn small" style={{ marginTop: 10 }}>Der Text enthält noch Platzhalter in eckigen Klammern.</div> : null}
          <div className="row sticky-actions" style={{ marginTop: 14 }}>
            <SubmitButton className="btn primary" pendingText="Speichert…">Speichern</SubmitButton>
            {approvalValid ? <span className="small muted">Änderungen an Text, Account, Format oder Termin heben die Freigabe auf.</span> : null}
          </div>
        </form>

        <aside className="stack">
          <div className="card status-card">
            <div className="card-head"><h3>Status</h3><StatusBadge status={d.status} /></div>
            <p className="small">
              Herkunft: <span className="badge">{d.source === "ki" ? "KI-Vorschlag" : d.source === "extern" ? "Extern erzeugt" : "Manuell"}</span>
              {d.source !== "manuell" ? <span className="muted"> – vor der Freigabe prüfen und mit eigenen Angaben füllen.</span> : null}
            </p>
            {approvalValid ? (
              <p className="small">Freigegeben am {formatDateTime(d.approved_at)} – gilt für genau diesen Text, Account, dieses Format und {d.scheduled_at ? `den Termin ${formatDateTime(d.scheduled_at)}` : "ohne Termin"}.</p>
            ) : (
              <p className="small muted">Noch nicht freigegeben.</p>
            )}
            {published ? (
              <p className="small">Veröffentlicht {formatDateTime(d.published_at)} · <a href={d.published_url} target="_blank" rel="noopener noreferrer">Beitrag öffnen ↗</a></p>
            ) : (
              <div className="row">
                {d.status !== "entwurf" ? <StatusButton id={d.id} status="entwurf">Zurück zu Entwurf</StatusButton> : null}
                {d.status === "idee" || d.status === "entwurf" ? <StatusButton id={d.id} status="bereit" primary>Bereit zur Freigabe</StatusButton> : null}
                {!approvalValid ? <StatusButton id={d.id} status="freigegeben" primary={d.status === "bereit"}>Freigeben</StatusButton> : null}
                {approvalValid && d.status !== "geplant" ? <StatusButton id={d.id} status="geplant" primary>Einplanen</StatusButton> : null}
              </div>
            )}
            <p className="small muted" style={{ marginTop: 10 }}>Ablauf: Entwurf → Bereit zur Freigabe → Freigeben → (mit Termin) Geplant → nach manueller Veröffentlichung bestätigen.</p>
          </div>

          {(() => {
            const acc = d.account_id ? getAccountById(d.account_id) : undefined;
            if (!acc || acc.platform !== "linkedin" || published) return null;
            const conn = getConnectionByAccount(acc.id);
            const st = conn ? connectionState(conn, new Date().toISOString()) : null;
            const checks = linkedInReadiness({
              connected: Boolean(conn),
              state: st,
              scopes: conn ? parseScopes(conn.scopes) : [],
              approvalValid,
              text: d.body,
              hasPlaceholder: /\[[A-ZÄÖÜ ]{4,}[^\]]*\]/.test(d.body),
            });
            const req = conn ? linkedInPostRequest(conn.external_id, d.body, process.env.LINKEDIN_API_VERSION?.trim() || "202609") : null;
            return (
              <div className="card">
                <h3>LinkedIn-Veröffentlichung (vorbereitet)</h3>
                <p className="small muted">Das Senden an LinkedIn ist noch nicht freigeschaltet. Hier siehst du, ob alles bereit wäre und was gesendet würde.</p>
                <ul className="small" style={{ paddingLeft: 18 }}>
                  {checks.map((c, i) => <li key={i}>{c.ok ? "✓" : "✗"} {c.text}</li>)}
                </ul>
                {req ? (
                  <details>
                    <summary className="small">Anfrage an die Posts API ansehen</summary>
                    <pre className="small" style={{ whiteSpace: "pre-wrap" }}>{`${req.method} ${req.url}\n${Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${JSON.stringify(req.body, null, 2)}`}</pre>
                  </details>
                ) : <p className="small"><a href="/verbindungen">LinkedIn verbinden →</a></p>}
              </div>
            );
          })()}

          {pkg || d.source !== "manuell" ? (
            <div className="card">
              <h3>Klingt das nach dir?</h3>
              <VoiceFeedbackForm draftId={d.id} back={`/entwuerfe/${d.id}`} history={voiceFeedbackForDraft(d.id)} />
            </div>
          ) : null}

          <form action={markPublishedAction} className="card">
            <h3>{published ? "Veröffentlichung korrigieren" : "Als veröffentlicht bestätigen"}</h3>
            <p className="small muted">Du veröffentlichst selbst auf der Plattform und trägst hier den Link ein. Der Beitrag wird dann unter Performance angelegt (ohne doppelte Einträge).</p>
            <input type="hidden" name="id" value={d.id} />
            <div className="field"><label htmlFor="published_url">Beitrags-Link</label><input id="published_url" name="published_url" type="url" defaultValue={d.published_url} placeholder="https://…" required /></div>
            <div className="field"><label htmlFor="published_at">Zeitpunkt (leer = jetzt)</label><input id="published_at" name="published_at" type="datetime-local" defaultValue={utcToLocalInput(d.published_at ?? d.scheduled_at)} /></div>
            <div className="row" style={{ marginTop: 10 }}><SubmitButton className="btn small">Bestätigen</SubmitButton></div>
          </form>
        </aside>
      </div>
      <datalist id="formats">{FORMAT_SUGGESTIONS.map((f) => <option key={f} value={f} />)}</datalist>
    </>
  );
}
