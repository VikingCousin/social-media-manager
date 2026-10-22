import "server-only";
import { getDb, nowIso } from "@/lib/db";
import type { Account, DraftStatus } from "@/lib/domain";
import { METRIC_FIELDS, mergeMetrics, type MetricField, type ParsedPost } from "@/lib/csv";

/* ---------- Accounts ---------- */

export function listAccounts(includeArchived = false): Account[] {
  return getDb()
    .prepare(`SELECT * FROM accounts ${includeArchived ? "" : "WHERE archived = 0"} ORDER BY id`)
    .all() as Account[];
}

export function getAccount(id: number): Account | undefined {
  return getDb().prepare("SELECT * FROM accounts WHERE id = ?").get(id) as Account | undefined;
}

export type AccountInput = Omit<Account, "id" | "api_status" | "archived" | "created_at" | "updated_at">;

export function createAccount(a: AccountInput): number {
  const now = nowIso();
  const r = getDb()
    .prepare(`INSERT INTO accounts (platform, display_name, handle, profile_url, positioning, audience, topics, tone, formats, goals, boundaries, notes, snapshot, created_at, updated_at)
      VALUES (@platform, @display_name, @handle, @profile_url, @positioning, @audience, @topics, @tone, @formats, @goals, @boundaries, @notes, @snapshot, @now, @now)`)
    .run({ ...a, now });
  return Number(r.lastInsertRowid);
}

export function updateAccount(id: number, a: AccountInput) {
  getDb()
    .prepare(`UPDATE accounts SET platform=@platform, display_name=@display_name, handle=@handle, profile_url=@profile_url,
      positioning=@positioning, audience=@audience, topics=@topics, tone=@tone, formats=@formats, goals=@goals,
      boundaries=@boundaries, notes=@notes, snapshot=@snapshot, updated_at=@now WHERE id=@id`)
    .run({ ...a, id, now: nowIso() });
}

export function setAccountArchived(id: number, archived: boolean) {
  getDb().prepare("UPDATE accounts SET archived=?, updated_at=? WHERE id=?").run(archived ? 1 : 0, nowIso(), id);
}

/* ---------- Ideen ---------- */

export type Idea = {
  id: number;
  body: string;
  /** Originalwortlaut beim Festhalten – wird nie überschrieben. */
  original_text: string | null;
  capture_mode: string;
  title: string;
  tags: string;
  notes: string;
  archived: number;
  created_at: string;
  updated_at: string;
  account_ids: number[];
};

function withAccounts(rows: Omit<Idea, "account_ids">[]): Idea[] {
  if (rows.length === 0) return [];
  const links = getDb()
    .prepare(`SELECT idea_id, account_id FROM idea_accounts WHERE idea_id IN (${rows.map(() => "?").join(",")})`)
    .all(...rows.map((r) => r.id)) as { idea_id: number; account_id: number }[];
  return rows.map((r) => ({ ...r, account_ids: links.filter((l) => l.idea_id === r.id).map((l) => l.account_id) }));
}

export function listIdeas(opts: { archived?: boolean; q?: string; tag?: string; accountId?: number } = {}): Idea[] {
  const where: string[] = ["archived = ?"];
  const params: (string | number)[] = [opts.archived ? 1 : 0];
  if (opts.q) {
    where.push("(body LIKE ? OR title LIKE ? OR notes LIKE ? OR tags LIKE ?)");
    const like = `%${opts.q.replace(/[%_]/g, "")}%`;
    params.push(like, like, like, like);
  }
  if (opts.tag) {
    where.push("(',' || tags || ',') LIKE ?");
    params.push(`%,${opts.tag.replace(/[%_]/g, "")},%`);
  }
  if (opts.accountId) {
    where.push("id IN (SELECT idea_id FROM idea_accounts WHERE account_id = ?)");
    params.push(opts.accountId);
  }
  const rows = getDb()
    .prepare(`SELECT * FROM ideas WHERE ${where.join(" AND ")} ORDER BY created_at DESC`)
    .all(...params) as Omit<Idea, "account_ids">[];
  return withAccounts(rows);
}

