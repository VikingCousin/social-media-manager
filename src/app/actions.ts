"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as repo from "@/server/repo";
import { AiError, aiConfigured, runEngagement, runPackage, runRadarAnalysis } from "@/server/ai";
import { DRAFT_STATUSES, PLATFORMS, approvalHash, splitTags, type DraftStatus } from "@/lib/domain";
import { int, ints, metricsFromForm, safeBack, str, urlOrEmpty, withFlash } from "@/lib/forms";
import { METRIC_LABELS, dedupKey, normalizeUrl, parseMetric, parsePerformanceCsv, MAX_CSV_BYTES } from "@/lib/csv";
import { RELATIONS } from "@/lib/radar";
import { learningContextText } from "@/server/context";
import { cookies, headers } from "next/headers";
import { ConnectionError, confirmPending, createState, disconnect, discardPending, providerSetup, syncConnection } from "@/server/connections";
import { PROVIDERS, buildAuthorizeUrl, providerForPlatform } from "@/lib/platforms";
import { localInputToUtc, parseFlexibleDate, todayBerlin as nowIsoDate } from "@/lib/time";
import type { DraftKind } from "@/lib/prompts";
import { PACKAGE_LIST_FIELDS, PACKAGE_TEXT_FIELDS, emptyPackage, linesToList, parsePackageMarkdown, type ContentPackage } from "@/lib/package";
import { deriveStyleTraits } from "@/lib/voice";

function done(path: string, msg: string): never {
  revalidatePath("/", "layout");
  redirect(withFlash(path, "ok", msg));
}

function fail(path: string, msg: string): never {
  redirect(withFlash(path, "fehler", msg));
}

/* ================= Accounts ================= */

export async function saveAccountAction(fd: FormData) {
  const id = int(fd, "id");
  const back = id ? `/accounts/${id}` : "/accounts/neu";
  const platform = str(fd, "platform", 40);
  const display_name = str(fd, "display_name", 120);
  const profile_url = str(fd, "profile_url", 500);
  if (!PLATFORMS[platform]) fail(back, "Bitte eine Plattform wählen.");
  if (!display_name) fail(back, "Bitte einen Namen angeben.");
  if (!urlOrEmpty.safeParse(profile_url).success) fail(back, "Profil-Link muss mit https:// beginnen.");
  const data = {
    platform,
    display_name,
    handle: str(fd, "handle", 120),
    profile_url,
    positioning: str(fd, "positioning", 4000),
    audience: str(fd, "audience", 4000),
    topics: str(fd, "topics", 4000),
    tone: str(fd, "tone", 4000),
    formats: str(fd, "formats", 4000),
    goals: str(fd, "goals", 4000),
    boundaries: str(fd, "boundaries", 4000),
    notes: str(fd, "notes", 4000),
    snapshot: str(fd, "snapshot", 2000),
  };
  if (id) {
    if (!repo.getAccount(id)) fail("/accounts", "Account nicht gefunden.");
    repo.updateAccount(id, data);
    done(`/accounts/${id}`, "Steckbrief gespeichert.");
  }
  const newId = repo.createAccount(data);
  done(`/accounts/${newId}`, "Account angelegt.");
}

export async function archiveAccountAction(fd: FormData) {
  const id = int(fd, "id");
  if (!id) fail("/accounts", "Ungültiger Account.");
  const archived = str(fd, "archived") === "1";
  repo.setAccountArchived(id, archived);
  done(archived ? "/accounts" : `/accounts/${id}`, archived ? "Account archiviert." : "Account wiederhergestellt.");
}

/* ================= Ideen ================= */

function ideaFields(fd: FormData) {
  return {
    body: str(fd, "body", 10000),
    title: str(fd, "title", 200),
    tags: splitTags(str(fd, "tags", 500)).join(","),
    notes: str(fd, "notes", 10000),
    account_ids: ints(fd, "account_ids"),
  };
}

export type CaptureResult = { ok: true; id: number; savedAt: string; chars: number } | { ok: false; error: string };

/** Gedanken festhalten – liefert erst nach dem tatsächlichen Speichern eine Bestätigung (kein Redirect). */
export async function captureIdeaAction(fd: FormData): Promise<CaptureResult> {
  const raw = fd.get("body");
  const text = typeof raw === "string" ? raw.replace(/\r\n/g, "\n").trim().slice(0, 10000) : "";
  if (!text) return { ok: false, error: "Leer – es wurde nichts gespeichert." };
  const mode = str(fd, "mode", 20) === "ruhig" ? "ruhig" : "schnell";
  try {
    const id = repo.createIdea({
      body: text,
      title: mode === "ruhig" ? "" : str(fd, "title", 200),
      tags: mode === "ruhig" ? "" : splitTags(str(fd, "tags", 500)).join(","),
      notes: "",
      account_ids: mode === "ruhig" ? [] : ints(fd, "account_ids"),
      capture_mode: mode,
    });
    const saved = repo.getIdea(id);
    if (!saved || saved.original_text !== text) return { ok: false, error: "Speichern ließ sich nicht bestätigen. Bitte erneut versuchen." };
    revalidatePath("/", "layout");
    return { ok: true, id, savedAt: saved.created_at, chars: text.length };
  } catch {
    return { ok: false, error: "Speichern fehlgeschlagen (Datenbank). Dein Text ist noch im Eingabefeld." };
  }
}

