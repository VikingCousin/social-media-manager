import Link from "next/link";
import { allIdeaTags, listAccounts, listIdeas } from "@/server/repo";
import { PLATFORMS } from "@/lib/domain";
import { formatDateTime } from "@/lib/time";
import { AccountChip, Empty, PageHead, Tags } from "@/components/ui";
import { QuickCapture } from "@/components/QuickCapture";
import { archiveIdeaAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function IdeasPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = one("q").slice(0, 100);
  const tag = one("tag").slice(0, 40);
  const accountId = /^\d+$/.test(one("account")) ? Number(one("account")) : undefined;
  const archived = one("archiv") === "1";
  const accounts = listAccounts();
  const ideas = listIdeas({ q, tag, accountId, archived });
  const tags = allIdeaTags();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const filtered = Boolean(q || tag || accountId);
  const self = `/ideen${Object.keys(sp).length ? "?" + new URLSearchParams(Object.entries(sp).filter(([k, v]) => typeof v === "string" && k !== "ok" && k !== "fehler") as [string, string][]).toString() : ""}`;

  return (
    <>
      <PageHead title="Ideen-Inbox" intro="Spontane Gedanken festhalten. Später bearbeiten, Accounts zuordnen und im Content-Coach weiterentwickeln." />
      {!archived ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <QuickCapture accounts={accounts.map((a) => ({ id: a.id, platform: a.platform, display_name: a.display_name }))} />
        </div>
      ) : null}

      <form className="row" style={{ marginBottom: 14 }} method="get">
        <input type="search" name="q" defaultValue={q} placeholder="Ideen durchsuchen…" style={{ maxWidth: 280 }} enterKeyHint="search" aria-label="Ideen durchsuchen" />
        <AutoSubmitSelect name="account" defaultValue={accountId ?? ""} style={{ maxWidth: 240 }} aria-label="Nach Account filtern">
          <option value="">Alle Accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{PLATFORMS[a.platform]} · {a.display_name}</option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="tag" defaultValue={tag} style={{ maxWidth: 180 }} aria-label="Nach Tag filtern">
          <option value="">Alle Tags</option>
          {tags.map((t) => <option key={t} value={t}>#{t}</option>)}
        </AutoSubmitSelect>
        {archived ? <input type="hidden" name="archiv" value="1" /> : null}
        <button className="btn" type="submit">Filtern</button>
        {filtered ? <Link href={archived ? "/ideen?archiv=1" : "/ideen"} className="btn ghost">Zurücksetzen</Link> : null}
        <span style={{ flex: 1 }} />
        <Link href={archived ? "/ideen" : "/ideen?archiv=1"} className="btn ghost">{archived ? "← Aktive Ideen" : "Archiv anzeigen"}</Link>
      </form>

      <div className="card">
        {ideas.length === 0 ? (
          filtered ? (
            <Empty title="Keine Treffer">Probier einen anderen Suchbegriff oder setze die Filter zurück.</Empty>
          ) : archived ? (
            <Empty title="Archiv ist leer">Archivierte Ideen erscheinen hier und lassen sich jederzeit zurückholen.</Empty>
          ) : (
            <Empty title="Noch keine Ideen">Schreib oben deinen ersten Gedanken auf – ein Satz reicht.</Empty>
          )
        ) : (
          <ul className="list">
            {ideas.map((i) => (
              <li key={i.id}>
                <div className="row between">
                  <Link href={`/ideen/${i.id}`} className="item-title">{i.title || i.body.split("\n")[0].slice(0, 90)}</Link>
                  <span className="small muted">{formatDateTime(i.created_at)}</span>
                </div>
                {i.title ? <p className="small muted clamp pre" style={{ margin: "2px 0 6px" }}>{i.body}</p> : null}
                <div className="row small">
                  {i.account_ids.map((id) => <AccountChip key={id} account={byId.get(id)} />)}
                  <Tags tags={i.tags} />
                  <span style={{ flex: 1 }} />
                  <Link href={`/ideen/${i.id}#coach`} className="btn small">Coach</Link>
                  <form action={archiveIdeaAction} className="inline">
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="archived" value={archived ? "0" : "1"} />
                    <input type="hidden" name="back" value={self} />
                    <SubmitButton className="btn small ghost">{archived ? "Wiederherstellen" : "Archivieren"}</SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
