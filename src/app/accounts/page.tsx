import Link from "next/link";
import { listAccounts, listIdeas, postCountsByAccount } from "@/server/repo";
import { PLATFORMS, positioningGaps } from "@/lib/domain";
import { PageHead, Empty } from "@/components/ui";
import { archiveAccountAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function AccountsPage() {
  const accounts = listAccounts();
  const archived = listAccounts(true).filter((a) => a.archived);
  const ideas = listIdeas();
  const posts = postCountsByAccount();
  return (
    <>
      <PageHead title="Accounts & Strategie" intro="Zielgruppe, Positionierung, Themen, Tonalität und Ziele pro Account. Die Ausrichtung darf offen bleiben, bis deine Ideen und Ziele klarer sind.">
        <Link href="/accounts/neu" className="btn primary">Account anlegen</Link>
      </PageHead>
      {accounts.length === 0 ? (
        <Empty title="Keine aktiven Accounts">Lege einen Account an, um Ideen zuzuordnen.</Empty>
      ) : (
        <div className="grid grid-2">
          {accounts.map((a) => {
            const gaps = positioningGaps(a);
            const ideaCount = ideas.filter((i) => i.account_ids.includes(a.id)).length;
            return (
              <div className="card" key={a.id}>
                <div className="card-head">
                  <div>
                    <div className="small muted">{PLATFORMS[a.platform] ?? a.platform}</div>
                    <h2 style={{ margin: 0 }}>{a.display_name} <span className="muted" style={{ fontWeight: 400 }}>{a.handle.startsWith("@") ? a.handle : ""}</span></h2>
                  </div>
                  <Link href={`/accounts/${a.id}`} className="btn small">Bearbeiten</Link>
                </div>
                <p className="small pre clamp">{a.positioning || "Positionierung noch offen."}</p>
                <div className="row small">
                  <span className="badge">API: nicht verbunden</span>
                  {gaps.length ? <span className="badge warn">Offen: {gaps.join(", ")}</span> : <span className="badge ok">Steckbrief ausgefüllt</span>}
                </div>
                <div className="row small muted" style={{ marginTop: 10 }}>
                  <Link href={`/ideen?account=${a.id}`}>{ideaCount} verknüpfte Idee{ideaCount === 1 ? "" : "n"}</Link>
                  <span>·</span>
                  <Link href={`/performance?account=${a.id}`}>{posts[a.id] ?? 0} erfasste Beiträge</Link>
                  {a.profile_url ? (<><span>·</span><a href={a.profile_url} target="_blank" rel="noopener noreferrer">Profil öffnen ↗</a></>) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {archived.length ? (
        <div className="card" style={{ marginTop: 24 }}>
          <h3>Archivierte Accounts</h3>
          <ul className="list">
            {archived.map((a) => (
              <li key={a.id} className="row between">
                <span>{PLATFORMS[a.platform]} · {a.display_name}</span>
                <form action={archiveAccountAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="archived" value="0" />
                  <SubmitButton className="btn small">Wiederherstellen</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