export async function updateIdeaAction(fd: FormData) {
  const id = int(fd, "id");
  if (!id || !repo.getIdea(id)) fail("/ideen", "Idee nicht gefunden.");
  const data = ideaFields(fd);
  if (!data.body) fail(`/ideen/${id}`, "Der Ideentext darf nicht leer sein.");
  repo.updateIdea(id, data);
  done(`/ideen/${id}`, "Idee gespeichert.");
}

export async function archiveIdeaAction(fd: FormData) {
  const id = int(fd, "id");
  if (!id) fail("/ideen", "Ungültige Idee.");
  const archived = str(fd, "archived") === "1";
  repo.setIdeaArchived(id, archived);
  done(safeBack(fd, "/ideen"), archived ? "Idee archiviert." : "Idee wieder aktiv.");
}


export async function coachFeedbackAction(fd: FormData) {
  const id = int(fd, "id");
  const ideaId = int(fd, "idea_id");
  const v = str(fd, "feedback", 20);
  const feedback = v === "passt" || v === "passt_nicht" ? v : null;
  if (id) repo.setCoachFeedback(id, feedback, str(fd, "feedback_note", 500));
  done(ideaId ? `/ideen/${ideaId}#coach` : "/ideen", feedback ? "Danke – die Rückmeldung fließt in künftige Vorschläge ein." : "Rückmeldung entfernt.");
}

export async function deleteCoachResultAction(fd: FormData) {
  const id = int(fd, "id");
  const ideaId = int(fd, "idea_id");
  if (id) repo.deleteCoachResult(id);
  done(ideaId ? `/ideen/${ideaId}#coach` : "/ideen", "Coach-Ergebnis gelöscht.");
}

/* ================= Content-Paket („Ausarbeiten“) ================= */

function ideaPromptInput(idea: repo.Idea) {
  return {
    title: idea.title,
    body: idea.body,
    notes: idea.notes,
    tags: idea.tags,
    preferredAccountIds: idea.account_ids,
    original: idea.original_text ?? idea.body,
  };
}

export async function elaborateIdeaAction(fd: FormData) {
  const id = int(fd, "id");
  const idea = id ? repo.getIdea(id) : undefined;
  if (!idea) fail("/ideen", "Idee nicht gefunden.");
  const back = `/ideen/${idea.id}`;
  if (!aiConfigured()) fail(`${back}#paket`, "KI ist nicht eingerichtet – nutze den kopierbaren Prompt und füge das Ergebnis ein.");
  const accounts = repo.listAccounts();
  const withScript = str(fd, "with_script") === "1";
  let result;
  try {
    result = await runPackage(ideaPromptInput(idea), accounts, withScript, learningContextText(accounts));
  } catch (err) {
    fail(`${back}#paket`, err instanceof AiError ? err.message : "KI-Aufruf fehlgeschlagen.");
  }
  const o = result.output;
  repo.saveCoachResult(idea.id, "paket", result.model, o);
  const alt = o.alternative_account_id ? repo.getAccount(o.alternative_account_id) : undefined;
  const pkg: ContentPackage = {
    account_reason: (o.recommendation_provisional ? "Vorläufig: " : "") + o.recommendation_reason,
    alternative: alt ? `${alt.display_name}: ${o.alternative_reason}` : "",
    angle: o.angle,
    effect: o.effect,
    hook_spoken: o.hook_spoken,
    hook_text: o.hook_text_on_screen,
    hook_visual: o.hook_visual,
    hook_combo: o.hook_combination,
    throughline: o.throughline,
    shoot_say: o.shoot_say,
    shoot_show: o.shoot_show,
    shoot_broll: o.shoot_broll,
    shoot_location: o.shoot_location,
    caption: o.caption,
    questions: o.questions_for_me,
    examples_needed: o.examples_needed,
  };
  repo.createDraft({
    idea_id: idea.id,
    account_id: o.recommended_account_id,
    title: o.title.slice(0, 200),
    format: o.format.slice(0, 60),
    body: o.script,
    status: "entwurf",
    scheduled_at: null,
    source: "ki",
    package_json: JSON.stringify(pkg),
  });
  done(`${back}#paket`, "Content-Paket erstellt – bitte prüfen, mit eigenen Angaben füllen und anpassen.");
}

