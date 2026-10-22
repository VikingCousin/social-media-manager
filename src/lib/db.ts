import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SEED_ACCOUNTS } from "./seed";

export function dbPath(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.CONTENTKOMPASS_DB || path.join(process.cwd(), "data", "contentkompass.db"));
}

const MIGRATIONS: string[] = [
  // 1: Grundschema
  `
  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    display_name TEXT NOT NULL,
    handle TEXT NOT NULL DEFAULT '',
    profile_url TEXT NOT NULL DEFAULT '',
    api_status TEXT NOT NULL DEFAULT 'nicht_verbunden',
    positioning TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT '',
    topics TEXT NOT NULL DEFAULT '',
    tone TEXT NOT NULL DEFAULT '',
    formats TEXT NOT NULL DEFAULT '',
    goals TEXT NOT NULL DEFAULT '',
    boundaries TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    snapshot TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    body TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE idea_accounts (
    idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    PRIMARY KEY (idea_id, account_id)
  );

  CREATE TABLE coach_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER REFERENCES ideas(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    model TEXT NOT NULL,
    output_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'entwurf',
    scheduled_at TEXT,
    published_url TEXT NOT NULL DEFAULT '',
    published_at TEXT,
    approved_hash TEXT,
    approved_at TEXT,
    source TEXT NOT NULL DEFAULT 'manuell',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE engagement_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    source_url TEXT NOT NULL DEFAULT '',
    source_text TEXT NOT NULL DEFAULT '',
    my_notes TEXT NOT NULL DEFAULT '',
    comment TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'entwurf',
    source TEXT NOT NULL DEFAULT 'manuell',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    draft_id INTEGER REFERENCES drafts(id) ON DELETE SET NULL,
    published_at TEXT,
    format TEXT NOT NULL DEFAULT '',
    topic TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    dedup_key TEXT NOT NULL UNIQUE,
    views INTEGER,
    reach INTEGER,
    likes INTEGER,
    comments INTEGER,
    shares INTEGER,
    saves INTEGER,
    watch_time_seconds REAL,
    follower_gain INTEGER,
    source TEXT NOT NULL DEFAULT 'manuell',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE inspirations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    observation TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    platform TEXT NOT NULL DEFAULT '',
    observed_on TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // 2: Content-Radar (ersetzt die Inspirations-Sammlung) und Lernbasis
  `
  CREATE TABLE watch_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    handle TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    relation TEXT NOT NULL DEFAULT 'inspiration',
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    why TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    last_checked_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE radar_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER REFERENCES watch_profiles(id) ON DELETE SET NULL,
    platform TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    url_key TEXT,
    title TEXT NOT NULL DEFAULT '',
    posted_on TEXT,
    captured_on TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT '',
    topic TEXT NOT NULL DEFAULT '',
    hook TEXT NOT NULL DEFAULT '',
    content_excerpt TEXT NOT NULL DEFAULT '',
    observation TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    views INTEGER,
    likes INTEGER,
    comments INTEGER,
    shares INTEGER,
    analysis_json TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX radar_posts_url_key ON radar_posts(url_key) WHERE url_key IS NOT NULL;

  INSERT INTO radar_posts (platform, url, url_key, title, captured_on, source, observation, tags, archived, created_at, updated_at)
    SELECT platform, url, NULL, title, observed_on, source, observation, tags, archived, created_at, updated_at FROM inspirations;

  ALTER TABLE drafts ADD COLUMN original_body TEXT;
  ALTER TABLE coach_results ADD COLUMN feedback TEXT;
  ALTER TABLE coach_results ADD COLUMN feedback_note TEXT NOT NULL DEFAULT '';
  `,
  // 3: Plattform-Verbindungen (OAuth). Tokens nur verschlüsselt (AES-256-GCM), Schlüssel außerhalb der DB.
  `
  CREATE TABLE connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    external_name TEXT NOT NULL DEFAULT '',
    external_username TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    profile_url TEXT NOT NULL DEFAULT '',
    scopes TEXT NOT NULL DEFAULT '',
    token_box TEXT NOT NULL,
    access_expires_at TEXT,
    refresh_expires_at TEXT,
    status TEXT NOT NULL DEFAULT 'verbunden',
    last_sync_at TEXT,
    last_error TEXT,
    last_error_at TEXT,
    connected_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (provider, external_id)
  );

  CREATE TABLE oauth_states (
    state TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    code_verifier TEXT,
    redirect_uri TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE pending_connections (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    external_name TEXT NOT NULL DEFAULT '',
    external_username TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    profile_url TEXT NOT NULL DEFAULT '',
    scopes TEXT NOT NULL DEFAULT '',
    token_box TEXT NOT NULL,
    access_expires_at TEXT,
    refresh_expires_at TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  `,
  // 4: Gedanke → drehfertiger Beitrag: Originalwortlaut, Content-Paket am Entwurf, Sprachprofil
  `
  ALTER TABLE ideas ADD COLUMN original_text TEXT;
  ALTER TABLE ideas ADD COLUMN capture_mode TEXT NOT NULL DEFAULT 'formular';
  UPDATE ideas SET original_text = body WHERE original_text IS NULL;

  ALTER TABLE drafts ADD COLUMN package_json TEXT;

  CREATE TABLE voice_traits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    evidence TEXT NOT NULL DEFAULT '',
    trait_key TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX voice_traits_key ON voice_traits(trait_key) WHERE trait_key IS NOT NULL;

  CREATE TABLE voice_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    draft_id INTEGER REFERENCES drafts(id) ON DELETE SET NULL,
    verdict TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    excerpt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
];

// Optionale Start-Sprachmerkmale. Bewusst leer: Eigene Merkmale trägst du unter „Meine Sprache“ ein.
const VOICE_SEED: { kind: string; text: string }[] = [];

function migrate(db: Database.Database) {
  const version = db.pragma("user_version", { simple: true }) as number;
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}

function seed(db: Database.Database) {
  const done = db.prepare("SELECT value FROM settings WHERE key = 'seeded_accounts'").get();
  if (done) return;
  const now = new Date().toISOString();
  const insert = db.prepare(`INSERT INTO accounts
    (platform, display_name, handle, profile_url, positioning, audience, topics, tone, formats, goals, boundaries, notes, snapshot, created_at, updated_at)
    VALUES (@platform, @display_name, @handle, @profile_url, @positioning, @audience, @topics, @tone, @formats, @goals, @boundaries, @notes, @snapshot, @now, @now)`);
  db.transaction(() => {
    for (const a of SEED_ACCOUNTS) insert.run({ ...a, now });
    db.prepare("INSERT INTO settings (key, value) VALUES ('seeded_accounts', ?)").run(now);
  })();
}

function seedVoice(db: Database.Database) {
  if (db.prepare("SELECT value FROM settings WHERE key = 'seeded_voice'").get()) return;
  const now = new Date().toISOString();
  const ins = db.prepare("INSERT INTO voice_traits (kind, text, source, status, evidence, created_at, updated_at) VALUES (?, ?, 'eigen', 'bestaetigt', 'von dir genannt', ?, ?)");
  db.transaction(() => {
    for (const t of VOICE_SEED) ins.run(t.kind, t.text, now, now);
    db.prepare("INSERT INTO settings (key, value) VALUES ('seeded_voice', ?)").run(now);
  })();
}

const globalForDb = globalThis as unknown as { __ckDb?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb.__ckDb) return globalForDb.__ckDb;
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  seedVoice(db);
  globalForDb.__ckDb = db;
  return db;
}

export function nowIso() {
  return new Date().toISOString();
}
