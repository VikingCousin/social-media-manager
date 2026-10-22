import "server-only";
// Fügt Daten aus der Datenbank zu Kontexten zusammen: Lernbasis für die KI, Eingaben für die
// Übersicht („Was als Nächstes?“) und den tatsächlichen Status von Verbindungen und Automatisierungen.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as repo from "./repo";
import { aiConfigured, currentModel } from "./ai";
import { summarize } from "@/lib/analytics";
import { approvalHash, PLATFORMS, positioningGaps, type Account } from "@/lib/domain";
import { editStats } from "@/lib/learning";
import { buildTasks, recommendNext, type PlannerDraft, type PlannerIdea } from "@/lib/planner";
import { classifyHook, countBy } from "@/lib/radar";
import { parseAllowedLogins } from "@/lib/access";
import { listConnections } from "./connections";
import { CONN_STATE_LABELS, connectionState } from "@/lib/platforms";

const DAY = 86_400_000;

export function accountLabel(a: Pick<Account, "platform" | "display_name">) {
  return `${PLATFORMS[a.platform] ?? a.platform} · ${a.display_name}`;
}

/* ---------- Lernbasis ---------- */

export type LearningSnapshot = {
  account: Account;
  approved: { id: number; title: string; body: string }[];
  editSummary: string[];
  editCount: number;
  ownNotes: string[];
  ownN: number;
  radar: { n: number; formats: { key: string; n: number }[]; hookTypes: { key: string; n: number }[] };
};

export function learningSnapshot(account: Account): LearningSnapshot {
  const approved = repo.approvedTexts(account.id, 3).map((d) => ({ id: d.id, title: d.title, body: d.body }));
  const stats = editStats(repo.editPairs(account.id));
  const s = summarize(repo.listPosts(account.id));
  const radarPosts = repo.listRadarPosts({ accountId: account.id });
  return {
    account,
    approved,
    editSummary: stats.summary,
    editCount: stats.n,
    ownNotes: s.notes,
    ownN: s.n,
    radar: {
      n: radarPosts.length,
      formats: countBy(radarPosts, (p) => p.format).slice(0, 3),
      hookTypes: countBy(radarPosts.filter((p) => p.hook.trim()), (p) => classifyHook(p.hook)).slice(0, 3),
    },
  };
}

/** Text für den Prompt – jede Angabe mit Herkunft. Leer, wenn es noch nichts zu lernen gibt. */
/** Sprachprofil für Prompts: nur selbst bestätigte Merkmale und begründete Rückmeldungen. */
export function voiceContextText(): string {
  const traits = repo.listVoiceTraits().filter((t) => t.status === "bestaetigt");
  const group = (k: string) => traits.filter((t) => t.kind === k).map((t) => `- ${t.text}`);
  const lines: string[] = [];
  const m = group("merkmal");
  const pa = group("passt");
  const v = group("vermeiden");
  if (m.length) lines.push(`Merkmale:\n${m.join("\n")}`);
  if (pa.length) lines.push(`Passt zur Person (nur verwenden, wenn es natürlich passt):\n${pa.join("\n")}`);
  if (v.length) lines.push(`Vermeiden:\n${v.join("\n")}`);
  const fb = repo.listVoiceFeedback(12);
  const good = fb.filter((f) => f.verdict === "nach_mir").slice(0, 3);
  const bad = fb.filter((f) => f.verdict === "nicht_nach_mir").slice(0, 5);
  if (good.length) lines.push(`Klingt nach der Person (Auszüge):\n${good.map((f) => `- „${f.excerpt.slice(0, 300)}“${f.note ? ` – ${f.note}` : ""}`).join("\n")}`);
  if (bad.length) lines.push(`Klingt NICHT nach der Person:\n${bad.map((f) => `- „${f.excerpt.slice(0, 160)}“${f.note ? ` – Grund: ${f.note}` : ""}`).join("\n")}`);
  return lines.length ? `### Sprachprofil (selbst bestätigt; Kontextanpassung, kein Modelltraining)\n${lines.join("\n\n")}` : "";
}

