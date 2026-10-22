import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount, getWatchProfile, listAccounts, listRadarPosts, listWatchProfiles } from "@/server/repo";
import { OUTLIER_MIN_BASELINE, RELATIONS, classifyHook, outlierLabel, profileStats } from "@/lib/radar";
import { formatDate, formatDateTime } from "@/lib/time";
import { AccountChip, Empty, Metric, PageHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { RadarPostForm, WatchProfileForm, profileLabel } from "@/components/RadarForms";
import { archiveWatchProfileAction, markProfileCheckedAction } from "@/app/actions";

export default async function WatchProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = /^\d+$/.test(id) ? getWatchProfile(Number(id)) : undefined;
  if (!p) notFound();
  const posts = listRadarPosts({ profileId: p.id });
  const stat = profileStats(posts)[0];
  const outliers = new Map((stat?.outliers ?? []).map((o) => [o.id, o]));
  const account = p.account_id ? getAccount(p.account_id) : undefined;
  return (
    <>
      <PageHead title={profileLabel(p)} intro={<>{RELATIONS[p.relation] ?? p.relation}{account ? <> · relevant für <AccountChip account={account} /></> : null}{p.last_checked_at ? ` · zuletzt angesehen ${formatDateTime(p.last_checked_at)}` : " · noch nicht angesehen"}</>}>
        <Link href="/radar" className="btn">Zum Radar</Link>
        {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn">Profil öffnen ↗</a> : null}
        <form action={markProfileCheckedAction}>
          <input type="hidden" name="id" value={p.id} />
          <SubmitButton className="btn">Heute angesehen</SubmitButton>
        </form>
      </PageHead>

      <div className="grid grid-main-side">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Beiträge dieses Profils</h2><span className="small muted">{posts.length}</span></div>
            {stat && stat.knownViews > 0 ? (
              <p className="small">Median sichtbarer Views über alle erfassten Beiträge: <Metric value={stat.medianViews} /> ({stat.knownViews} von {stat.n} mit Wert). Ausreißer (↑) werden jeweils gegen den Median der <em>übrigen</em> Beiträge gemessen. {stat.knownViews <= OUTLIER_MIN_BASELINE ? `Ausreißer werden erst ab ${OUTLIER_MIN_BASELINE + 1} Beiträgen mit Views erkannt (jeder Beitrag wird mit mindestens ${OUTLIER_MIN_BASELINE} anderen verglichen).` : null}</p>
            ) : null}
            {posts.length === 0 ? (
              <Empty title="Noch keine Beiträge erfasst">Erfasse rechts auffällige Beiträge – mit Link, Einstieg und sichtbaren Zahlen.</Empty>
            ) : (
              <ul className="list">
                {posts.map((r) => (
                  <li key={r.id}>
                    <div className="row between">
                      <Link href={`/radar/beitrag/${r.id}`} className="item-title">{r.title || r.hook.slice(0, 90) || r.observation.slice(0, 90) || "Beitrag"}</Link>
                      <span className="small muted">{formatDate(r.posted_on ?? r.captured_on)}</span>
                    </div>
                    <div className="row small muted" style={{ marginTop: 4 }}>
                      {r.format ? <span>{r.format}</span> : null}
                      {r.hook ? <span>Einstieg: {classifyHook(r.hook)}</span> : null}
                      <span>Views: <Metric value={r.views} /></span>
                      {outliers.get(r.id) ? <span className="badge warn wrap">{outlierLabel(outliers.get(r.id)!)}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h2>Beitrag erfassen</h2>
            <RadarPostForm profiles={listWatchProfiles()} defaultProfileId={p.id} back={`/radar/profil/${p.id}`} idPrefix="pp" />
          </div>
        </div>
        <aside className="stack">
          <div className="card">
            <h3>Profil</h3>
            <WatchProfileForm accounts={listAccounts()} profile={p} />
          </div>
          <form action={archiveWatchProfileAction} className="card">
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="archived" value={p.archived ? "0" : "1"} />
            <p className="small muted">{p.archived ? "Dieses Profil ist archiviert." : "Nicht mehr beobachten? Erfasste Beiträge bleiben erhalten."}</p>
            <SubmitButton className={`btn small ${p.archived ? "" : "danger"}`}>{p.archived ? "Wieder beobachten" : "Archivieren"}</SubmitButton>
          </form>
        </aside>
      </div>
    </>
  );
}
