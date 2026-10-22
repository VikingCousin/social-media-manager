import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, listAccounts } from "@/server/repo";
import { formatDateTime } from "@/lib/time";
import { PageHead } from "@/components/ui";
import { PostForm } from "@/components/PostForm";
import { SubmitButton } from "@/components/SubmitButton";
import { deletePostAction } from "@/app/actions";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = /^\d+$/.test(id) ? getPost(Number(id)) : undefined;
  if (!p) notFound();
  const back = `/performance?account=${p.account_id}`;
  return (
    <>
      <PageHead title="Beitrag bearbeiten" intro={<>Erfasst {formatDateTime(p.created_at)} · Quelle: {p.source === "csv" ? "CSV-Import" : p.source === "entwurf" ? "aus Entwurf bestätigt" : "manuell"}{p.draft_id ? <> · <Link href={`/entwuerfe/${p.draft_id}`}>zum Entwurf</Link></> : null}</>}>
        <Link href={back} className="btn">Zurück</Link>
        <form action={deletePostAction}>
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="back" value={back} />
          <SubmitButton className="btn danger" confirm="Beitrag samt Kennzahlen löschen?">Löschen</SubmitButton>
        </form>
      </PageHead>
      <div className="card">
        <p className="small muted">Hier kannst du Werte auch bewusst leeren (= unbekannt). Ein erneuter CSV-Import überschreibt bekannte Werte nur mit neuen bekannten Werten.</p>
        <PostForm accounts={listAccounts(true)} post={p} back={`/performance/${p.id}`} />
      </div>
    </>
  );
}
