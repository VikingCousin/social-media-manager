import Link from "next/link";
import { listAccounts, listDrafts, listScheduled } from "@/server/repo";
import { DRAFT_STATUSES, FORMAT_SUGGESTIONS, PLATFORMS, STATUS_LABELS, type Account, type DraftStatus } from "@/lib/domain";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { formatDateTime } from "@/lib/time";
import { AccountChip, Empty, PageHead, StatusBadge } from "@/components/ui";
import { AccountSelect } from "@/components/AccountChecks";
import { SubmitButton } from "@/components/SubmitButton";
import { createDraftAction } from "@/app/actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default async function DraftsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const statusRaw = typeof sp.status === "string" ? sp.status : "";
  const status = (DRAFT_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as DraftStatus) : undefined;
  const accountId = typeof sp.account === "string" && /^\d+$/.test(sp.account) ? Number(sp.account) : undefined;
  const accounts = listAccounts();
  const byId = new Map(listAccounts(true).map((a) => [a.id, a]));
  const drafts = listDrafts({ statuses: status ? [status] : undefined, accountId });
  const counts = Object.fromEntries(DRAFT_STATUSES.map((s) => [s, listDrafts({ statuses: [s] }).length])) as Record<DraftStatus, number>;
  const nowIso = new Date().toISOString();
  const plan = listScheduled(undefined, 200);
  const upcoming = plan.filter((d) => d.scheduled_at! >= nowIso);
  const overdue = plan.filter((d) => d.scheduled_at! < nowIso);
  const groups = new Map<string, typeof upcoming>();
  for (const d of upcoming) {
    const k = dayLabel(d.scheduled_at!);
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }

  return (
    <>
      <PageHead title="Entwürfe & Redaktionsplan" intro="Entwürfe bearbeiten, freigeben und einplanen. „Geplant“ ist in Version 1 nur ein Eintrag im Plan – es wird nichts automatisch veröffentlicht." />

      <div className="grid grid-main-side">
        <div className="stack">
          <div className="chips-scroll" role="navigation" aria-label="Nach Status filtern">
            <Link href={`/entwuerfe${accountId ? `?account=${accountId}` : ""}`} className={`btn small ${!status ? "primary" : ""}`}>Alle ({Object.values(counts).reduce((a, b) => a + b, 0)})</Link>
            {DRAFT_STATUSES.map((s) => (
              <Link key={s} href={`/entwuerfe?status=${s}${accountId ? `&account=${accountId}` : ""}`} className={`btn small ${status === s ? "primary" : ""}`}>
                {STATUS_LABELS[s]} ({counts[s]})
              </Link>
            ))}
          </div>
          <form className="row" method="get">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <AutoSubmitSelect name="account" defaultValue={accountId ?? ""} style={{ maxWidth: 260, flex: 1 }} aria-label="Nach Account filtern">
              <option value="">Alle Accounts</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{PLATFORMS[a.platform]} · {a.display_name}</option>)}
            </AutoSubmitSelect>
            <noscript><button className="btn small" type="submit">Filtern</button></noscript>
            <a href="#plan" className="btn small mobile-only-inline">Zum Plan ↓</a>
          </form>

          <details className="card mobile-only">
            <summary><strong>＋ Neuer Entwurf</strong></summary>
            <NewDraftForm accounts={accounts} idPrefix="m" />
          </details>

          <div className="card">
            {drafts.length === 0 ? (
              <Empty title={status || accountId ? "Keine Entwürfe mit diesem Filter" : "Noch keine Entwürfe"}>
                {status || accountId ? "Filter ändern oder zurücksetzen." : "Lege einen neuen Entwurf an oder übernimm ein Ergebnis aus dem Content-Coach."}
              </Empty>
            ) : (
              <ul className="list">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <div className="row between">
                      <Link href={`/entwuerfe/${d.id}`} className="item-title">{d.title || d.body.slice(0, 80) || "Ohne Titel"}</Link>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="row small muted" style={{ marginTop: 4 }}>
                      <AccountChip account={d.account_id ? byId.get(d.account_id) : null} />
                      {d.format ? <span>{d.format}</span> : null}
                      {d.scheduled_at ? <span>Termin {formatDateTime(d.scheduled_at)}</span> : null}
                      <span>geändert {formatDateTime(d.updated_at)}</span>
                      {d.source !== "manuell" ? <span className="badge">{d.source === "ki" ? "KI-Vorschlag" : "extern erzeugt"}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card" id="plan">
            <div className="card-head"><h2>Redaktionsplan</h2><span className="small muted">Zeiten in Europe/Berlin</span></div>
            {overdue.length ? (
              <div className="notice warn" style={{ marginBottom: 12 }}>
                <strong>Überfällig:</strong>{" "}
                {overdue.map((d, i) => (
                  <span key={d.id}>{i ? ", " : ""}<Link href={`/entwuerfe/${d.id}`}>{d.title || "Ohne Titel"}</Link> ({formatDateTime(d.scheduled_at)})</span>
                ))}
                . Wenn du manuell veröffentlicht hast, bestätige es im Entwurf mit dem Link.
              </div>
            ) : null}
            {upcoming.length === 0 ? (
              <Empty title="Nichts eingeplant">Setze in einem Entwurf einen Termin und gib ihn frei – dann erscheint er hier.</Empty>
            ) : (
              [...groups.entries()].map(([day, items]) => (
                <div key={day}>
                  <div className="timeline-day">{day}</div>
                  <ul className="list">
                    {items.map((d) => (
                      <li key={d.id} className="row between plan-item">
                        <span className="row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
                          <span className="small muted" style={{ width: 48 }}>{new Date(d.scheduled_at!).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })}</span>
                          <Link href={`/entwuerfe/${d.id}`} className="item-title">{d.title || d.body.slice(0, 60) || "Ohne Titel"}</Link>
                        </span>
                        <span className="row small"><AccountChip account={d.account_id ? byId.get(d.account_id) : null} /><StatusBadge status={d.status} /></span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="desktop-only">
          <div className="card">
            <h3>Neuer Entwurf</h3>
            <NewDraftForm accounts={accounts} idPrefix="d" />
          </div>
        </aside>
      </div>
      <datalist id="formats">{FORMAT_SUGGESTIONS.map((f) => <option key={f} value={f} />)}</datalist>
    </>
  );
}

function NewDraftForm({ accounts, idPrefix }: { accounts: Account[]; idPrefix: string }) {
  return (
    <form action={createDraftAction}>
      <input type="hidden" name="back" value="/entwuerfe" />
      <div className="field"><label htmlFor={`${idPrefix}-title`}>Titel</label><input id={`${idPrefix}-title`} name="title" type="text" maxLength={200} /></div>
      <div className="field"><label>Account</label><AccountSelect accounts={accounts} value={null} /></div>
      <div className="field"><label htmlFor={`${idPrefix}-format`}>Format</label><input id={`${idPrefix}-format`} name="format" type="text" list="formats" maxLength={60} /></div>
      <div className="field"><label htmlFor={`${idPrefix}-body`}>Text</label><textarea id={`${idPrefix}-body`} name="body" maxLength={30000} /></div>
      <div className="row" style={{ marginTop: 12 }}><SubmitButton className="btn primary">Entwurf anlegen</SubmitButton></div>
    </form>
  );
}