export function getIdea(id: number): Idea | undefined {
  const row = getDb().prepare("SELECT * FROM ideas WHERE id = ?").get(id) as Omit<Idea, "account_ids"> | undefined;
  return row ? withAccounts([row])[0] : undefined;
}

export function countIdeas(): number {
  return (getDb().prepare("SELECT COUNT(*) c FROM ideas WHERE archived = 0").get() as { c: number }).c;
}

export function createIdea(i: { body: string; title: string; tags: string; notes: string; account_ids: number[]; capture_mode?: string }): number {
  const db = getDb();
  const now = nowIso();
  return db.transaction(() => {
    const r = db
      .prepare("INSERT INTO ideas (body, original_text, capture_mode, title, tags, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(i.body, i.body, i.capture_mode ?? "formular", i.title, i.tags, i.notes, now, now);
    const id = Number(r.lastInsertRowid);
    setIdeaAccounts(id, i.account_ids);
    return id;
  })();
}

export function updateIdea(id: number, i: { body: string; title: string; tags: string; notes: string; account_ids: number[] }) {
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE ideas SET body=?, title=?, tags=?, notes=?, updated_at=? WHERE id=?").run(i.body, i.title, i.tags, i.notes, nowIso(), id);
    setIdeaAccounts(id, i.account_ids);
  })();
}

function setIdeaAccounts(id: number, accountIds: number[]) {
  const db = getDb();
  db.prepare("DELETE FROM idea_accounts WHERE idea_id = ?").run(id);
  const ins = db.prepare("INSERT OR IGNORE INTO idea_accounts (idea_id, account_id) SELECT ?, id FROM accounts WHERE id = ?");
  for (const a of accountIds) ins.run(id, a);
}

export function setIdeaArchived(id: number, archived: boolean) {
  getDb().prepare("UPDATE ideas SET archived=?, updated_at=? WHERE id=?").run(archived ? 1 : 0, nowIso(), id);
}

export function allIdeaTags(): string[] {
  const rows = getDb().prepare("SELECT tags FROM ideas WHERE archived = 0 AND tags != ''").all() as { tags: string }[];
  return [...new Set(rows.flatMap((r) => r.tags.split(",")).filter(Boolean))].sort();
}

/* ---------- Coach-Ergebnisse ---------- */

export type CoachResultRow = {
  id: number;
  idea_id: number | null;
  kind: string;
  model: string;
  output_json: string;
  created_at: string;
  feedback: "passt" | "passt_nicht" | null;
  feedback_note: string;
};

export function saveCoachResult(ideaId: number, kind: string, model: string, output: unknown): number {
  const r = getDb()
    .prepare("INSERT INTO coach_results (idea_id, kind, model, output_json, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(ideaId, kind, model, JSON.stringify(output), nowIso());
  return Number(r.lastInsertRowid);
}

export function listCoachResults(ideaId: number): CoachResultRow[] {
  return getDb().prepare("SELECT * FROM coach_results WHERE idea_id = ? ORDER BY created_at DESC").all(ideaId) as CoachResultRow[];
}

export function deleteCoachResult(id: number) {
  getDb().prepare("DELETE FROM coach_results WHERE id = ?").run(id);
}

export function setCoachFeedback(id: number, feedback: "passt" | "passt_nicht" | null, note: string) {
  getDb().prepare("UPDATE coach_results SET feedback = ?, feedback_note = ? WHERE id = ?").run(feedback, note, id);
}

/** Neuestes Coach-Ergebnis je Idee (für die Übersicht). */
export function latestCoachByIdea(): Map<number, CoachResultRow> {
  const rows = getDb()
    .prepare(`SELECT c.* FROM coach_results c JOIN (SELECT idea_id, MAX(id) mid FROM coach_results WHERE kind = 'coach' GROUP BY idea_id) m ON c.id = m.mid`)
    .all() as CoachResultRow[];
  return new Map(rows.filter((r) => r.idea_id !== null).map((r) => [r.idea_id as number, r]));
}

/** Rückmeldungen zu früheren Coach-Vorschlägen (für die Lernbasis). */
export function recentCoachFeedback(limit = 6): CoachResultRow[] {
  return getDb()
    .prepare("SELECT * FROM coach_results WHERE feedback IS NOT NULL ORDER BY id DESC LIMIT ?")
    .all(limit) as CoachResultRow[];
}

/* ---------- Entwürfe ---------- */

export type Draft = {
  id: number;
  idea_id: number | null;
  account_id: number | null;
  title: string;
  format: string;
  body: string;
  status: DraftStatus;
  scheduled_at: string | null;
  published_url: string;
  published_at: string | null;
  approved_hash: string | null;
  approved_at: string | null;
  source: string;
  original_body: string | null;
  package_json: string | null;
  created_at: string;
  updated_at: string;
};

export function listDrafts(opts: { statuses?: DraftStatus[]; accountId?: number } = {}): Draft[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.statuses?.length) {
    where.push(`status IN (${opts.statuses.map(() => "?").join(",")})`);
    params.push(...opts.statuses);
  }
  if (opts.accountId) {
    where.push("account_id = ?");
    params.push(opts.accountId);
  }
  return getDb()
    .prepare(`SELECT * FROM drafts ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY updated_at DESC`)
    .all(...params) as Draft[];
}