/** Ohne API-Schlüssel: extern erzeugtes Ergebnis (Gliederung aus dem kopierbaren Prompt) einlesen. */
export async function importPackageAction(fd: FormData) {
  const id = int(fd, "id");
  const idea = id ? repo.getIdea(id) : undefined;
  if (!idea) fail("/ideen", "Idee nicht gefunden.");
  const back = `/ideen/${idea.id}#paket`;
  const text = str(fd, "result", 30000);
  if (!text) fail(back, "Bitte das Ergebnis einfügen.");
  const parsed = parsePackageMarkdown(text);
  const filled = [...PACKAGE_TEXT_FIELDS.map((k) => parsed.pkg[k]), parsed.script, parsed.title].filter((v) => v.trim()).length + parsed.pkg.throughline.length;
  if (filled === 0) fail(back, "Im eingefügten Text wurden keine der erwarteten Überschriften gefunden (## Gesprochener Einstieg, ## Caption …). Bitte die Gliederung aus dem Prompt verwenden.");
  const accounts = repo.listAccounts();
  const a = parsed.account.toLowerCase();
  const idHit = /(?:account-id|account id|\bid)\s*:?\s*(\d+)/.exec(a);
  const match =
    (idHit ? accounts.find((x) => x.id === Number(idHit[1])) : undefined) ??
    accounts.find((x) => x.handle && a.includes(x.handle.toLowerCase().replace(/^@/, ""))) ??
    accounts.find((x) => a.includes(x.display_name.toLowerCase()));
  const pkg = { ...parsed.pkg };
  if (parsed.account && !match) pkg.account_reason = `${parsed.account}\n${pkg.account_reason}`.trim();
  const accountId = match?.id ?? (idea.account_ids[0] ?? null);
  const platform = accounts.find((x) => x.id === accountId)?.platform;
  // Vorschlag aus der Plattform – im Paket jederzeit änderbar.
  const format = platform === "tiktok" ? "Kurzvideo" : platform === "instagram" ? "Reel" : platform === "linkedin" ? "LinkedIn-Textbeitrag" : "";
  repo.createDraft({
    idea_id: idea.id,
    account_id: accountId,
    title: parsed.title.slice(0, 200),
    format,
    body: parsed.script + (parsed.unmatched ? `\n\n[Nicht zugeordnet]\n${parsed.unmatched}` : ""),
    status: "entwurf",
    scheduled_at: null,
    source: "extern",
    package_json: JSON.stringify(pkg),
  });
  done(back, match ? "Content-Paket eingelesen." : "Content-Paket eingelesen – bitte Account prüfen (nicht eindeutig erkannt).");
}

/* ================= Meine Sprache ================= */

export async function voiceFeedbackAction(fd: FormData) {
  const draftId = int(fd, "draft_id");
  const d = draftId ? repo.getDraft(draftId) : undefined;
  if (!d) fail("/sprache", "Entwurf nicht gefunden.");
  const back = safeBack(fd, `/entwuerfe/${d.id}`);
  const verdict = str(fd, "verdict", 20) === "nach_mir" ? "nach_mir" : "nicht_nach_mir";
  const field = str(fd, "field", 20);
  const pkg = d.package_json ? JSON.parse(d.package_json) as Partial<ContentPackage> : {};
  const excerpt = (field === "caption" ? pkg.caption ?? "" : field === "hook" ? pkg.hook_spoken ?? "" : d.body).trim();
  if (!excerpt) fail(back, "Für diese Rückmeldung gibt es noch keinen Text.");
  const note = str(fd, "note", 500);
  if (verdict === "nicht_nach_mir" && !note) fail(back, "Bitte kurz begründen, was nicht nach dir klingt – sonst kann der Coach es nicht berücksichtigen.");
  repo.addVoiceFeedback(d.id, verdict, note, excerpt.slice(0, 2000));
  done(back, verdict === "nach_mir" ? "Gemerkt: klingt nach dir." : "Gemerkt: klingt nicht nach dir – die Begründung fließt in künftige Vorschläge ein.");
}

export async function voiceTraitAction(fd: FormData) {
  const op = str(fd, "op", 20);
  const id = int(fd, "id");
  if (op === "add") {
    const text = str(fd, "text", 300);
    const kindRaw = str(fd, "kind", 20);
    const kind = kindRaw === "passt" || kindRaw === "vermeiden" ? kindRaw : "merkmal";
    if (!text) fail("/sprache", "Bitte einen Text eingeben.");
    repo.addVoiceTrait(kind, text);
    done("/sprache", "Eingetragen.");
  }
  if (!id) fail("/sprache", "Ungültiger Eintrag.");
  if (op === "bestaetigen") repo.updateVoiceTrait(id, { status: "bestaetigt" });
  else if (op === "ablehnen") repo.updateVoiceTrait(id, { status: "abgelehnt" });
  else if (op === "korrigieren") {
    const text = str(fd, "text", 300);
    if (!text) fail("/sprache", "Der Text darf nicht leer sein.");
    repo.updateVoiceTrait(id, { text, status: "bestaetigt" });
  } else if (op === "loeschen") repo.deleteVoiceTrait(id);
  done("/sprache", "Gespeichert.");
}

export async function deriveVoiceAction() {
  const samples = repo.styleSamples();
  const traits = deriveStyleTraits(samples);
  for (const t of traits) repo.upsertDerivedTrait(t.key, t.text, `${t.evidence}${t.example ? ` · Beispiel: „${t.example}“` : ""}`);
  done("/sprache", traits.length ? `${traits.length} Merkmale aus ${samples.length} eigenen Texten abgeleitet – bitte prüfen.` : `Noch zu wenig eigene Texte (${samples.length}). Ab drei Texten mit etwas Länge werden Merkmale vorgeschlagen.`);
}

/* ================= Entwürfe & Plan ================= */

