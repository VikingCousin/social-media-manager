import Link from "next/link";
import { listAccounts, listPosts, listRadarPosts, postCountsByAccount } from "@/server/repo";
import { suggestExperiments } from "@/lib/experiments";
import { classifyHook, countBy } from "@/lib/radar";
import { summarize, engagementRate, MIN_POSTS_FOR_PATTERNS } from "@/lib/analytics";
import { METRIC_FIELDS, METRIC_LABELS } from "@/lib/csv";
import { PLATFORMS } from "@/lib/domain";
import { formatDateTime } from "@/lib/time";
import { Empty, Metric, PageHead } from "@/components/ui";
import { PostForm } from "@/components/PostForm";

type SP = Promise<Record<string, string | string[] | undefined>>;

function pct(v: number | null) {
  return v === null ? <span className="unknown">unbekannt</span> : `${(v * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

export default async function PerformancePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const accounts = listAccounts(true);
  const counts = postCountsByAccount();
  const requested = typeof sp.account === "string" && /^\d+$/.test(sp.account) ? Number(sp.account) : undefined;
  const active = accounts.find((a) => a.id === requested) ?? accounts.find((a) => counts[a.id]) ?? accounts.find((a) => !a.archived);
  const posts = active ? listPosts(active.id) : [];
  const s = summarize(posts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const radarPosts = active ? listRadarPosts({ accountId: active.id }) : [];
  const experiments = active
    ? suggestExperiments(
        s,
        posts.map((p) => p.format),
        countBy(radarPosts, (p) => p.format),
        countBy(radarPosts.filter((p) => p.hook.trim()), (p) => classifyHook(p.hook)),
      )
    : [];

  return (
    <>
      <PageHead title="Performance & Analyse" intro="Eigene Beiträge und Kennzahlen erfassen oder importieren, Muster erkennen und nächste Experimente ableiten. Auswertungen gelten immer nur innerhalb eines Accounts.">
        <Link href="/performance/import" className="btn primary">CSV importieren</Link>
        <a href="/performance/vorlage" className="btn">CSV-Vorlage herunterladen</a>
      </PageHead>

      <div className="row" style={{ marginBottom: 16 }}>
        {accounts.filter((a) => !a.archived || counts[a.id]).map((a) => (
          <Link key={a.id} href={`/performance?account=${a.id}`} className={`btn small ${a.id === active?.id ? "primary" : ""}`}>
            {PLATFORMS[a.platform]} · {a.display_name} ({counts[a.id] ?? 0})
          </Link>
        ))}
      </div>

      {!active ? (
        <Empty title="Keine Accounts">Lege zuerst einen Account an.</Empty>
      ) : (
        <div className="stack">
          {total === 0 ? (
            <div className="notice info">
              Noch keine Leistungsdaten. Trage Werte aus der Statistik-Ansicht der Plattform manuell ein oder nutze die CSV-Vorlage. Es gibt in Version 1 keine automatische Abfrage von LinkedIn, Instagram oder TikTok.
            </div>
          ) : null}

          <div className="card">
            <div className="card-head"><h2>Auswertung: {active.display_name}</h2><span className="small muted">{s.n} Beitr{s.n === 1 ? "ag" : "äge"}</span></div>
            {s.n === 0 ? (
              <Empty title="Für diesen Account sind noch keine Beiträge erfasst">Unten manuell erfassen oder eine CSV importieren.</Empty>
            ) : (
              <>
                <div className="grid grid-3" style={{ marginBottom: 14 }}>
                  <div className="stat"><div className="v">{s.n}</div><div className="l">erfasste Beiträge</div></div>
                  <div className="stat"><div className="v"><Metric value={s.medianViews} /></div><div className="l">Median Views ({s.coverage.views} mit Wert)</div></div>
                  <div className="stat"><div className="v">{pct(s.medianRate)}</div><div className="l">Median Interaktionsrate*</div></div>
                </div>
                <h3>Beobachtungen</h3>
                <ul className="small">{s.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                <p className="small muted">* Interaktionen = Likes + Kommentare + Shares + Saves, geteilt durch Views (oder Reichweite, falls Views fehlen). Nur Beiträge, bei denen alle Werte bekannt sind. Muster ab {MIN_POSTS_FOR_PATTERNS} Beiträgen. Das sind Beobachtungen aus deinen eigenen Beiträgen – keine externen Trends.</p>

                {s.enoughData ? (
                  <div className="grid grid-2" style={{ marginTop: 14 }}>
                    {[["Nach Format", s.byFormat], ["Nach Thema", s.byTopic]].map(([label, groups]) => (
                      <div key={label as string}>
                        <h3>{label as string}</h3>
                        <div className="table-wrap"><table>
                          <thead><tr><th>Gruppe</th><th className="num">n</th><th className="num">Median Views</th><th className="num">Median Rate</th></tr></thead>
                          <tbody>
                            {(groups as typeof s.byFormat).map((g) => (
                              <tr key={g.key}><td>{g.key}</td><td className="num">{g.n}</td><td className="num"><Metric value={g.medianViews} /></td><td className="num">{pct(g.medianRate)}</td></tr>
                            ))}
                          </tbody>
                        </table></div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <h3 style={{ marginTop: 18 }}>Kennzahlen-Abdeckung</h3>
                <div className="row small">
                  {METRIC_FIELDS.map((f) => <span key={f} className={`badge ${s.coverage[f] === s.n ? "ok" : s.coverage[f] === 0 ? "" : "warn"}`}>{METRIC_LABELS[f]}: {s.coverage[f]}/{s.n}</span>)}
                </div>
              </>
            )}
          </div>

          {experiments.length ? (
            <div className="card">
              <div className="card-head"><h2>Nächste Experimente</h2><span className="small muted">{active!.display_name}</span></div>
              <ul className="list">
                {experiments.map((e, i) => (
                  <li key={i}>
                    <div className="item-title">{e.title}</div>
                    <p className="small" style={{ margin: "4px 0" }}>{e.why}</p>
                    <div className="row small"><span className="src">{e.source}</span><span className={`badge ${e.confidence === "mittel" ? "accent" : ""}`}>Belastbarkeit: {e.confidence}</span></div>
                  </li>
                ))}
              </ul>
              <p className="small muted" style={{ marginTop: 8 }}>Vorschläge aus festen Regeln – keine Prognose. Radar-Hinweise beziehen sich auf Profile, die für diesen Account beobachtet werden.</p>
            </div>
          ) : null}

          {posts.length ? (
            <div className="card">
              <h2>Beiträge</h2>
              <div className="table-wrap"><table>
                <thead><tr>
                  <th>Veröffentlicht</th><th>Format / Thema</th>
                  {METRIC_FIELDS.map((f) => <th key={f} className="num">{METRIC_LABELS[f]}</th>)}
                  <th className="num">Rate</th><th></th>
                </tr></thead>
                <tbody>
                  {posts.map((p) => {
                    const r = engagementRate(p);
                    return (
                      <tr key={p.id}>
                        <td>{formatDateTime(p.published_at)}{p.url ? <><br /><a href={p.url} target="_blank" rel="noopener noreferrer" className="small">Link ↗</a></> : null}</td>
                        <td>{p.format || <span className="unknown">–</span>}<br /><span className="small muted">{p.topic}</span></td>
                        {METRIC_FIELDS.map((f) => <td key={f} className="num"><Metric value={p[f]} decimals={f === "watch_time_seconds" ? 1 : 0} /></td>)}
                        <td className="num">{r ? pct(r.rate) : <span className="unknown">–</span>}</td>
                        <td><Link href={`/performance/${p.id}`} className="btn small">Bearbeiten</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          ) : null}

          <div className="card">
            <details open={posts.length === 0}>
              <summary><strong>Beitrag manuell erfassen</strong></summary>
              <div style={{ marginTop: 12 }}>
                <PostForm accounts={accounts.filter((a) => !a.archived)} defaultAccountId={active.id} back={`/performance?account=${active.id}`} />
              </div>
            </details>
          </div>
        </div>
      )}
    </>
  );
}