export function listScheduled(fromIso?: string, limit = 50): Draft[] {
  return getDb()
    .prepare(`SELECT * FROM drafts WHERE scheduled_at IS NOT NULL AND status != 'veroeffentlicht' ${fromIso ? "AND scheduled_at >= ?" : ""} ORDER BY scheduled_at ASC LIMIT ?`)
    .all(...(fromIso ? [fromIso, limit] : [limit])) as Draft[];
}

export function getDraft(id: number): Draft | undefined {
  return getDb().prepare("SELECT * FROM drafts WHERE id = ?").get(id) as Draft | undefined;
}

export function createDraft(
  d: Pick<Draft, "idea_id" | "account_id" | "title" | "format" | "body" | "status" | "scheduled_at" | "source"> & { package_json?: string | null },
): number {
  const now = nowIso();
  // Bei KI- oder extern erzeugten Entwürfen wird die Ausgangsfassung für die Lernbasis aufbewahrt.
  const original_body = d.source === "manuell" ? null : d.body;
  const r = getDb()
    .prepare(`INSERT INTO drafts (idea_id, account_id, title, format, body, status, scheduled_at, source, original_body, package_json, created_at, updated_at)
      VALUES (@idea_id, @account_id, @title, @format, @body, @status, @scheduled_at, @source, @original_body, @package_json, @now, @now)`)
    .run({ ...d, package_json: d.package_json ?? null, original_body, now });
  return Number(r.lastInsertRowid);
}

/** Neuestes Content-Paket (Entwurf mit Paket) zu einer Idee. */
export function packageDraftsForIdea(ideaId: number): Draft[] {
  return getDb().prepare("SELECT * FROM drafts WHERE idea_id = ? AND package_json IS NOT NULL ORDER BY id DESC").all(ideaId) as Draft[];
}

export function updateDraftRow(id: number, d: Partial<Omit<Draft, "id" | "created_at">>) {
  const keys = Object.keys(d);
  if (keys.length === 0) return;
  getDb()
    .prepare(`UPDATE drafts SET ${keys.map((k) => `${k}=@${k}`).join(", ")}, updated_at=@__now WHERE id=@__id`)
    .run({ ...d, __now: nowIso(), __id: id });
}

export function deleteDraft(id: number) {
  getDb().prepare("DELETE FROM drafts WHERE id = ?").run(id);
}

/* ---------- Engagement ---------- */

export type EngagementDraft = {
  id: number;
  account_id: number | null;
  source_url: string;
  source_text: string;
  my_notes: string;
  comment: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
};

