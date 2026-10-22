import { listVoiceFeedback, listVoiceTraits, styleSamples, type VoiceTrait } from "@/server/repo";
import { voiceContextText } from "@/server/context";
import { MIN_SAMPLES } from "@/lib/voice";
import { formatDateTime } from "@/lib/time";
import { Empty, PageHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { deriveVoiceAction, voiceTraitAction } from "@/app/actions";

const KIND_LABEL: Record<string, string> = { merkmal: "Merkmal", passt: "Passt zu mir", vermeiden: "Vermeiden" };

function TraitRow({ t }: { t: VoiceTrait }) {
  return (
    <li>
      <div className="row between">
        <span><span className="badge">{KIND_LABEL[t.kind] ?? t.kind}</span> {t.text}</span>
        <span className={`badge ${t.status === "bestaetigt" ? "ok" : t.status === "abgelehnt" ? "" : "warn"}`}>{t.status === "bestaetigt" ? "bestätigt" : t.status === "abgelehnt" ? "abgelehnt" : "Vorschlag"}</span>
      </div>
      {t.evidence ? <div className="small muted" style={{ marginTop: 2 }}>Beleg: {t.evidence}</div> : null}
      <details style={{ marginTop: 6 }}>
        <summary className="small">Ändern</summary>
        <form action={voiceTraitAction} className="row" style={{ marginTop: 6 }}>
          <input type="hidden" name="id" value={t.id} />
          <input type="text" name="text" defaultValue={t.text} maxLength={300} aria-label="Merkmal korrigieren" style={{ flex: 1, minWidth: 200 }} />
          <SubmitButton className="btn small" name="op" value="korrigieren">Korrigieren & bestätigen</SubmitButton>
          {t.status !== "bestaetigt" ? <SubmitButton className="btn small" name="op" value="bestaetigen">Bestätigen</SubmitButton> : null}
          {t.status !== "abgelehnt" ? <SubmitButton className="btn small" name="op" value="ablehnen">Ablehnen</SubmitButton> : null}
          <SubmitButton className="btn small danger" name="op" value="loeschen" confirm="Diesen Eintrag löschen?">Löschen</SubmitButton>
        </form>
      </details>
    </li>
  );
}

export default async function VoicePage() {
  const traits = listVoiceTraits();
  const own = traits.filter((t) => t.source === "eigen");
  const derived = traits.filter((t) => t.source === "abgeleitet");
  const feedback = listVoiceFeedback(20);
  const samples = styleSamples().filter((s) => s.text.trim().length >= 20);
  const preview = voiceContextText();
  return (
    <>
      <PageHead title="Meine Sprache" intro="Damit Vorschläge nach dir klingen. Die KI bekommt bei jeder Ausarbeitung dein bestätigtes Sprachprofil und deine begründeten Rückmeldungen als Kontext – das ist Kontextanpassung, kein Modelltraining." />
      <div className="grid grid-main-side">
        <div className="stack">
          <div className="card">
            <h2>Von dir festgelegt</h2>
            {own.length ? <ul className="list">{own.map((t) => <TraitRow key={t.id} t={t} />)}</ul> : <Empty title="Noch nichts festgelegt" />}
            <form action={voiceTraitAction} className="row" style={{ marginTop: 12 }}>
              <input type="hidden" name="op" value="add" />
              <select name="kind" defaultValue="merkmal" aria-label="Art" style={{ maxWidth: 160 }}>
                <option value="merkmal">Merkmal</option>
                <option value="passt">Passt zu mir</option>
                <option value="vermeiden">Vermeiden</option>
              </select>
              <input type="text" name="text" maxLength={300} placeholder="z. B. „Ich erzähle lieber, als zu belehren“" aria-label="Neuer Eintrag" style={{ flex: 1, minWidth: 200 }} />
              <SubmitButton className="btn">Hinzufügen</SubmitButton>
            </form>
          </div>

          <div className="card">
            <div className="card-head"><h2>Aus deinen Texten abgeleitet</h2><span className="small muted">{samples.length} eigene Texte</span></div>
            <p className="small muted">Nur messbare Merkmale mit Beleg aus deinen eigenen Worten (Originalgedanken, freigegebene Texte, „klingt nach mir“). Keine erfundenen Lieblingsformulierungen. Erst nach deiner Bestätigung fließen sie in Vorschläge ein.</p>
            {derived.length ? <ul className="list">{derived.map((t) => <TraitRow key={t.id} t={t} />)}</ul> : <p className="small">Noch keine abgeleiteten Merkmale.</p>}
            <form action={deriveVoiceAction} style={{ marginTop: 10 }}>
              <SubmitButton className="btn" pendingText="Wertet aus…">Aus meinen Texten ableiten</SubmitButton>
              {samples.length < MIN_SAMPLES ? <span className="small muted"> · ab {MIN_SAMPLES} Texten mit etwas Länge</span> : null}
            </form>
          </div>

          <div className="card">
            <h2>Deine Rückmeldungen</h2>
            {feedback.length ? (
              <ul className="list">
                {feedback.map((f) => (
                  <li key={f.id} className="small">
                    <strong>{f.verdict === "nach_mir" ? "Klingt nach mir" : "Klingt nicht nach mir"}</strong>{f.note ? ` – ${f.note}` : ""} <span className="muted">({formatDateTime(f.created_at)})</span>
                    <div className="muted">„{f.excerpt.slice(0, 180)}{f.excerpt.length > 180 ? "…" : ""}“</div>
                  </li>
                ))}
              </ul>
            ) : <p className="small muted">Noch keine. Du gibst sie direkt am Content-Paket einer Idee.</p>}
          </div>
        </div>
        <aside className="card">
          <h3>Das bekommt die KI als Kontext</h3>
          {preview ? <pre className="small" style={{ whiteSpace: "pre-wrap" }}>{preview}</pre> : <p className="small muted">Noch nichts bestätigt.</p>}
        </aside>
      </div>
    </>
  );
}
