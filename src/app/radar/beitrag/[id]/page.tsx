import Link from "next/link";
import { notFound } from "next/navigation";
import { getRadarPost, getWatchProfile, listAccounts, listWatchProfiles } from "@/server/repo";
import { aiConfigured, currentModel, type RadarAnalysis } from "@/server/ai";
import { classifyHook } from "@/lib/radar";
import { copyableRadarPrompt } from "@/lib/prompts";
import { formatDate, formatDateTime } from "@/lib/time";
import { AccountChip, PageHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { CopyButton } from "@/components/CopyButton";
import { RadarPostForm, profileLabel } from "@/components/RadarForms";
import { analyzeRadarPostAction, archiveRadarPostAction, deleteRadarPostAction, ideaFromRadarPostAction } from "@/app/actions";

export default async function RadarPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = /^\d+$/.test(id) ? getRadarPost(Number(id)) : undefined;
  if (!r) notFound();
  const profile = r.profile_id ? getWatchProfile(r.profile_id) : undefined;
  const accounts = listAccounts();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  let analysis: (RadarAnalysis & { model?: string; at?: string }) | null = null;
  try {
    analysis = r.analysis_json ? JSON.parse(r.analysis_json) : null;
  } catch {
    analysis = null;
  }
  const ai = aiConfigured();
  const prompt = copyableRadarPrompt(r, accounts);
  return (
    <>
      <PageHead
        title={r.title || "Radar-Beitrag"}
        intro={<>Erfasst {formatDate(r.captured_on)}{r.posted_on ? ` · veröffentlicht ${formatDate(r.posted_on)}` : ""}{r.source ? ` · Quelle: ${r.source}` : ""}{profile ? <> · <Link href={`/radar/profil/${profile.id}`}>{profileLabel(profile)}</Link></> : null}</>}
      >
        <Link href={profile ? `/radar/profil/${profile.id}` : "/radar"} className="btn">Zurück</Link>
        {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn">Original öffnen ↗</a> : null}
        <form action={ideaFromRadarPostAction}>
          <input type="hidden" name="id" value={r.id} />
          <SubmitButton className="btn primary">Eigene Idee daraus</SubmitButton>
        </form>
      </PageHead>
      <div className="notice info" style={{ marginBottom: 14 }}>Externer Beitrag – Beobachtung, kein Beleg für dein Publikum. Übernimm Blickwinkel, nie fremde Erlebnisse.</div>

      <div className="grid grid-main-side">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Analyse</h2>{r.hook ? <span className="badge">Einstieg (Grobeinordnung): {classifyHook(r.hook)}</span> : null}</div>
            {analysis ? (
              <div className="stack">
                <p className="small muted">KI-Analyse vom {formatDateTime(analysis.at)} · {analysis.model} – Vermutungen, bitte kritisch prüfen.</p>
                <div><h3>Einstieg</h3><p>{analysis.hook_type}</p></div>
                <div><h3>Struktur</h3><ol className="hooks">{analysis.structure.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
                <div><h3>Mögliche Gründe (Vermutungen)</h3><ul className="hooks">{analysis.possible_reasons.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                {analysis.angles.length ? (
                  <div>
                    <h3>Eigene Blickwinkel</h3>
                    <ul className="list">{analysis.angles.map((a, i) => <li key={i}><AccountChip account={byId.get(a.account_id)} /> <span>{a.angle}</span></li>)}</ul>
                  </div>
                ) : null}
                {analysis.cautions.length ? <div className="notice warn small"><strong>Vorsicht / fehlende Daten:</strong><ul style={{ margin: "6px 0 0" }}>{analysis.cautions.map((c, i) => <li key={i}>{c}</li>)}</ul></div> : null}
              </div>
            ) : (
              <p className="small muted">Noch keine KI-Analyse. Die regelbasierte Einordnung des Einstiegs steht oben.</p>
            )}
            {ai ? (
              <form action={analyzeRadarPostAction} style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={r.id} />
                <div className="row">
                  <SubmitButton className="btn" pendingText="Analysiert…" confirm={analysis ? "Vorhandene Analyse ersetzen?" : undefined}>{analysis ? "Neu analysieren" : "Mit KI analysieren"}</SubmitButton>
                  <span className="small muted">Modell: {currentModel()} · kostenpflichtig</span>
                </div>
              </form>
            ) : (
              <details style={{ marginTop: 12 }}>
                <summary>Ohne API-Schlüssel: Analyse-Prompt kopieren</summary>
                <div className="row" style={{ margin: "8px 0" }}><CopyButton text={prompt} label="Prompt kopieren" /></div>
                <div className="copybox"><pre>{prompt}</pre></div>
                <p className="small muted">Das Ergebnis kannst du unter „Deine Beobachtung“ ergänzen.</p>
              </details>
            )}
          </div>
          <div className="card">
            <h2>Beitrag bearbeiten</h2>
            <RadarPostForm profiles={listWatchProfiles()} post={r} back={`/radar/beitrag/${r.id}`} idPrefix="ed" />
          </div>
        </div>
        <aside className="stack">
          <div className="card">
            <h3>Ablage</h3>
            <div className="row">
              <form action={archiveRadarPostAction}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="archived" value={r.archived ? "0" : "1"} />
                <input type="hidden" name="back" value={r.archived ? `/radar/beitrag/${r.id}` : "/radar"} />
                <SubmitButton className="btn small">{r.archived ? "Wieder aktivieren" : "Archivieren"}</SubmitButton>
              </form>
              {r.archived ? (
                <form action={deleteRadarPostAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton className="btn small danger" confirm="Beitrag endgültig löschen?">Löschen</SubmitButton>
                </form>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
