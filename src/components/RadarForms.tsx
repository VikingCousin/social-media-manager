import { saveRadarPostAction, saveWatchProfileAction } from "@/app/actions";
import { FORMAT_SUGGESTIONS, PLATFORMS, type Account } from "@/lib/domain";
import { RELATIONS } from "@/lib/radar";
import { todayBerlin } from "@/lib/time";
import type { RadarPost, WatchProfile } from "@/server/repo";
import { AccountSelect } from "./AccountChecks";
import { SubmitButton } from "./SubmitButton";

export function profileLabel(p: Pick<WatchProfile, "platform" | "display_name" | "handle">) {
  return `${PLATFORMS[p.platform] ?? p.platform} · ${p.display_name || p.handle}`;
}

export function WatchProfileForm({ accounts, profile, idPrefix = "wp" }: { accounts: Account[]; profile?: WatchProfile; idPrefix?: string }) {
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <form action={saveWatchProfileAction}>
      {profile ? <input type="hidden" name="id" value={profile.id} /> : null}
      <div className="grid grid-2">
        <div>
          <label htmlFor={id("platform")}>Plattform</label>
          <select id={id("platform")} name="platform" defaultValue={profile?.platform ?? ""} required>
            <option value="" disabled>Bitte wählen</option>
            {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={id("relation")}>Art</label>
          <select id={id("relation")} name="relation" defaultValue={profile?.relation ?? "inspiration"}>
            {Object.entries(RELATIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label htmlFor={id("handle")}>Handle</label><input id={id("handle")} name="handle" type="text" defaultValue={profile?.handle} placeholder="@name" maxLength={120} autoCapitalize="none" /></div>
        <div><label htmlFor={id("name")}>Name</label><input id={id("name")} name="display_name" type="text" defaultValue={profile?.display_name} maxLength={120} /></div>
      </div>
      <div className="field"><label htmlFor={id("url")}>Profil-Link</label><input id={id("url")} name="url" type="url" defaultValue={profile?.url} placeholder="https://…" /></div>
      <div className="field"><label>Relevant für meinen Account</label><AccountSelect accounts={accounts} value={profile?.account_id ?? null} /></div>
      <div className="field"><label htmlFor={id("why")}>Warum beobachten?</label><textarea id={id("why")} name="why" defaultValue={profile?.why} maxLength={2000} style={{ minHeight: 60 }} placeholder="z. B. ähnliche Zielgruppe, starke Einstiege, Format-Vorbild" /></div>
      {profile ? <div className="field"><label htmlFor={id("notes")}>Notizen</label><textarea id={id("notes")} name="notes" defaultValue={profile.notes} maxLength={4000} /></div> : null}
      <div className="row" style={{ marginTop: 12 }}><SubmitButton className="btn primary">{profile ? "Profil speichern" : "Profil beobachten"}</SubmitButton></div>
    </form>
  );
}

export function RadarPostForm({
  profiles,
  post,
  defaultProfileId,
  back,
  idPrefix = "rp",
}: {
  profiles: WatchProfile[];
  post?: RadarPost;
  defaultProfileId?: number;
  back?: string;
  idPrefix?: string;
}) {
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <form action={saveRadarPostAction}>
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      {back ? <input type="hidden" name="back" value={back} /> : null}
      <div className="grid grid-2">
        <div>
          <label htmlFor={id("profile")}>Profil</label>
          <select id={id("profile")} name="profile_id" defaultValue={post?.profile_id ?? defaultProfileId ?? ""}>
            <option value="">– ohne beobachtetes Profil –</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{profileLabel(p)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={id("platform")}>Plattform (falls ohne Profil)</label>
          <select id={id("platform")} name="platform" defaultValue={post?.platform ?? ""}>
            <option value="">–</option>
            {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label htmlFor={id("url")}>Link zum Beitrag</label><input id={id("url")} name="url" type="url" defaultValue={post?.url} placeholder="https://…" /></div>
      <div className="grid grid-2">
        <div><label htmlFor={id("title")}>Titel / Kurzbeschreibung</label><input id={id("title")} name="title" type="text" defaultValue={post?.title} maxLength={200} /></div>
        <div><label htmlFor={id("format")}>Format</label><input id={id("format")} name="format" type="text" list="formats" defaultValue={post?.format} maxLength={60} /></div>
        <div><label htmlFor={id("posted")}>Veröffentlicht am</label><input id={id("posted")} name="posted_on" type="date" defaultValue={post?.posted_on ?? ""} /></div>
        <div><label htmlFor={id("captured")}>Erfasst am</label><input id={id("captured")} name="captured_on" type="date" defaultValue={post?.captured_on ?? todayBerlin()} /></div>
      </div>
      <div className="field"><label htmlFor={id("hook")}>Einstieg (erster Satz / Hook)</label><textarea id={id("hook")} name="hook" defaultValue={post?.hook} maxLength={1000} style={{ minHeight: 60 }} /></div>
      <div className="field"><label htmlFor={id("topic")}>Thema</label><input id={id("topic")} name="topic" type="text" defaultValue={post?.topic} maxLength={200} /></div>
      <div className="field">
        <label htmlFor={id("excerpt")}>Textauszug / Transkript (optional)</label>
        <textarea id={id("excerpt")} name="content_excerpt" defaultValue={post?.content_excerpt} maxLength={8000} placeholder="Nur zugängliche Inhalte, die du selbst gesehen hast. Wird als Daten behandelt." />
      </div>
      <div className="field"><label htmlFor={id("obs")}>Deine Beobachtung</label><textarea id={id("obs")} name="observation" defaultValue={post?.observation} maxLength={10000} placeholder="Was fällt dir auf? Was könnte für dich übertragbar sein?" /></div>
      <h3 style={{ marginTop: 14 }}>Sichtbare Kennzahlen (Momentaufnahme)</h3>
      <p className="small muted">So wie sie am Erfassungstag öffentlich angezeigt wurden. Leer = unbekannt.</p>
      <div className="grid grid-2" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        {(["views", "likes", "comments", "shares"] as const).map((f) => (
          <div key={f}>
            <label htmlFor={id(f)}>{{ views: "Views", likes: "Likes", comments: "Kommentare", shares: "Shares" }[f]}</label>
            <input id={id(f)} name={f} type="text" inputMode="decimal" defaultValue={post?.[f] ?? ""} placeholder="unbekannt" />
          </div>
        ))}
      </div>
      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <div><label htmlFor={id("source")}>Quelle</label><input id={id("source")} name="source" type="text" defaultValue={post?.source} maxLength={200} placeholder="z. B. Profilansicht, For-You-Feed, Newsletter" /></div>
        <div><label htmlFor={id("tags")}>Tags</label><input id={id("tags")} name="tags" type="text" defaultValue={post?.tags.split(",").filter(Boolean).join(", ")} maxLength={500} autoCapitalize="none" /></div>
      </div>
      <div className="row sticky-actions" style={{ marginTop: 14 }}><SubmitButton className="btn primary">{post ? "Speichern" : "Im Radar erfassen"}</SubmitButton></div>
      <datalist id="formats">{FORMAT_SUGGESTIONS.map((f) => <option key={f} value={f} />)}</datalist>
    </form>
  );
}
