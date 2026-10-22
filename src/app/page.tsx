import Link from "next/link";
import { countIdeas, listPosts } from "@/server/repo";
import { aiConfigured } from "@/server/ai";
import { automationStatus, overviewData } from "@/server/context";
import { summarize } from "@/lib/analytics";
import type { Recommendation } from "@/lib/planner";
import { formatDateTime } from "@/lib/time";
import { AccountChip, Empty, PageHead } from "@/components/ui";
import { QuickCapture } from "@/components/QuickCapture";
import { InstallHint } from "@/components/InstallHint";
import type { Account } from "@/lib/domain";

const STATE_TONE: Record<string, string> = { aktiv: "ok", manuell: "warn", aus: "", "nicht verfügbar": "" };

function RecommendationCard({ r, byId, primary }: { r: Recommendation; byId: Map<number, Account>; primary: boolean }) {
  return (
    <div className={primary ? "rec rec-primary" : "rec"}>
      <div className="row between">
        <div className="row">
          <AccountChip account={r.account_id ? byId.get(r.account_id) : null} />
          <span className="badge">{r.stage}</span>
        </div>
        <Link href={r.action.href} className={`btn small ${primary ? "primary" : ""}`}>{r.action.label}</Link>
      </div>
      <div className={primary ? "rec-title" : "item-title"} style={{ marginTop: 8 }}>{r.title}</div>
      <div className="grid grid-2 rec-cols" style={{ marginTop: 8 }}>
        <div>
          <div className="small muted">Warum</div>
          <ul className="small rec-list">
            {r.reasons.map((x, i) => (
              <li key={i}>{x.text} <span className="src">{x.source}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="small muted">Was noch fehlt</div>
          {r.missing.length ? (
            <ul className="small rec-list">{r.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
          ) : (
            <p className="small">Nichts – bereit.</p>
          )}
        </div>
      </div>
      {r.uncertainty.length ? <p className="small muted" style={{ marginTop: 6 }}>Unsicherheit: {r.uncertainty.join(" ")}</p> : null}
    </div>
  );
}

export default async function OverviewPage() {
  const { accounts, recommendations, tasks, pendingApprovals, pipelineEmpty } = overviewData();
  const status = automationStatus();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const ideaCount = countIdeas();
  const insights = accounts.map((a) => ({ account: a, s: summarize(listPosts(a.id)) })).filter((x) => x.s.n > 0);
  const [first, ...rest] = recommendations;

  return (
    <>
      <PageHead title="Übersicht" intro="Was du als Nächstes posten solltest, was ansteht und was tatsächlich verbunden ist." />
      <InstallHint />

      <div className="grid grid-main-side">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2>Als Nächstes posten</h2>
              <span className="small muted">aus Plan, Ideen und erfassten Daten</span>
            </div>
            {first ? (
              <>
                <RecommendationCard r={first} byId={byId} primary />
                {rest.length ? (
                  <>
                    <div className="small muted" style={{ margin: "14px 0 6px" }}>Alternativen</div>
                    <div className="stack">{rest.map((r) => <RecommendationCard key={r.key} r={r} byId={byId} primary={false} />)}</div>
                  </>
                ) : null}
                <p className="small muted" style={{ marginTop: 12 }}>
                  Regelbasiert und nachvollziehbar: Reihenfolge nach Planungsstand, deiner Zuordnung, Coach-Empfehlungen und Pausen pro Account. Keine Prognose von Reichweite.
                </p>
              </>
            ) : (
              <Empty title={pipelineEmpty ? "Noch nichts in der Pipeline" : "Keine Empfehlung möglich"}>
                Halte unten eine Idee fest und ordne sie einem Account zu – dann kann ich vorschlagen, was als Nächstes dran ist.
              </Empty>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Schnelle Idee</h2>
              <Link href="/ideen" className="small">{ideaCount} aktive Idee{ideaCount === 1 ? "" : "n"} →</Link>
            </div>
            <QuickCapture accounts={accounts.map((a) => ({ id: a.id, platform: a.platform, display_name: a.display_name }))} />
          </div>

          <div className="card">
            <div className="card-head"><h2>Erkenntnisse aus deinen Daten</h2><Link href="/performance" className="small">Analyse →</Link></div>
            {insights.length === 0 ? (
              <Empty title="Noch keine Leistungsdaten">Sobald du Beiträge mit Kennzahlen erfasst oder importierst, erscheinen hier vorsichtige Beobachtungen – je Account getrennt.</Empty>
            ) : (
              <ul className="list">
                {insights.map(({ account, s }) => (
                  <li key={account.id}>
                    <div className="row"><AccountChip account={account} /><span className="small muted">{s.n} Beitr{s.n === 1 ? "ag" : "äge"}</span></div>
                    <ul className="small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{s.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                  </li>
                ))}
              </ul>
            )}
            <p className="small muted" style={{ marginTop: 10 }}>Muster aus deinen eigenen Beiträgen – externe Beobachtungen stehen im <Link href="/radar">Content-Radar</Link>.</p>
          </div>
        </div>

        <aside className="stack">
          <div className="card">
            <div className="card-head"><h3>Aufgaben</h3><span className="small muted">{tasks.length}</span></div>
            {tasks.length === 0 ? (
              <p className="small muted">Keine offenen Aufgaben.</p>
            ) : (
              <ul className="list">
                {tasks.slice(0, 8).map((t, i) => (
                  <li key={i} className="small">
                    <Link href={t.href}>{t.text}</Link>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>{t.source}</div>
                  </li>
                ))}
              </ul>
            )}
            {tasks.length > 8 ? <p className="small muted">… und {tasks.length - 8} weitere.</p> : null}
          </div>

          <div className="card">
            <div className="card-head"><h3>Offene Freigaben</h3><span className="small muted">{pendingApprovals.length}</span></div>
            {pendingApprovals.length === 0 ? (
              <p className="small muted">Nichts wartet auf deine Freigabe.</p>
            ) : (
              <ul className="list">
                {pendingApprovals.map((d) => (
                  <li key={d.id}>
                    <Link href={`/entwuerfe/${d.id}`} className="small item-title">{d.title || d.body.slice(0, 60) || "Ohne Titel"}</Link>
                    <div className="row small" style={{ marginTop: 4 }}><AccountChip account={d.account_id ? byId.get(d.account_id) : null} />{d.scheduled_at ? <span className="muted">{formatDateTime(d.scheduled_at)}</span> : null}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3>Verbindungen & Automatisierungen</h3>
            <p className="small muted">Tatsächlicher Stand – nichts wird vorgetäuscht.</p>
            <ul className="list">
              {status.connections.map((c) => (
                <li key={c.name} className="small">
                  <div className="row between"><span>{c.name}</span><span className={`badge ${c.state === "aktiv" ? "ok" : ""}`}>{c.state === "aktiv" ? "verbunden" : "nicht verbunden"}</span></div>
                  <div className="muted" style={{ fontSize: "0.78rem", marginTop: 2 }}>{c.detail}</div>
                </li>
              ))}
              {status.automations.map((a) => (
                <li key={a.name} className="small">
                  <div className="row between"><span>{a.name}</span><span className={`badge ${STATE_TONE[a.state]}`}>{a.state}</span></div>
                  <div className="muted" style={{ fontSize: "0.78rem", marginTop: 2 }}>{a.detail}</div>
                </li>
              ))}
            </ul>
            <p className="small" style={{ marginTop: 8 }}><Link href="/verbindungen">Verbindungen verwalten →</Link>{!aiConfigured() ? <> · <Link href="/einstellungen">KI einrichten →</Link></> : null}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