export async function createDraftAction(fd: FormData) {
  const back = safeBack(fd, "/entwuerfe");
  const ideaId = int(fd, "idea_id");
  const accountId = int(fd, "account_id");
  const body = str(fd, "body", 30000);
  const title = str(fd, "title", 200);
  const sourceRaw = str(fd, "source", 20);
  const source = ["manuell", "ki", "extern"].includes(sourceRaw) ? sourceRaw : "manuell";
  if (!body && !title) fail(back, "Bitte mindestens einen Titel oder Text angeben.");
  if (accountId && !repo.getAccount(accountId)) fail(back, "Unbekannter Account.");
  const id = repo.createDraft({
    idea_id: ideaId && repo.getIdea(ideaId) ? ideaId : null,
    account_id: accountId,
    title,
    format: str(fd, "format", 60),
    body,
    status: body ? "entwurf" : "idee",
    scheduled_at: null,
    source,
  });
  done(`/entwuerfe/${id}`, "Entwurf angelegt.");
}

export async function saveDraftAction(fd: FormData) {
  const id = int(fd, "id");
  const d = id ? repo.getDraft(id) : undefined;
  if (!d) fail("/entwuerfe", "Entwurf nicht gefunden.");
  const back = safeBack(fd, `/entwuerfe/${d.id}`);
  // Nur Felder ändern, die das Formular tatsächlich mitschickt (Entwurfsseite und Paket an der Idee nutzen dieselbe Aktion).
  const next = {
    account_id: d.account_id,
    title: d.title,
    format: d.format,
    body: d.body,
    scheduled_at: d.scheduled_at,
    package_json: d.package_json,
  };
  if (fd.has("account_id")) {
    const accountId = int(fd, "account_id");
    if (accountId && !repo.getAccount(accountId)) fail(back, "Unbekannter Account.");
    next.account_id = accountId;
  }
  if (fd.has("title")) next.title = str(fd, "title", 200);
  if (fd.has("format")) next.format = str(fd, "format", 60);
  if (fd.has("body")) next.body = str(fd, "body", 30000);
  if (fd.has("scheduled_at")) {
    const scheduledRaw = str(fd, "scheduled_at", 30);
    const scheduled_at = scheduledRaw ? localInputToUtc(scheduledRaw) : null;
    if (scheduledRaw && !scheduled_at) fail(back, "Termin ist ungültig.");
    next.scheduled_at = scheduled_at;
  }
  if (fd.has("pkg_present")) next.package_json = JSON.stringify(packageFromForm(fd));
  const patch: Partial<repo.Draft> = { ...next };
  let msg = "Gespeichert.";
  if (d.approved_hash && approvalHash(next) !== d.approved_hash) {
    patch.approved_hash = null;
    patch.approved_at = null;
    if (d.status === "freigegeben" || d.status === "geplant") patch.status = "bereit";
    msg = "Gespeichert. Die Freigabe wurde aufgehoben, weil sich Inhalt, Paket, Account, Format oder Termin geändert haben – bitte erneut freigeben.";
  }
  repo.updateDraftRow(d.id, patch);
  done(back, msg);
}

function packageFromForm(fd: FormData): ContentPackage {
  const p = emptyPackage();
  for (const k of PACKAGE_TEXT_FIELDS) p[k] = str(fd, `pkg_${k}`, 6000);
  for (const k of PACKAGE_LIST_FIELDS) p[k] = linesToList(str(fd, `pkg_${k}`, 6000));
  return p;
}

export async function setDraftStatusAction(fd: FormData) {
  const id = int(fd, "id");
  const d = id ? repo.getDraft(id) : undefined;
  if (!d) fail("/entwuerfe", "Entwurf nicht gefunden.");
  const back = safeBack(fd, `/entwuerfe/${d.id}`);
  const target = str(fd, "status", 30) as DraftStatus;
  if (!DRAFT_STATUSES.includes(target)) fail(back, "Unbekannter Status.");
  const now = new Date().toISOString();
  const currentHash = approvalHash(d);
  const approvalValid = Boolean(d.approved_hash && d.approved_hash === currentHash);

  switch (target) {
    case "idee":
    case "entwurf":
    case "bereit":
      repo.updateDraftRow(d.id, { status: target, approved_hash: null, approved_at: null });
      done(back, `Status: ${target === "bereit" ? "Bereit zur Freigabe" : target === "idee" ? "Idee" : "Entwurf"}.`);
    case "freigegeben":
      if (!d.account_id) fail(back, "Für eine Freigabe muss ein Account gewählt sein.");
      if (!d.body.trim()) fail(back, "Ein leerer Entwurf kann nicht freigegeben werden.");
      repo.updateDraftRow(d.id, {
        status: d.scheduled_at ? "geplant" : "freigegeben",
        approved_hash: currentHash,
        approved_at: now,
      });
      done(back, d.scheduled_at ? "Freigegeben und eingeplant (nur Redaktionsplan – es wird nichts automatisch veröffentlicht)." : "Freigegeben. Setze einen Termin, um ihn einzuplanen.");
    case "geplant":
      if (!d.account_id) fail(back, "Zum Einplanen muss ein Account gewählt sein.");
      if (!d.scheduled_at) fail(back, "Zum Einplanen bitte zuerst einen Termin speichern.");
      if (!approvalValid) fail(back, "Bitte zuerst freigeben. Die Freigabe gilt für genau diesen Inhalt, Account und Termin.");
      repo.updateDraftRow(d.id, { status: "geplant" });
      done(back, "Eingeplant (nur Redaktionsplan – keine automatische Veröffentlichung).");
    case "veroeffentlicht":
      fail(back, "Bitte „Als veröffentlicht bestätigen“ mit dem Beitrags-Link verwenden.");
  }
}

