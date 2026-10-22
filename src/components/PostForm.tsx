import { savePostAction } from "@/app/actions";
import { METRIC_FIELDS, METRIC_LABELS } from "@/lib/csv";
import { FORMAT_SUGGESTIONS, type Account } from "@/lib/domain";
import { utcToLocalInput } from "@/lib/time";
import type { Post } from "@/server/repo";
import { AccountSelect } from "./AccountChecks";
import { SubmitButton } from "./SubmitButton";

export function PostForm({ accounts, post, defaultAccountId, back }: { accounts: Account[]; post?: Post; defaultAccountId?: number; back: string }) {
  return (
    <form action={savePostAction}>
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      <input type="hidden" name="back" value={back} />
      <div className="grid grid-3">
        <div><label>Account</label><AccountSelect accounts={accounts} value={post?.account_id ?? defaultAccountId ?? null} allowEmpty={false} required /></div>
        <div><label htmlFor="pf-published">Veröffentlicht am (Berlin)</label><input id="pf-published" name="published_at" type="datetime-local" defaultValue={utcToLocalInput(post?.published_at)} /></div>
        <div><label htmlFor="pf-url">Link</label><input id="pf-url" name="url" type="url" defaultValue={post?.url} placeholder="https://…" /></div>
        <div><label htmlFor="pf-format">Format</label><input id="pf-format" name="format" type="text" list="formats" defaultValue={post?.format} maxLength={60} /></div>
        <div style={{ gridColumn: "span 2" }}><label htmlFor="pf-topic">Thema</label><input id="pf-topic" name="topic" type="text" defaultValue={post?.topic} maxLength={200} /></div>
      </div>
      <h3 style={{ marginTop: 16 }}>Kennzahlen</h3>
      <p className="small muted">Leer lassen = unbekannt. Unbekannt ist nicht 0 und fließt nicht in Auswertungen ein.</p>
      <div className="grid grid-3" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        {METRIC_FIELDS.map((f) => (
          <div key={f}>
            <label htmlFor={`pf-${f}`}>{METRIC_LABELS[f]}</label>
            <input id={`pf-${f}`} name={f} type="text" inputMode="decimal" defaultValue={post?.[f] ?? ""} placeholder="unbekannt" />
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <SubmitButton className="btn primary">{post ? "Speichern" : "Beitrag erfassen"}</SubmitButton>
      </div>
      <datalist id="formats">{FORMAT_SUGGESTIONS.map((x) => <option key={x} value={x} />)}</datalist>
    </form>
  );
}
