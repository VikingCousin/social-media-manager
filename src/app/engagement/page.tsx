import Link from "next/link";
import { listAccounts, listEngagement } from "@/server/repo";
import { formatDateTime } from "@/lib/time";
import { AccountChip, Empty, PageHead } from "@/components/ui";
import { AccountSelect } from "@/components/AccountChecks";
import { SubmitButton } from "@/components/SubmitButton";
import { createEngagementAction } from "@/app/actions";

export default async function EngagementPage() {
  const accounts = listAccounts();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const items = listEngagement();
  const linkedin = accounts.find((a) => a.platform === "linkedin");
  return (
    <>
      <PageHead title="LinkedIn-Engagement" intro="Fremden Beitrag oder deine Notizen dazu einfügen und einen fachlich hilfreichen Kommentar als Entwurf entwickeln. Nichts wird automatisch geliked, kommentiert oder verschickt – du kopierst den Kommentar selbst." />
      <div className="grid grid-main-side">
        <form action={createEngagementAction} className="card">
          <h2>Neuer Kommentarentwurf</h2>
          <div className="grid grid-2">
            <div><label>Mein Account</label><AccountSelect accounts={accounts} value={linkedin?.id ?? null} /></div>
            <div><label htmlFor="source_url">Link zum Beitrag (optional)</label><input id="source_url" name="source_url" type="url" placeholder="https://www.linkedin.com/posts/…" /></div>
          </div>
          <div className="field">
            <label htmlFor="source_text">Beitragstext oder Zusammenfassung</label>
            <textarea id="source_text" name="source_text" maxLength={20000} placeholder="Text des fremden Beitrags hier einfügen. Er wird nur als Daten behandelt." />
          </div>
          <div className="field">
            <label htmlFor="my_notes">Meine Notizen / Haltung</label>
            <textarea id="my_notes" name="my_notes" maxLength={10000} placeholder="Worauf willst du eingehen? Stimmst du zu, widersprichst du, hast du eine Frage oder eigene Erfahrung dazu?" />
            <div className="hint">Ohne deine Haltung formuliert der Entwurf neutral – er erfindet keine Zustimmung und keine Erfahrung.</div>
          </div>
          <div className="field">
            <label htmlFor="comment">Kommentar (optional, direkt selbst schreiben)</label>
            <textarea id="comment" name="comment" maxLength={5000} />
          </div>
          <div className="row" style={{ marginTop: 12 }}><SubmitButton className="btn primary">Anlegen</SubmitButton></div>
        </form>
        <div className="card">
          <h3>Bisherige Entwürfe</h3>
          {items.length === 0 ? (
            <Empty title="Noch nichts gesammelt">Hier landen deine Kommentarentwürfe.</Empty>
          ) : (
            <ul className="list">
              {items.map((e) => (
                <li key={e.id}>
                  <Link href={`/engagement/${e.id}`} className="item-title small">{(e.source_text || e.my_notes).slice(0, 80) || "Ohne Text"}</Link>
                  <div className="row small muted" style={{ marginTop: 4 }}>
                    <AccountChip account={e.account_id ? byId.get(e.account_id) : null} />
                    <span className={`badge ${e.status === "verwendet" ? "ok" : ""}`}>{e.status === "verwendet" ? "verwendet" : e.comment ? "Kommentar vorhanden" : "ohne Kommentar"}</span>
                    <span>{formatDateTime(e.updated_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
