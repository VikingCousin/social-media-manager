import { coachFeedbackAction, createDraftAction, deleteCoachResultAction } from "@/app/actions";
import type { CoachOutput } from "@/server/ai";
import type { Account } from "@/lib/domain";
import type { CoachResultRow } from "@/server/repo";
import { formatDateTime } from "@/lib/time";
import { AccountChip } from "./ui";
import { SubmitButton } from "./SubmitButton";
import { CopyButton } from "./CopyButton";

function outline(o: CoachOutput): string {
  return [
    "Einstiege:",
    ...o.hooks.map((h, i) => `${i + 1}. ${h}`),
    "",
    "Roter Faden:",
    ...o.throughline.map((s, i) => `${i + 1}. ${s}`),
    ...(o.questions_for_me.length ? ["", "Offene Fragen an mich:", ...o.questions_for_me.map((q) => `- ${q}`)] : []),
  ].join("\n");
}

export function CoachResult({ row, accounts, ideaId }: { row: CoachResultRow; accounts: Account[]; ideaId: number }) {
  let o: CoachOutput;
  try {
    o = JSON.parse(row.output_json) as CoachOutput;
  } catch {
    return <div className="notice danger">Gespeichertes Ergebnis ist beschädigt.</div>;
  }
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const rec = byId.get(o.recommended_account_id);
  const alt = o.alternative_account_id ? byId.get(o.alternative_account_id) : undefined;
  const draftFormat =
    o.draft_kind === "video" ? "Kurzvideo" : o.draft_kind === "caption" ? (rec?.platform === "tiktok" ? "Kurzvideo" : rec?.platform === "instagram" ? "Reel" : "") : rec?.platform === "linkedin" ? "LinkedIn-Textbeitrag" : "";
  const draftHeading = o.draft_kind === "video" ? "Videoskript (Entwurf)" : o.draft_kind === "caption" ? "Caption (Entwurf)" : "Beitragsentwurf";
  const basis = o.basis ?? [];
  const uncertainties = o.uncertainties ?? [];
  return (
    <div className="card">
      <div className="card-head">
        <div className="row">
          <strong>KI-Vorschlag</strong>
          <span className="small muted">{formatDateTime(row.created_at)} · {row.model}</span>
        </div>
        <form action={deleteCoachResultAction}>
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="idea_id" value={ideaId} />
          <SubmitButton className="btn small ghost danger" confirm="Dieses Coach-Ergebnis löschen?">Löschen</SubmitButton>
        </form>
      </div>

      <div className="stack">
        <div>
          <div className="row">
            <span className="small muted">Empfehlung:</span>
            <AccountChip account={rec} />
            {o.recommendation_provisional ? <span className="badge warn">vorläufig</span> : null}
          </div>
          <p className="pre" style={{ marginTop: 6 }}>{o.recommendation_reason}</p>
          {o.missing_positioning.length ? <p className="small muted">Für eine sichere Empfehlung fehlt noch: {o.missing_positioning.join(", ")}</p> : null}
        </div>
        {alt ? (
          <div>
            <div className="row"><span className="small muted">Alternative:</span><AccountChip account={alt} /></div>
            <p className="pre" style={{ marginTop: 6 }}>{o.alternative_reason}</p>
          </div>
        ) : null}
        <div className="grid grid-2">
          <div>
            <h3>Blickwinkel</h3>
            <ul className="hooks">{o.angles.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
          <div>
            <h3>Drei Einstiege</h3>
            <ol className="hooks">{o.hooks.map((h, i) => <li key={i}>{h}</li>)}</ol>
          </div>
        </div>
        <div>
          <h3>Roter Faden</h3>
          <ol className="hooks">{o.throughline.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
        {o.questions_for_me.length ? (
          <div className="notice info">
            <strong>Damit es glaubwürdig wird, brauche ich von dir:</strong>
            <ul style={{ margin: "6px 0 0" }}>{o.questions_for_me.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </div>
        ) : null}
        {basis.length || uncertainties.length ? (
          <div className="grid grid-2">
            {basis.length ? (
              <div>
                <h3>Grundlage</h3>
                <ul className="small">{basis.map((b, i) => <li key={i}>{b}</li>)}</ul>
              </div>
            ) : null}
            {uncertainties.length ? (
              <div>
                <h3>Unsicherheiten & Datenlücken</h3>
                <ul className="small">{uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {o.draft_text ? (
          <div>
            <div className="row between"><h3>{draftHeading}</h3><CopyButton text={o.draft_text} /></div>
            <div className="copybox"><pre>{o.draft_text}</pre></div>
          </div>
        ) : null}
        <div className="row">
          <form action={createDraftAction}>
            <input type="hidden" name="idea_id" value={ideaId} />
            <input type="hidden" name="account_id" value={rec?.id ?? ""} />
            <input type="hidden" name="format" value={draftFormat} />
            <input type="hidden" name="source" value="ki" />
            <input type="hidden" name="title" value={o.hooks[0]?.slice(0, 200) ?? ""} />
            <input type="hidden" name="body" value={o.draft_text ? o.draft_text : outline(o)} />
            <input type="hidden" name="back" value={`/ideen/${ideaId}`} />
            <SubmitButton className="btn primary small">{o.draft_text ? "Als Entwurf übernehmen" : "Gliederung als Entwurf übernehmen"}</SubmitButton>
          </form>
        </div>
        <form action={coachFeedbackAction} className="feedback">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="idea_id" value={ideaId} />
          <div className="small muted">Passt der Vorschlag zu dir? Deine Rückmeldung fließt in künftige Vorschläge ein.</div>
          <input type="text" name="feedback_note" defaultValue={row.feedback_note} maxLength={500} placeholder="Optional: warum (z. B. „zu werblich“, „falscher Account“)" aria-label="Begründung der Rückmeldung" />
          <div className="row">
            <SubmitButton className={`btn small ${row.feedback === "passt" ? "primary" : ""}`} name="feedback" value="passt">Passt</SubmitButton>
            <SubmitButton className={`btn small ${row.feedback === "passt_nicht" ? "primary" : ""}`} name="feedback" value="passt_nicht">Passt nicht</SubmitButton>
            {row.feedback ? <SubmitButton className="btn small ghost" name="feedback" value="">Zurücksetzen</SubmitButton> : null}
          </div>
        </form>
      </div>
    </div>
  );
}
