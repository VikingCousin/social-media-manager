import Link from "next/link";
import { listAccounts, listRadarPosts, listWatchProfiles } from "@/server/repo";
import { PLATFORMS } from "@/lib/domain";
import { OUTLIER_FACTOR, OUTLIER_MIN_BASELINE, RELATIONS, classifyHook, outlierLabel, radarOverview, type Outlier } from "@/lib/radar";
import { formatDate } from "@/lib/time";
import { Empty, Metric, PageHead } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { RadarPostForm, WatchProfileForm, profileLabel } from "@/components/RadarForms";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function RadarPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = one("q").slice(0, 100);
  const archived = one("ansicht") === "archiv";
  const accountId = /^\d+$/.test(one("account")) ? Number(one("account")) : undefined;
  const accounts = listAccounts();
  const profiles = listWatchProfiles();
  const byProfile = new Map(listWatchProfiles(true).map((p) => [p.id, p]));
  const posts = listRadarPosts({ archived, q, accountId });
  const overview = radarOverview(posts);
  const outlierIds = new Map<number, Outlier>(overview.profiles.flatMap((s) => s.outliers.map((o) => [o.id, o] as const)));

  return (
    <>
      <PageHead
        title="Content-Radar"
        intro="Konkurrenz, Vorbilder und Inspiration beobachten: Profile und zugängliche Beiträge mit Quelle und Datum erfassen, Muster erkennen, eigene Ideen ableiten."
      />
      <div className="notice info" style={{ marginBottom: 14 }}>
        Externe Beobachtungen – getrennt von deinen eigenen Leistungsdaten. Erfasst wird manuell; ein automatisches Auslesen fremder Profile gibt es nicht. Sichtbare Zahlen sind Momentaufnahmen.
      </div>

      <div className="grid grid-main-side">
        <div className="stack">
          <form className="row" method="get">
            <input type="search" name="q" defaultValue={q} placeholder="Radar durchsuchen…" style={{ maxWidth: 260, flex: 1 }} enterKeyHint="search" aria-label="Radar durchsuchen" />
            <AutoSubmitSelect name="account" defaultValue={accountId ?? ""} style={{ maxWidth: 240 }} aria-label="Nach meinem Account filtern">
              <option value="">Für alle meine Accounts</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>Relevant für {PLATFORMS[a.platform]} · {a.display_name}</option>)}
            </AutoSubmitSelect>
            {archived ? <input type="hidden" name="ansicht" value="archiv" /> : null}
            <noscript><button className="btn small" type="submit">Filtern</button></noscript>
            <Link href={archived ? "/radar" : "/radar?ansicht=archiv"} className="btn ghost small">{archived ? "← Aktive" : "Archiv"}</Link>
          </form>

          <div className="card">
            <div className="card-head"><h2>Auswertung</h2><span className="small muted">{overview.n} Beitr{overview.n === 1 ? "ag" : "äge"} · extern</span></div>
            {overview.n === 0 ? (
              <Empty title="Noch nichts im Radar">Lege rechts ein Profil an, das du beobachten willst, und erfasse dort auffällige Beiträge.</Empty>
            ) : (
              <>
                <ul className="small">{overview.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                <div className="grid grid-2">
                  <div>
                    <h3>Formate</h3>
                    {overview.formats.length ? <ul className="small">{overview.formats.slice(0, 6).map((f) => <li key={f.key}>{f.key}: {f.n}</li>)}</ul> : <p className="small muted">Keine Formate notiert.</p>}
                  </div>
                  <div>
                    <h3>Einstiegs-Typen</h3>
                    {overview.hookTypes.length ? <ul className="small">{overview.hookTypes.map((h) => <li key={h.key}>{h.key}: {h.n}</li>)}</ul> : <p className="small muted">Keine Einstiege notiert.</p>}
                    <p className="small muted">Automatische, regelbasierte Grobeinordnung.</p>
                  </div>
                </div>
                {outlierIds.size ? (
                  <p className="small" style={{ marginTop: 8 }}>
                    <strong>Ausreißer:</strong> {outlierIds.size} Beitr{outlierIds.size === 1 ? "ag hat" : "äge haben"} mindestens {OUTLIER_FACTOR}× so viele Views wie der Median der übrigen erfassten Beiträge desselben Profils (mindestens {OUTLIER_MIN_BASELINE} Vergleichswerte). Markiert mit ↑. Grundlage sind nur von dir erfasste Beiträge – meist die auffälligen –, nicht alle Beiträge des Profils.
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="card">
            <h2>Erfasste Beiträge</h2>
            {posts.length === 0 ? (
              <Empty title={q || accountId ? "Keine Treffer" : archived ? "Archiv ist leer" : "Noch keine Beiträge"}>{q || accountId || archived ? null : "Beiträge erfasst du über ein beobachtetes Profil oder rechts unter „Beitrag erfassen“."}</Empty>
            ) : (
              <ul className="list">
                {posts.map((p) => {
                  const prof = p.profile_id ? byProfile.get(p.profile_id) : undefined;
                  const factor = outlierIds.get(p.id);
                  return (
                    <li key={p.id}>
                      <div className="row between">
                        <Link href={`/radar/beitrag/${p.id}`} className="item-title">{p.title || p.hook.slice(0, 90) || p.observation.slice(0, 90) || p.url || "Beitrag"}</Link>
                        <span className="small muted">{formatDate(p.posted_on ?? p.captured_on)}</span>
                      </div>
                      <div className="row small muted" style={{ marginTop: 4 }}>
                        {prof ? <Link href={`/radar/profil/${prof.id}`} className="badge">{profileLabel(prof)}</Link> : p.platform ? <span className="badge">{PLATFORMS[p.platform]}</span> : null}
                        {p.format ? <span>{p.format}</span> : null}
                        {p.hook ? <span>Einstieg: {classifyHook(p.hook)}</span> : null}
                        <span>Views: <Metric value={p.views} /></span>
                        {factor ? <span className="badge warn wrap">{outlierLabel(factor)}</span> : null}
                        {p.analysis_json ? <span className="badge accent">analysiert</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <aside className="stack">
          <div className="card">
            <div className="card-head"><h3>Beobachtete Profile</h3><span className="small muted">{profiles.length}</span></div>
            {profiles.length === 0 ? (
              <p className="small muted">Noch keine Profile. Lege unten das erste an.</p>
            ) : (
              <ul className="list">
                {profiles.map((p) => (
                  <li key={p.id}>
                    <Link href={`/radar/profil/${p.id}`} className="item-title small">{profileLabel(p)}</Link>
                    <div className="small muted">{RELATIONS[p.relation] ?? p.relation}{p.last_checked_at ? ` · angesehen ${formatDate(p.last_checked_at)}` : " · noch nicht angesehen"}</div>
                  </li>
                ))}
              </ul>
            )}
            <details style={{ marginTop: 10 }}>
              <summary><strong>＋ Profil beobachten</strong></summary>
              <div style={{ marginTop: 10 }}><WatchProfileForm accounts={accounts} idPrefix="neu-wp" /></div>
            </details>
          </div>
          <div className="card">
            <details>
              <summary><strong>＋ Beitrag erfassen</strong></summary>
              <div style={{ marginTop: 10 }}><RadarPostForm profiles={profiles} idPrefix="neu-rp" back="/radar" /></div>
            </details>
          </div>
        </aside>
      </div>
    </>
  );
}
