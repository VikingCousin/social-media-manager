import { voiceFeedbackAction } from "@/app/actions";
import type { VoiceFeedback } from "@/server/repo";
import { formatDateTime } from "@/lib/time";
import { SubmitButton } from "./SubmitButton";

/** „Klingt nach mir / klingt nicht nach mir“ – fließt als Kontext in künftige Vorschläge ein (kein Modelltraining). */
export function VoiceFeedbackForm({ draftId, back, history }: { draftId: number; back: string; history: VoiceFeedback[] }) {
  return (
    <form action={voiceFeedbackAction} className="voice-fb">
      <input type="hidden" name="draft_id" value={draftId} />
      <input type="hidden" name="back" value={back} />
      <div className="row">
        <label htmlFor={`vf-field-${draftId}`} className="small" style={{ margin: 0 }}>Bezieht sich auf</label>
        <select id={`vf-field-${draftId}`} name="field" defaultValue="body" style={{ maxWidth: 220 }}>
          <option value="body">Skript / Text</option>
          <option value="hook">Gesprochener Einstieg</option>
          <option value="caption">Caption</option>
        </select>
      </div>
      <input type="text" name="note" maxLength={500} placeholder="Warum? (bei „klingt nicht nach mir“ nötig, z. B. „zu glatt“, „so rede ich nicht“)" aria-label="Begründung" />
      <div className="row">
        <SubmitButton className="btn small" name="verdict" value="nach_mir">Klingt nach mir</SubmitButton>
        <SubmitButton className="btn small" name="verdict" value="nicht_nach_mir">Klingt nicht nach mir</SubmitButton>
      </div>
      <p className="small muted">Wird als Kontext für künftige Vorschläge genutzt – Kontextanpassung, kein Modelltraining. <a href="/sprache">Meine Sprache</a></p>
      {history.length ? (
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {history.slice(0, 3).map((h) => <li key={h.id}>{h.verdict === "nach_mir" ? "Klingt nach mir" : "Klingt nicht nach mir"}{h.note ? ` – ${h.note}` : ""} <span className="muted">({formatDateTime(h.created_at)})</span></li>)}
        </ul>
      ) : null}
    </form>
  );
}
