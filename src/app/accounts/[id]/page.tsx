import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount } from "@/server/repo";
import { PLATFORMS, positioningGaps } from "@/lib/domain";
import { formatDateTime } from "@/lib/time";
import { PageHead } from "@/components/ui";
import { AccountForm } from "@/components/AccountForm";
import { archiveAccountAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { learningSnapshot } from "@/server/context";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = /^\d+$/.test(id) ? getAccount(Number(id)) : undefined;
  if (!account) notFound();
  const gaps = positioningGaps(account);
  const learn = learningSnapshot(account);
  return (
    <>
      <PageHead
        title={`${account.display_name}`}
        intro={<>{PLATFORMS[account.platform] ?? account.platform} {account.handle} · zuletzt bearbeitet {formatDateTime(account.updated_at)}</>}
      >
        <Link href="/accounts" className="btn">Zurück</Link>
        {account.archived ? null : (
          <form action={archiveAccountAction}>
            <input type="hidden" name="id" value={account.id} />
            <input type="hidden" name="archived" value="1" />
            <SubmitButton className="btn danger" confirm="Account archivieren? Ideen, Entwürfe und Kennzahlen bleiben erhalten.">Archivieren</SubmitButton>
          </form>
        )}
      </PageHead>
      {gaps.length ? (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          Noch offen: {gaps.join(", ")}. Empfehlungen des Content-Coaches für diesen Account gelten bis dahin als vorläufig.
        </div>
      ) : null}
      <AccountForm account={account} />

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Lernbasis für diesen Account</h2>
        <p className="small muted">Das berücksichtigt der Coach bei neuen Vorschlägen – jede Quelle getrennt gekennzeichnet.</p>
        <div className="grid grid-2">
          <div>
            <h3>Deine freigegebenen Texte</h3>
            {learn.approved.length ? (
              <ul className="small">{learn.approved.map((t) => <li key={t.id}><Link href={`/entwuerfe/${t.id}`}>{t.title || t.body.slice(0, 60)}</Link></li>)}</ul>
            ) : (
              <p className="small muted">Noch keine. Sobald du Entwürfe freigibst, dienen die letzten drei als Stilbeispiele.</p>
            )}
            <h3>Deine Überarbeitungen</h3>
            {learn.editCount ? (
              <p className="small">{learn.editCount === 1 ? "1 überarbeiteter Vorschlag." : `${learn.editCount} überarbeitete Vorschläge.`} {learn.editSummary.join(" ") || "Keine auffällige Tendenz."}</p>
            ) : (
              <p className="small muted">Noch keine freigegebenen KI- oder Extern-Entwürfe zum Vergleich.</p>
            )}
          </div>
          <div>
            <h3>Eigene Daten</h3>
            <p className="small">{learn.ownN ? learn.ownNotes.join(" ") : "Noch keine Beiträge erfasst."}</p>
            <h3>Content-Radar (extern)</h3>
            <p className="small">
              {learn.radar.n
                ? `${learn.radar.n} beobachtete Beiträge. Häufige Formate: ${learn.radar.formats.map((f) => `${f.key} (${f.n})`).join(", ") || "–"}.`
                : "Noch keine Radar-Profile für diesen Account."}{" "}
              <Link href={`/radar?account=${account.id}`}>Zum Radar</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