export function listEngagement(): EngagementDraft[] {
  return getDb().prepare("SELECT * FROM engagement_drafts ORDER BY updated_at DESC").all() as EngagementDraft[];
}

export function getEngagement(id: number): EngagementDraft | undefined {
  return getDb().prepare("SELECT * FROM engagement_drafts WHERE id = ?").get(id) as EngagementDraft | undefined;
}

export function createEngagement(e: Omit<EngagementDraft, "id" | "created_at" | "updated_at">): number {
  const now = nowIso();
  const r = getDb()
    .prepare(`INSERT INTO engagement_drafts (account_id, source_url, source_text, my_notes, comment, status, source, created_at, updated_at)
      VALUES (@account_id, @source_url, @source_text, @my_notes, @comment, @status, @source, @now, @now)`)
    .run({ ...e, now });
  return Number(r.lastInsertRowid);
}

export function updateEngagement(id: number, e: Partial<Omit<EngagementDraft, "id" | "created_at">>) {
  const keys = Object.keys(e);
  if (!keys.length) return;
  getDb()
    .prepare(`UPDATE engagement_drafts SET ${keys.map((k) => `${k}=@${k}`).join(", ")}, updated_at=@__now WHERE id=@__id`)
    .run({ ...e, __now: nowIso(), __id: id });
}

export function deleteEngagement(id: number) {
  getDb().prepare("DELETE FROM engagement_drafts WHERE id = ?").run(id);
}

/* ---------- Performance ---------- */

export type Post = {
  id: number;
  account_id: number;
  draft_id: number | null;
  published_at: string | null;
  format: string;
  topic: string;
  url: string;
  dedup_key: string;
  source: string;
  created_at: string;
  updated_at: string;
} & Record<MetricField, number | null>;

export function listPosts(accountId?: number): Post[] {
  return getDb()
    .prepare(`SELECT * FROM posts ${accountId ? "WHERE account_id = ?" : ""} ORDER BY COALESCE(published_at, created_at) DESC`)
    .all(...(accountId ? [accountId] : [])) as Post[];
}

export function getPost(id: number): Post | undefined {
  return getDb().prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post | undefined;
}

export function postCountsByAccount(): Record<number, number> {
  const rows = getDb().prepare("SELECT account_id, COUNT(*) c FROM posts GROUP BY account_id").all() as { account_id: number; c: number }[];
  return Object.fromEntries(rows.map((r) => [r.account_id, r.c]));
}

export type UpsertOutcome = "neu" | "aktualisiert" | "unveraendert";

/** Legt einen Beitrag an oder ergänzt Kennzahlen eines vorhandenen (per dedup_key). */
export function upsertPost(p: Omit<ParsedPost, "row">, source: string, draftId: number | null = null): { id: number; outcome: UpsertOutcome } {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM posts WHERE dedup_key = ?").get(p.dedup_key) as Post | undefined;
  const now = nowIso();
  if (!existing) {
    const r = db
      .prepare(`INSERT INTO posts (account_id, draft_id, published_at, format, topic, url, dedup_key, ${METRIC_FIELDS.join(", ")}, source, created_at, updated_at)
        VALUES (@account_id, @draft_id, @published_at, @format, @topic, @url, @dedup_key, ${METRIC_FIELDS.map((f) => "@" + f).join(", ")}, @source, @now, @now)`)
      .run({ ...p, ...p.metrics, draft_id: draftId, source, now });
    return { id: Number(r.lastInsertRowid), outcome: "neu" };
  }
  const current = Object.fromEntries(METRIC_FIELDS.map((f) => [f, existing[f]])) as Record<MetricField, number | null>;
  const { merged, changed } = mergeMetrics(current, p.metrics);
  const fill = {
    published_at: existing.published_at ?? p.published_at,
    format: existing.format || p.format,
    topic: existing.topic || p.topic,
  };
  const metaChanged = fill.published_at !== existing.published_at || fill.format !== existing.format || fill.topic !== existing.topic;
  if (!changed && !metaChanged) return { id: existing.id, outcome: "unveraendert" };
  db.prepare(`UPDATE posts SET published_at=@published_at, format=@format, topic=@topic, ${METRIC_FIELDS.map((f) => `${f}=@${f}`).join(", ")}, updated_at=@now WHERE id=@id`).run({
    ...fill,
    ...merged,
    now,
    id: existing.id,
  });
  return { id: existing.id, outcome: "aktualisiert" };
}