export async function markPublishedAction(fd: FormData) {
  const id = int(fd, "id");
  const d = id ? repo.getDraft(id) : undefined;
  if (!d) fail("/entwuerfe", "Entwurf nicht gefunden.");
  const back = `/entwuerfe/${d.id}`;
  const url = str(fd, "published_url", 2000);
  if (!url || !urlOrEmpty.safeParse(url).success) fail(back, "Bitte den vollständigen Beitrags-Link (https://…) angeben.");
  if (!d.account_id) fail(back, "Bitte zuerst einen Account wählen und speichern.");
  const whenRaw = str(fd, "published_at", 30);
  const published_at = whenRaw ? localInputToUtc(whenRaw) : new Date().toISOString();
  if (!published_at) fail(back, "Veröffentlichungszeitpunkt ist ungültig.");
  const norm = normalizeUrl(url);
  const key = dedupKey({ account_id: d.account_id, url: norm, published_at, format: d.format, topic: d.title });
  const linked = repo.getPostByDraft(d.id);
  const clash = repo.findPostByDedupKey(key);
  if (linked) {
    if (clash && clash.id !== linked.id) fail(back, "Unter diesem Link ist bereits ein anderer Beitrag erfasst.");
    repo.updateDraftRow(d.id, { status: "veroeffentlicht", published_url: url, published_at });
    repo.relinkPost(linked.id, { url: norm, published_at, dedup_key: key });
    done(back, "Veröffentlichung aktualisiert. Der verknüpfte Beitrag unter Performance wurde angepasst.");
  }
  repo.updateDraftRow(d.id, { status: "veroeffentlicht", published_url: url, published_at });
  const empty = { views: null, reach: null, likes: null, comments: null, shares: null, saves: null, watch_time_seconds: null, follower_gain: null };
  repo.upsertPost({ account_id: d.account_id, published_at, format: d.format, topic: d.title, url: norm, dedup_key: key, metrics: empty }, "entwurf", d.id);
  done(back, "Als veröffentlicht bestätigt. Der Beitrag ist jetzt unter Performance angelegt – Kennzahlen kannst du dort nachtragen.");
}

export async function deleteDraftAction(fd: FormData) {
  const id = int(fd, "id");
  if (id) repo.deleteDraft(id);
  done("/entwuerfe", "Entwurf gelöscht.");
}

/* ================= LinkedIn-Engagement ================= */

export async function createEngagementAction(fd: FormData) {
  const source_text = str(fd, "source_text", 20000);
  const my_notes = str(fd, "my_notes", 10000);
  const source_url = str(fd, "source_url", 2000);
  if (!source_text && !my_notes) fail("/engagement", "Bitte den Beitrag oder deine Notizen dazu einfügen.");
  if (!urlOrEmpty.safeParse(source_url).success) fail("/engagement", "Der Link muss mit https:// beginnen.");
  const accountId = int(fd, "account_id");
  const id = repo.createEngagement({
    account_id: accountId && repo.getAccount(accountId) ? accountId : null,
    source_url,
    source_text,
    my_notes,
    comment: str(fd, "comment", 5000),
    status: "entwurf",
    source: "manuell",
  });
  done(`/engagement/${id}`, "Engagement-Entwurf angelegt.");
}

export async function saveEngagementAction(fd: FormData) {
  const id = int(fd, "id");
  const e = id ? repo.getEngagement(id) : undefined;
  if (!e) fail("/engagement", "Eintrag nicht gefunden.");
  const back = `/engagement/${e.id}`;
  const source_url = str(fd, "source_url", 2000);
  if (!urlOrEmpty.safeParse(source_url).success) fail(back, "Der Link muss mit https:// beginnen.");
  const statusRaw = str(fd, "status", 20);
  const accountId = int(fd, "account_id");
  repo.updateEngagement(e.id, {
    account_id: accountId && repo.getAccount(accountId) ? accountId : null,
    source_url,
    source_text: str(fd, "source_text", 20000),
    my_notes: str(fd, "my_notes", 10000),
    comment: str(fd, "comment", 5000),
    status: statusRaw === "verwendet" ? "verwendet" : "entwurf",
  });
  done(back, "Gespeichert.");
}