export function learningContextText(accounts: Account[]): string {
  const parts: string[] = [];
  const voice = voiceContextText();
  if (voice) parts.push(voice);
  for (const a of accounts) {
    const l = learningSnapshot(a);
    const lines: string[] = [];
    for (const t of l.approved) lines.push(`[Eigene freigegebene Endfassung${t.title ? ` „${t.title}“` : ""}]\n${t.body.slice(0, 1200)}`);
    if (l.editSummary.length) lines.push(`[Eigene Überarbeitungen, n=${l.editCount}] ${l.editSummary.join(" ")}`);
    if (l.ownN > 0) lines.push(`[Eigene Daten, n=${l.ownN}] ${l.ownNotes.join(" ")}`);
    if (l.radar.n > 0) {
      lines.push(
        `[Content-Radar (extern), ${l.radar.n} beobachtete Beiträge] Häufige Formate: ${l.radar.formats.map((f) => `${f.key} (${f.n})`).join(", ") || "–"}; Einstiegs-Typen: ${l.radar.hookTypes.map((h) => `${h.key} (${h.n})`).join(", ") || "–"}. Kein Beleg für das eigene Publikum.`,
      );
    }
    if (lines.length) parts.push(`### Account-ID ${a.id} (${accountLabel(a)})\n${lines.join("\n\n")}`);
  }
  const fb = repo.recentCoachFeedback(6).filter((f) => f.feedback === "passt_nicht" || f.feedback_note);
  if (fb.length) {
    parts.push(
      `### Rückmeldungen zu früheren Vorschlägen\n${fb
        .map((f) => `- ${f.feedback === "passt" ? "Passte" : "Passte nicht"}${f.feedback_note ? `: ${f.feedback_note}` : ""}`)
        .join("\n")}`,
    );
  }
  return parts.join("\n\n");
}

/* ---------- Übersicht ---------- */

export function overviewData(nowIso = new Date().toISOString()) {
  const accounts = repo.listAccounts();
  const plannerAccounts = accounts.map((a) => ({ id: a.id, label: accountLabel(a), gaps: positioningGaps(a) }));
  const drafts = repo.listDrafts();
  const plannerDrafts: PlannerDraft[] = drafts.map((d) => ({
    id: d.id,
    account_id: d.account_id,
    title: d.title,
    body: d.body,
    format: d.format,
    status: d.status,
    scheduled_at: d.scheduled_at,
    approval_valid: Boolean(d.approved_hash && d.approved_hash === approvalHash(d)),
    idea_id: d.idea_id,
  }));
  const coach = repo.latestCoachByIdea();
  const withDrafts = repo.ideaIdsWithDrafts();
  const plannerIdeas: PlannerIdea[] = repo.listIdeas().map((i) => {
    const c = coach.get(i.id);
    let parsed: { recommended_account_id?: number; recommendation_provisional?: boolean; questions_for_me?: string[] } | null = null;
    try {
      parsed = c ? JSON.parse(c.output_json) : null;
    } catch {
      parsed = null;
    }
    const coachAccount = parsed?.recommended_account_id;
    return {
      id: i.id,
      title: i.title,
      body: i.body,
      account_ids: i.account_ids,
      coach:
        c && coachAccount && accounts.some((a) => a.id === coachAccount) && c.feedback !== "passt_nicht"
          ? { account_id: coachAccount, provisional: Boolean(parsed?.recommendation_provisional), questions: parsed?.questions_for_me ?? [], created_at: c.created_at }
          : null,
      has_draft: withDrafts.has(i.id),
    };
  });
  const recommendations = recommendNext({
    now: nowIso,
    accounts: plannerAccounts,
    drafts: plannerDrafts,
    ideas: plannerIdeas,
    lastPublished: repo.lastPublishedByAccount(),
    postsWithMetrics: repo.postsWithMetricsByAccount(),
  });
  const now = Date.parse(nowIso);
  const staleProfiles = repo
    .listWatchProfiles()
    .filter((p) => !p.last_checked_at || now - Date.parse(p.last_checked_at) > 14 * DAY)
    .map((p) => ({ id: p.id, label: `${PLATFORMS[p.platform] ?? p.platform} ${p.display_name || p.handle}`, last_checked_at: p.last_checked_at }));
  const tasks = buildTasks({
    now: nowIso,
    drafts: plannerDrafts,
    accounts: plannerAccounts,
    postsMissingMetrics: repo.postsMissingMetrics(new Date(now - 2 * DAY).toISOString()),
    staleProfiles,
    unassignedOldIdeas: repo.countUnassignedIdeasOlderThan(new Date(now - 14 * DAY).toISOString()),
  });
  const pendingApprovals = drafts.filter((d) => d.status === "bereit");
  return { accounts, recommendations, tasks, pendingApprovals, pipelineEmpty: plannerDrafts.filter((d) => d.status !== "veroeffentlicht").length === 0 && plannerIdeas.length === 0 };
}