/** Manuelles Bearbeiten: hier dürfen Werte auch bewusst auf „unbekannt“ gesetzt werden. */
export function updatePost(id: number, p: { published_at: string | null; format: string; topic: string; url: string } & Record<MetricField, number | null>) {
  getDb()
    .prepare(`UPDATE posts SET published_at=@published_at, format=@format, topic=@topic, url=@url, ${METRIC_FIELDS.map((f) => `${f}=@${f}`).join(", ")}, updated_at=@now WHERE id=@id`)
    .run({ ...p, now: nowIso(), id });
}

export function deletePost(id: number) {
  getDb().prepare("DELETE FROM posts WHERE id = ?").run(id);
}

export function findPostByDedupKey(key: string): Post | undefined {
  return getDb().prepare("SELECT * FROM posts WHERE dedup_key = ?").get(key) as Post | undefined;
}

/* ---------- Content-Radar ---------- */

export type WatchProfile = {
  id: number;
  platform: string;
  handle: string;
  display_name: string;
  url: string;
  relation: string;
  account_id: number | null;
  why: string;
  notes: string;
  archived: number;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RadarPost = {
  id: number;
  profile_id: number | null;
  platform: string;
  url: string;
  url_key: string | null;
  title: string;
  posted_on: string | null;
  captured_on: string;
  source: string;
  format: string;
  topic: string;
  hook: string;
  content_excerpt: string;
  observation: string;
  tags: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  analysis_json: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
};

export function listWatchProfiles(includeArchived = false): WatchProfile[] {
  return getDb()
    .prepare(`SELECT * FROM watch_profiles ${includeArchived ? "" : "WHERE archived = 0"} ORDER BY platform, display_name, handle`)
    .all() as WatchProfile[];
}

export function getWatchProfile(id: number): WatchProfile | undefined {
  return getDb().prepare("SELECT * FROM watch_profiles WHERE id = ?").get(id) as WatchProfile | undefined;
}

export type WatchProfileInput = Pick<WatchProfile, "platform" | "handle" | "display_name" | "url" | "relation" | "account_id" | "why" | "notes">;

export function saveWatchProfile(id: number | null, p: WatchProfileInput): number {
  const now = nowIso();
  if (id) {
    getDb()
      .prepare(`UPDATE watch_profiles SET platform=@platform, handle=@handle, display_name=@display_name, url=@url, relation=@relation,
        account_id=@account_id, why=@why, notes=@notes, updated_at=@now WHERE id=@id`)
      .run({ ...p, now, id });
    return id;
  }
  const r = getDb()
    .prepare(`INSERT INTO watch_profiles (platform, handle, display_name, url, relation, account_id, why, notes, created_at, updated_at)
      VALUES (@platform, @handle, @display_name, @url, @relation, @account_id, @why, @notes, @now, @now)`)
    .run({ ...p, now });
  return Number(r.lastInsertRowid);
}

export function setWatchProfileArchived(id: number, archived: boolean) {
  getDb().prepare("UPDATE watch_profiles SET archived=?, updated_at=? WHERE id=?").run(archived ? 1 : 0, nowIso(), id);
}

export function markWatchProfileChecked(id: number) {
  const now = nowIso();
  getDb().prepare("UPDATE watch_profiles SET last_checked_at=?, updated_at=? WHERE id=?").run(now, now, id);
}

export function listRadarPosts(opts: { archived?: boolean; profileId?: number; q?: string; accountId?: number } = {}): RadarPost[] {
  const where = ["r.archived = ?"];
  const params: (string | number)[] = [opts.archived ? 1 : 0];
  if (opts.profileId) {
    where.push("r.profile_id = ?");
    params.push(opts.profileId);
  }
  if (opts.accountId) {
    where.push("r.profile_id IN (SELECT id FROM watch_profiles WHERE account_id = ?)");
    params.push(opts.accountId);
  }
  if (opts.q) {
    const like = `%${opts.q.replace(/[%_]/g, "")}%`;
    where.push("(r.title LIKE ? OR r.observation LIKE ? OR r.hook LIKE ? OR r.topic LIKE ? OR r.tags LIKE ? OR r.source LIKE ?)");
    params.push(like, like, like, like, like, like);
  }
  return getDb()
    .prepare(`SELECT r.* FROM radar_posts r WHERE ${where.join(" AND ")} ORDER BY COALESCE(r.posted_on, r.captured_on) DESC, r.id DESC`)
    .all(...params) as RadarPost[];
}

export function getRadarPost(id: number): RadarPost | undefined {
  return getDb().prepare("SELECT * FROM radar_posts WHERE id = ?").get(id) as RadarPost | undefined;
}

export function findRadarPostByUrlKey(key: string): RadarPost | undefined {
  return getDb().prepare("SELECT * FROM radar_posts WHERE url_key = ?").get(key) as RadarPost | undefined;
}

export type RadarPostInput = Omit<RadarPost, "id" | "analysis_json" | "archived" | "created_at" | "updated_at">;

export function saveRadarPost(id: number | null, p: RadarPostInput): number {
  const now = nowIso();
  if (id) {
    getDb()
      .prepare(`UPDATE radar_posts SET profile_id=@profile_id, platform=@platform, url=@url, url_key=@url_key, title=@title, posted_on=@posted_on,
        captured_on=@captured_on, source=@source, format=@format, topic=@topic, hook=@hook, content_excerpt=@content_excerpt,
        observation=@observation, tags=@tags, views=@views, likes=@likes, comments=@comments, shares=@shares, updated_at=@now WHERE id=@id`)
      .run({ ...p, now, id });
    return id;
  }
  const r = getDb()
    .prepare(`INSERT INTO radar_posts (profile_id, platform, url, url_key, title, posted_on, captured_on, source, format, topic, hook, content_excerpt,
        observation, tags, views, likes, comments, shares, created_at, updated_at)
      VALUES (@profile_id, @platform, @url, @url_key, @title, @posted_on, @captured_on, @source, @format, @topic, @hook, @content_excerpt,
        @observation, @tags, @views, @likes, @comments, @shares, @now, @now)`)
    .run({ ...p, now });
  return Number(r.lastInsertRowid);
}

export function setRadarAnalysis(id: number, analysis: unknown) {
  getDb().prepare("UPDATE radar_posts SET analysis_json=?, updated_at=? WHERE id=?").run(JSON.stringify(analysis), nowIso(), id);
}

export function setRadarPostArchived(id: number, archived: boolean) {
  getDb().prepare("UPDATE radar_posts SET archived=?, updated_at=? WHERE id=?").run(archived ? 1 : 0, nowIso(), id);
}

export function deleteRadarPost(id: number) {
  getDb().prepare("DELETE FROM radar_posts WHERE id = ?").run(id);
}

/* ---------- Lernbasis & Übersicht ---------- */

/** Freigegebene oder veröffentlichte Texte eines Accounts – die eigenen Endfassungen. */
export function approvedTexts(accountId: number, limit = 3): Pick<Draft, "id" | "title" | "body" | "format" | "original_body" | "status">[] {
  return getDb()
    .prepare(`SELECT id, title, body, format, original_body, status FROM drafts
      WHERE account_id = ? AND status IN ('freigegeben','geplant','veroeffentlicht') AND TRIM(body) != ''
      ORDER BY COALESCE(approved_at, updated_at) DESC LIMIT ?`)
    .all(accountId, limit) as Pick<Draft, "id" | "title" | "body" | "format" | "original_body" | "status">[];
}

/** Paare aus Ausgangsfassung (KI/extern) und freigegebener Endfassung. */
export function editPairs(accountId?: number): { original: string; final: string }[] {
  return getDb()
    .prepare(`SELECT original_body AS original, body AS final FROM drafts
      WHERE original_body IS NOT NULL AND status IN ('freigegeben','geplant','veroeffentlicht') ${accountId ? "AND account_id = ?" : ""}`)
    .all(...(accountId ? [accountId] : [])) as { original: string; final: string }[];
}

export function lastPublishedByAccount(): Record<number, string> {
  const rows = getDb()
    .prepare("SELECT account_id, MAX(published_at) last FROM posts WHERE published_at IS NOT NULL GROUP BY account_id")
    .all() as { account_id: number; last: string }[];
  return Object.fromEntries(rows.map((r) => [r.account_id, r.last]));
}

export function postsWithMetricsByAccount(): Record<number, number> {
  const rows = getDb()
    .prepare(`SELECT account_id, COUNT(*) c FROM posts WHERE ${METRIC_FIELDS.map((f) => `${f} IS NOT NULL`).join(" OR ")} GROUP BY account_id`)
    .all() as { account_id: number; c: number }[];
  return Object.fromEntries(rows.map((r) => [r.account_id, r.c]));
}

/** Veröffentlichte Beiträge ohne eine einzige Kennzahl, älter als zwei Tage. */
export function postsMissingMetrics(olderThanIso: string): { id: number; title: string; published_at: string | null }[] {
  return getDb()
    .prepare(`SELECT id, topic AS title, published_at FROM posts
      WHERE ${METRIC_FIELDS.map((f) => `${f} IS NULL`).join(" AND ")} AND published_at IS NOT NULL AND published_at < ?
      ORDER BY published_at DESC LIMIT 10`)
    .all(olderThanIso) as { id: number; title: string; published_at: string | null }[];
}

export function countUnassignedIdeasOlderThan(iso: string): number {
  return (getDb()
    .prepare("SELECT COUNT(*) c FROM ideas WHERE archived = 0 AND created_at < ? AND id NOT IN (SELECT idea_id FROM idea_accounts)")
    .get(iso) as { c: number }).c;
}

export function ideaIdsWithDrafts(): Set<number> {
  const rows = getDb().prepare("SELECT DISTINCT idea_id FROM drafts WHERE idea_id IS NOT NULL").all() as { idea_id: number }[];
  return new Set(rows.map((r) => r.idea_id));
}

/* ---------- Einstellungen ---------- */

export function getSetting(key: string): string | null {
  const r = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return r?.value ?? null;
}

export function setSetting(key: string, value: string | null) {
  if (value === null || value === "") getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
  else getDb().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

export function getPostByDraft(draftId: number): Post | undefined {
  return getDb().prepare("SELECT * FROM posts WHERE draft_id = ? ORDER BY id LIMIT 1").get(draftId) as Post | undefined;
}

export function relinkPost(id: number, p: { url: string; published_at: string | null; dedup_key: string }) {
  getDb().prepare("UPDATE posts SET url=@url, published_at=@published_at, dedup_key=@dedup_key, updated_at=@now WHERE id=@id").run({ ...p, now: nowIso(), id });
}

/* ---------- Meine Sprache ---------- */

export type VoiceTrait = {
  id: number;
  kind: "merkmal" | "passt" | "vermeiden";
  text: string;
  source: "eigen" | "abgeleitet";
  status: "bestaetigt" | "vorschlag" | "abgelehnt";
  evidence: string;
  trait_key: string | null;
  created_at: string;
  updated_at: string;
};

export function listVoiceTraits(): VoiceTrait[] {
  return getDb().prepare("SELECT * FROM voice_traits ORDER BY CASE status WHEN 'bestaetigt' THEN 0 WHEN 'vorschlag' THEN 1 ELSE 2 END, kind, id").all() as VoiceTrait[];
}

export function addVoiceTrait(kind: VoiceTrait["kind"], text: string) {
  const now = nowIso();
  getDb().prepare("INSERT INTO voice_traits (kind, text, source, status, evidence, created_at, updated_at) VALUES (?, ?, 'eigen', 'bestaetigt', 'von dir eingetragen', ?, ?)").run(kind, text, now, now);
}

export function updateVoiceTrait(id: number, patch: { text?: string; status?: VoiceTrait["status"]; kind?: VoiceTrait["kind"] }) {
  const t = getDb().prepare("SELECT * FROM voice_traits WHERE id = ?").get(id) as VoiceTrait | undefined;
  if (!t) return;
  getDb()
    .prepare("UPDATE voice_traits SET text = ?, status = ?, kind = ?, updated_at = ? WHERE id = ?")
    .run(patch.text ?? t.text, patch.status ?? t.status, patch.kind ?? t.kind, nowIso(), id);
}

export function deleteVoiceTrait(id: number) {
  getDb().prepare("DELETE FROM voice_traits WHERE id = ?").run(id);
}

/** Abgeleitetes Merkmal als Vorschlag ablegen – bereits bestätigte/abgelehnte bleiben, wie selbst entschieden. */
export function upsertDerivedTrait(key: string, text: string, evidence: string) {
  const db = getDb();
  const ex = db.prepare("SELECT * FROM voice_traits WHERE trait_key = ?").get(key) as VoiceTrait | undefined;
  const now = nowIso();
  if (!ex) {
    db.prepare("INSERT INTO voice_traits (kind, text, source, status, evidence, trait_key, created_at, updated_at) VALUES ('merkmal', ?, 'abgeleitet', 'vorschlag', ?, ?, ?, ?)").run(text, evidence, key, now, now);
  } else if (ex.status === "vorschlag") {
    db.prepare("UPDATE voice_traits SET text = ?, evidence = ?, updated_at = ? WHERE id = ?").run(text, evidence, now, ex.id);
  } else {
    db.prepare("UPDATE voice_traits SET evidence = ?, updated_at = ? WHERE id = ?").run(evidence, now, ex.id);
  }
}

export type VoiceFeedback = { id: number; draft_id: number | null; verdict: "nach_mir" | "nicht_nach_mir"; note: string; excerpt: string; created_at: string };

export function addVoiceFeedback(draftId: number | null, verdict: VoiceFeedback["verdict"], note: string, excerpt: string) {
  getDb().prepare("INSERT INTO voice_feedback (draft_id, verdict, note, excerpt, created_at) VALUES (?, ?, ?, ?, ?)").run(draftId, verdict, note, excerpt, nowIso());
}

export function listVoiceFeedback(limit = 20): VoiceFeedback[] {
  return getDb().prepare("SELECT * FROM voice_feedback ORDER BY id DESC LIMIT ?").all(limit) as VoiceFeedback[];
}

export function voiceFeedbackForDraft(draftId: number): VoiceFeedback[] {
  return getDb().prepare("SELECT * FROM voice_feedback WHERE draft_id = ? ORDER BY id DESC").all(draftId) as VoiceFeedback[];
}

/** Eigene Texte als Stilproben: Originalgedanken, freigegebene Endfassungen, „klingt nach mir“-Auszüge. */
export function styleSamples(): { text: string; source: string }[] {
  const db = getDb();
  const ideas = (db.prepare("SELECT COALESCE(original_text, body) AS t FROM ideas ORDER BY id DESC LIMIT 40").all() as { t: string }[]).map((r) => ({ text: r.t, source: "Originalgedanke" }));
  const approved = (db.prepare("SELECT body AS t FROM drafts WHERE status IN ('freigegeben','geplant','veroeffentlicht') AND TRIM(body) != '' ORDER BY id DESC LIMIT 20").all() as { t: string }[]).map((r) => ({ text: r.t, source: "freigegebener Text" }));
  const liked = (db.prepare("SELECT excerpt AS t FROM voice_feedback WHERE verdict = 'nach_mir' ORDER BY id DESC LIMIT 20").all() as { t: string }[]).map((r) => ({ text: r.t, source: "klingt nach mir" }));
  return [...ideas, ...approved, ...liked];
}