export async function generateEngagementAction(fd: FormData) {
  const id = int(fd, "id");
  const e = id ? repo.getEngagement(id) : undefined;
  if (!e) fail("/engagement", "Eintrag nicht gefunden.");
  const back = `/engagement/${e.id}`;
  if (!aiConfigured()) fail(back, "KI ist nicht eingerichtet – nutze den kopierbaren Prompt.");
  if (!e.source_text && !e.my_notes) fail(back, "Bitte zuerst Beitrag oder Notizen speichern.");
  let result;
  try {
    result = await runEngagement(e, e.account_id ? repo.getAccount(e.account_id) : undefined);
  } catch (err) {
    fail(back, err instanceof AiError ? err.message : "KI-Aufruf fehlgeschlagen.");
  }
  const o = result.output;
  const extra = [
    o.focus_point ? `Bezug: ${o.focus_point}` : "",
    o.missing_info.length ? `Fehlt noch: ${o.missing_info.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  repo.updateEngagement(e.id, {
    comment: o.comment,
    source: "ki",
    my_notes: e.my_notes + (extra ? `${e.my_notes ? "\n\n" : ""}— KI-Hinweise (${result.model}) —\n${extra}` : ""),
  });
  done(back, "Kommentarentwurf erzeugt – bitte prüfen und anpassen. Nichts wurde veröffentlicht.");
}

export async function deleteEngagementAction(fd: FormData) {
  const id = int(fd, "id");
  if (id) repo.deleteEngagement(id);
  done("/engagement", "Eintrag gelöscht.");
}

/* ================= Performance ================= */

export async function savePostAction(fd: FormData) {
  const id = int(fd, "id");
  const back = safeBack(fd, "/performance");
  const accountId = int(fd, "account_id");
  if (!accountId || !repo.getAccount(accountId)) fail(back, "Bitte einen Account wählen.");
  const rawUrl = str(fd, "url", 2000);
  const url = normalizeUrl(rawUrl);
  if (rawUrl && !url) fail(back, "Der Link muss eine gültige https://-Adresse sein.");
  const whenRaw = str(fd, "published_at", 30);
  const published_at = whenRaw ? localInputToUtc(whenRaw) ?? parseFlexibleDate(whenRaw) : null;
  if (whenRaw && !published_at) fail(back, "Veröffentlichungszeitpunkt ist ungültig.");
  if (!url && !published_at) fail(back, "Bitte Link oder Veröffentlichungszeitpunkt angeben, damit der Beitrag eindeutig ist.");
  const m = metricsFromForm(fd);
  if (!m.ok) fail(back, `${METRIC_LABELS[m.field]} muss eine nicht-negative Zahl sein (oder leer = unbekannt).`);
  const format = str(fd, "format", 60);
  const topic = str(fd, "topic", 200);
  if (id) {
    const existing = repo.getPost(id);
    if (!existing) fail(back, "Beitrag nicht gefunden.");
    repo.updatePost(id, { published_at, format, topic, url, ...m.values });
    done(back, "Kennzahlen gespeichert.");
  }
  const key = dedupKey({ account_id: accountId, url, published_at, format, topic });
  const r = repo.upsertPost({ account_id: accountId, published_at, format, topic, url, dedup_key: key, metrics: m.values }, "manuell");
  done(
    back,
    r.outcome === "neu" ? "Beitrag erfasst." : r.outcome === "aktualisiert" ? "Beitrag existierte bereits – Kennzahlen ergänzt." : "Beitrag existierte bereits – keine neuen Werte.",
  );
}

export async function deletePostAction(fd: FormData) {
  const id = int(fd, "id");
  if (id) repo.deletePost(id);
  done(safeBack(fd, "/performance"), "Beitrag gelöscht.");
}

export type ImportReport = {
  neu: number;
  aktualisiert: number;
  unveraendert: number;
  errors: { row: number; message: string }[];
  unknownColumns: string[];
  at: string;
};

export async function importCsvAction(fd: FormData) {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) fail("/performance/import", "Bitte eine CSV-Datei auswählen.");
  if (file.size > MAX_CSV_BYTES) fail("/performance/import", "Datei ist größer als 2 MB.");
  if (!/\.(csv|txt)$/i.test(file.name)) fail("/performance/import", "Bitte eine .csv-Datei hochladen.");
  const text = await file.text();
  const accounts = repo.listAccounts(true);
  const { posts, errors, unknownColumns } = parsePerformanceCsv(text, accounts);
  const report: ImportReport = { neu: 0, aktualisiert: 0, unveraendert: 0, errors, unknownColumns, at: new Date().toISOString() };
  for (const p of posts) {
    const r = repo.upsertPost(p, "csv");
    report[r.outcome]++;
  }
  repo.setSetting("last_import_report", JSON.stringify({ ...report, errors: report.errors.slice(0, 200), file: file.name.slice(0, 120) }));
  revalidatePath("/", "layout");
  redirect("/performance/import?bericht=1");
}

/* ================= Content-Radar ================= */

function relationOf(v: string) {
  return v in RELATIONS ? v : "inspiration";
}

export async function saveWatchProfileAction(fd: FormData) {
  const id = int(fd, "id");
  const back = id ? `/radar/profil/${id}` : "/radar";
  const platform = str(fd, "platform", 40);
  const handle = str(fd, "handle", 120);
  const display_name = str(fd, "display_name", 120);
  const url = str(fd, "url", 2000);
  if (!PLATFORMS[platform]) fail(back, "Bitte eine Plattform wählen.");
  if (!handle && !display_name) fail(back, "Bitte Handle oder Namen angeben.");
  if (!urlOrEmpty.safeParse(url).success) fail(back, "Der Profil-Link muss mit https:// beginnen.");
  const accountId = int(fd, "account_id");
  const newId = repo.saveWatchProfile(id, {
    platform,
    handle,
    display_name,
    url,
    relation: relationOf(str(fd, "relation", 30)),
    account_id: accountId && repo.getAccount(accountId) ? accountId : null,
    why: str(fd, "why", 2000),
    notes: str(fd, "notes", 4000),
  });
  done(`/radar/profil/${newId}`, id ? "Profil gespeichert." : "Profil wird jetzt beobachtet.");
}

export async function archiveWatchProfileAction(fd: FormData) {
  const id = int(fd, "id");
  if (!id) fail("/radar", "Ungültiges Profil.");
  const archived = str(fd, "archived") === "1";
  repo.setWatchProfileArchived(id, archived);
  done(archived ? "/radar" : `/radar/profil/${id}`, archived ? "Profil wird nicht mehr beobachtet (archiviert)." : "Profil wieder aktiv.");
}

export async function markProfileCheckedAction(fd: FormData) {
  const id = int(fd, "id");
  if (!id || !repo.getWatchProfile(id)) fail("/radar", "Profil nicht gefunden.");
  repo.markWatchProfileChecked(id);
  done(safeBack(fd, `/radar/profil/${id}`), "Als angesehen markiert.");
}

export async function saveRadarPostAction(fd: FormData) {
  const id = int(fd, "id");
  const back = safeBack(fd, id ? `/radar/beitrag/${id}` : "/radar");
  const profileId = int(fd, "profile_id");
  const profile = profileId ? repo.getWatchProfile(profileId) : undefined;
  if (profileId && !profile) fail(back, "Unbekanntes Profil.");
  const rawUrl = str(fd, "url", 2000);
  const urlKey = rawUrl ? normalizeUrl(rawUrl) : "";
  if (rawUrl && !urlKey) fail(back, "Der Link muss eine gültige https://-Adresse sein.");
  if (urlKey) {
    const existing = repo.findRadarPostByUrlKey(urlKey);
    if (existing && existing.id !== id) fail(`/radar/beitrag/${existing.id}`, "Dieser Beitrag ist bereits im Radar erfasst – hier kannst du ihn ergänzen.");
  }
  const title = str(fd, "title", 200);
  const observation = str(fd, "observation", 10000);
  const hook = str(fd, "hook", 1000);
  const content_excerpt = str(fd, "content_excerpt", 8000);
  if (!rawUrl && !title && !observation && !hook && !content_excerpt) fail(back, "Bitte mindestens Link, Titel, Einstieg oder Beobachtung angeben.");
  const postedRaw = str(fd, "posted_on", 10);
  const capturedRaw = str(fd, "captured_on", 10);
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (postedRaw && !isDate(postedRaw)) fail(back, "Veröffentlichungsdatum ist ungültig.");
  const metrics: Record<"views" | "likes" | "comments" | "shares", number | null> = { views: null, likes: null, comments: null, shares: null };
  for (const f of ["views", "likes", "comments", "shares"] as const) {
    const r = parseMetric(str(fd, f, 30));
    if (!r.ok) fail(back, `${METRIC_LABELS[f]} muss eine nicht-negative Zahl sein (oder leer = unbekannt).`);
    metrics[f] = r.value;
  }
  const platform = profile?.platform ?? str(fd, "platform", 40);
  const newId = repo.saveRadarPost(id, {
    profile_id: profile?.id ?? null,
    platform: PLATFORMS[platform] ? platform : "",
    url: urlKey ? rawUrl : "",
    url_key: urlKey || null,
    title,
    posted_on: postedRaw || null,
    captured_on: isDate(capturedRaw) ? capturedRaw : nowIsoDate(),
    source: str(fd, "source", 200),
    format: str(fd, "format", 60),
    topic: str(fd, "topic", 200),
    hook,
    content_excerpt,
    observation,
    tags: splitTags(str(fd, "tags", 500)).join(","),
    ...metrics,
  });
  if (profile) repo.markWatchProfileChecked(profile.id);
  done(`/radar/beitrag/${newId}`, id ? "Beitrag gespeichert." : "Beitrag im Radar erfasst.");
}

export async function archiveRadarPostAction(fd: FormData) {
  const id = int(fd, "id");
  if (id) repo.setRadarPostArchived(id, str(fd, "archived") === "1");
  done(safeBack(fd, "/radar"), str(fd, "archived") === "1" ? "Beitrag archiviert." : "Beitrag wieder aktiv.");
}

export async function deleteRadarPostAction(fd: FormData) {
  const id = int(fd, "id");
  if (id) repo.deleteRadarPost(id);
  done("/radar?ansicht=archiv", "Beitrag gelöscht.");
}

export async function ideaFromRadarPostAction(fd: FormData) {
  const id = int(fd, "id");
  const r = id ? repo.getRadarPost(id) : undefined;
  if (!r) fail("/radar", "Beitrag nicht gefunden.");
  const profile = r.profile_id ? repo.getWatchProfile(r.profile_id) : undefined;
  const ideaId = repo.createIdea({
    body: r.observation || r.hook || r.title || r.url,
    title: r.title ? `Radar: ${r.title}` : "",
    tags: r.tags,
    notes: [
      `Aus dem Content-Radar (externe Beobachtung vom ${r.captured_on}).`,
      profile ? `Profil: ${profile.display_name || profile.handle}` : "",
      r.source ? `Quelle: ${r.source}` : "",
      r.url,
      "Eigene Erfahrung ergänzen – nicht übernehmen, was nicht zu mir passt.",
    ].filter(Boolean).join("\n"),
    account_ids: profile?.account_id ? [profile.account_id] : [],
  });
  done(`/ideen/${ideaId}`, "Idee aus dem Radar angelegt.");
}

export async function analyzeRadarPostAction(fd: FormData) {
  const id = int(fd, "id");
  const r = id ? repo.getRadarPost(id) : undefined;
  if (!r) fail("/radar", "Beitrag nicht gefunden.");
  const back = `/radar/beitrag/${r.id}`;
  if (!aiConfigured()) fail(back, "KI ist nicht eingerichtet – nutze den kopierbaren Prompt.");
  if (!r.hook && !r.content_excerpt && !r.observation) fail(back, "Für eine Analyse bitte Einstieg, Textauszug oder Beobachtung erfassen.");
  let result;
  try {
    result = await runRadarAnalysis(r, repo.listAccounts());
  } catch (err) {
    fail(back, err instanceof AiError ? err.message : "KI-Aufruf fehlgeschlagen.");
  }
  repo.setRadarAnalysis(r.id, { ...result.output, model: result.model, at: new Date().toISOString() });
  done(back, "Analyse gespeichert – bitte kritisch prüfen.");
}

/* ================= Verbindungen ================= */

export async function startConnectionAction(fd: FormData) {
  const accountId = int(fd, "account_id");
  const account = accountId ? repo.getAccount(accountId) : undefined;
  if (!account) fail("/verbindungen", "Account nicht gefunden.");
  const p = providerForPlatform(account.platform);
  if (!p) fail("/verbindungen", "Für diese Plattform gibt es keine Anbindung.");
  const setup = providerSetup(p);
  if (!setup.configured) fail("/verbindungen", `${PROVIDERS[p].label} ist noch nicht eingerichtet: ${setup.missing.join(", ")} fehlt in .env.local.`);
  // Cookie und Rückleitung müssen zur selben Adresse gehören.
  const host = (await headers()).get("host") ?? "";
  const expected = new URL(setup.redirectBase).host;
  if (host !== expected) {
    fail("/verbindungen", `Bitte öffne den Social Media Manager unter ${setup.redirectBase}/verbindungen und starte dort – die Rückleitung von ${PROVIDERS[p].label} führt an diese Adresse.`);
  }
  const state = createState(p, account.id, setup.redirectUri);
  (await cookies()).set(`ck_oauth_${p}`, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: setup.redirectBase.startsWith("https://"),
    path: "/api/oauth",
    maxAge: 600,
  });
  redirect(buildAuthorizeUrl(PROVIDERS[p], { clientId: setup.clientId, redirectUri: setup.redirectUri, state, scopes: setup.scopes }));
}

export async function confirmConnectionAction(fd: FormData) {
  const id = str(fd, "pending_id", 100);
  let accountId: number;
  try {
    accountId = confirmPending(id);
  } catch (err) {
    fail("/verbindungen", err instanceof ConnectionError ? err.message : "Speichern fehlgeschlagen.");
  }
  done(`/verbindungen#account-${accountId}`, "Verbindung gespeichert.");
}

export async function discardConnectionAction(fd: FormData) {
  discardPending(str(fd, "pending_id", 100));
  done("/verbindungen", "Verworfen – es wurde nichts gespeichert.");
}

export async function syncConnectionAction(fd: FormData) {
  const accountId = int(fd, "account_id");
  if (!accountId) fail("/verbindungen", "Ungültiger Account.");
  let note = "";
  try {
    note = (await syncConnection(accountId)).note;
  } catch (err) {
    fail(`/verbindungen#account-${accountId}`, err instanceof ConnectionError ? err.message : "Synchronisierung fehlgeschlagen.");
  }
  done(`/verbindungen#account-${accountId}`, note);
}

export async function disconnectAction(fd: FormData) {
  const accountId = int(fd, "account_id");
  if (!accountId) fail("/verbindungen", "Ungültiger Account.");
  const r = await disconnect(accountId);
  done(`/verbindungen#account-${accountId}`, `Verbindung getrennt.${r.revokedRemote ? " Der Zugriff wurde auch bei der Plattform widerrufen." : ""} ${r.hint}`.trim());
}

/* ================= Einstellungen ================= */

export async function saveSettingsAction(fd: FormData) {
  const model = str(fd, "ai_model", 100);
  if (model && !/^[a-z0-9][a-z0-9.\-_:]*$/i.test(model)) fail("/einstellungen", "Ungültiger Modellname.");
  repo.setSetting("ai_model", model || null);
  done("/einstellungen", model ? `Modell gesetzt: ${model}` : "Modell zurückgesetzt (Standard/Umgebung).");
}