/* ---------- Verbindungen & Automatisierungen ---------- */

export type StatusRow = { name: string; state: "aktiv" | "manuell" | "aus" | "nicht verfügbar"; detail: string };

function launchAgentExists(label: string) {
  return fs.existsSync(path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`));
}

function latestBackup(): Date | null {
  const dir = path.join(process.cwd(), "backups");
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".db"));
    const times = files.map((f) => fs.statSync(path.join(dir, f)).mtime.getTime());
    return times.length ? new Date(Math.max(...times)) : null;
  } catch {
    return null;
  }
}

export function automationStatus(): { connections: StatusRow[]; automations: StatusRow[] } {
  const accounts = repo.listAccounts();
  const conns = new Map(listConnections().map((c) => [c.account_id, c]));
  const nowIso = new Date().toISOString();
  const connections: StatusRow[] = accounts.map((a) => {
    const c = conns.get(a.id);
    if (!c) return { name: accountLabel(a), state: "aus", detail: "Nicht verbunden – Einrichtung unter Verbindungen." };
    const st = connectionState(c, nowIso);
    return {
      name: accountLabel(a),
      state: st === "verbunden" || st === "laeuft_ab" ? "aktiv" : "aus",
      detail: `${CONN_STATE_LABELS[st]} als ${c.external_username ? "@" + c.external_username : c.external_name}. Letzte Synchronisierung: ${c.last_sync_at ? new Date(c.last_sync_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "noch keine"}.`,
    };
  });
  const backup = latestBackup();
  const backupAgent = launchAgentExists("de.contentkompass.backup");
  const serverAgent = launchAgentExists("de.contentkompass.server");
  const tailscaleGuard = parseAllowedLogins(process.env.CK_ALLOWED_TAILSCALE_LOGINS).length > 0;
  const ageDays = backup ? Math.floor((Date.now() - backup.getTime()) / DAY) : null;
  const automations: StatusRow[] = [
    aiConfigured()
      ? { name: "KI-Assistent", state: "aktiv", detail: `Anthropic API eingerichtet (${currentModel()}). Läuft nur auf Knopfdruck.` }
      : { name: "KI-Assistent", state: "aus", detail: "Kein API-Schlüssel – kopierbare Prompts stehen bereit." },
    { name: "Kennzahlen-Abruf", state: [...conns.values()].some((c) => c.provider === "tiktok" && c.scopes.includes("video.list")) ? "aktiv" : "manuell", detail: "TikTok-Videos per Synchronisierung, sobald video.list erteilt ist. LinkedIn und Instagram: manuell oder per CSV." },
    { name: "Content-Radar", state: "manuell", detail: "Profile und Beiträge werden von dir erfasst. Kein automatisches Auslesen fremder Profile." },
    { name: "Auswertungen", state: "aktiv", detail: "Werden bei jedem Aufruf aus den vorhandenen Daten berechnet (eigene Daten und Radar getrennt)." },
    { name: "Veröffentlichung", state: "nicht verfügbar", detail: "Nichts wird extern veröffentlicht. LinkedIn ist vorbereitet (Freigabe-Prüfung und Vorschau im Entwurf), das Senden ist noch nicht freigeschaltet." },
    {
      name: "Backup",
      state: backupAgent ? "aktiv" : "manuell",
      detail: `${backupAgent ? "Tägliche Sicherung eingerichtet." : "Keine automatische Sicherung eingerichtet (npm run backup)."} ${backup ? `Letztes Backup vor ${ageDays === 0 ? "weniger als einem Tag" : `${ageDays} Tag${ageDays === 1 ? "" : "en"}`}.` : "Noch kein Backup gefunden."}`,
    },
    { name: "Autostart auf dem Mac", state: serverAgent ? "aktiv" : "aus", detail: serverAgent ? "Startet beim Anmelden." : "Läuft nur, wenn du die App startest." },
    {
      name: "Zugriff vom iPhone",
      state: tailscaleGuard ? "aktiv" : "aus",
      detail: tailscaleGuard ? "Tailscale-Zugangsprüfung ist konfiguriert (ob Tailscale läuft, wird hier nicht geprüft)." : "Nur auf diesem Mac erreichbar (127.0.0.1).",
    },
  ];
  return { connections, automations };
}
