// „Was sollte ich als Nächstes posten?“ – regelbasierte, nachvollziehbare Empfehlung.
// Jede Begründung trägt ihre Quelle; Datenlücken und Unsicherheiten werden ausdrücklich genannt.
// Keine KI, keine erfundenen Zahlen: nur der vorhandene Planungs- und Datenstand.

export type SourceTag = "Redaktionsplan" | "Deine Zuordnung" | "KI-Coach" | "Eigene Daten" | "Steckbrief" | "Content-Radar (extern)";

export type Reason = { text: string; source: SourceTag };

export type PlannerAccount = { id: number; label: string; gaps: string[] };

export type PlannerDraft = {
  id: number;
  account_id: number | null;
  title: string;
  body: string;
  format: string;
  status: "idee" | "entwurf" | "bereit" | "freigegeben" | "geplant" | "veroeffentlicht";
  scheduled_at: string | null;
  approval_valid: boolean;
  idea_id: number | null;
};

export type PlannerIdea = {
  id: number;
  title: string;
  body: string;
  account_ids: number[];
  coach: { account_id: number; provisional: boolean; questions: string[]; created_at: string } | null;
  has_draft: boolean;
};

export type PlannerInput = {
  now: string;
  accounts: PlannerAccount[];
  drafts: PlannerDraft[];
  ideas: PlannerIdea[];
  /** Letzter erfasster veröffentlichter Beitrag je Account (ISO) – fehlt, wenn unbekannt. */
  lastPublished: Record<number, string | undefined>;
  /** Anzahl erfasster Beiträge mit Kennzahlen je Account. */
  postsWithMetrics: Record<number, number>;
};

export type Recommendation = {
  key: string;
  kind: "draft" | "idea";
  id: number;
  account_id: number | null;
  title: string;
  stage: string;
  score: number;
  reasons: Reason[];
  missing: string[];
  uncertainty: string[];
  action: { label: string; href: string };
};

export const PLACEHOLDER_RE = /\[[A-ZÄÖÜ][A-ZÄÖÜ ]{3,}[^\]]*\]/;

function daysBetween(a: string, b: string) {
  return Math.floor((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function shortTitle(t: string, body: string) {
  return (t || body.split("\n")[0] || "Ohne Titel").slice(0, 90);
}

function accountFacts(input: PlannerInput, accountId: number | null, reasons: Reason[], missing: string[], uncertainty: string[]) {
  if (!accountId) {
    missing.push("Account auswählen");
    return 0;
  }
  const acc = input.accounts.find((a) => a.id === accountId);
  if (acc?.gaps.length) missing.push(`Steckbrief ergänzen: ${acc.gaps.join(", ")}`);
  let bonus = 0;
  const last = input.lastPublished[accountId];
  if (last) {
    const d = daysBetween(last, input.now);
    if (d >= 7) {
      reasons.push({ text: `Letzter erfasster Beitrag auf diesem Account vor ${d} Tagen`, source: "Eigene Daten" });
      bonus += Math.min(d, 30) / 2;
    }
  } else {
    uncertainty.push("Für diesen Account ist noch kein veröffentlichter Beitrag erfasst – Rhythmus unbekannt.");
    bonus += 3;
  }
  const withMetrics = input.postsWithMetrics[accountId] ?? 0;
  if (withMetrics < 5) {
    const basis = withMetrics === 0 ? "Noch keine Beiträge mit Kennzahlen" : `Erst ${withMetrics} Beitr${withMetrics === 1 ? "ag" : "äge"} mit Kennzahlen`;
    uncertainty.push(`${basis} – die Empfehlung beruht auf dem Planungsstand, nicht auf Leistungsdaten.`);
  }
  return bonus;
}

export function recommendNext(input: PlannerInput, limit = 3): Recommendation[] {
  const recs: Recommendation[] = [];
  const nowMs = Date.parse(input.now);

  for (const d of input.drafts) {
    if (d.status === "veroeffentlicht") continue;
    const reasons: Reason[] = [];
    const missing: string[] = [];
    const uncertainty: string[] = [];
    let score = 0;
    let stage = "";
    let actionLabel = "Entwurf öffnen";
    if (d.status === "geplant" && d.scheduled_at) {
      const days = (Date.parse(d.scheduled_at) - nowMs) / 86_400_000;
      if (days > 7) continue; // weiter weg: steht im Plan, keine „nächste“ Empfehlung
      score = days < 0 ? 110 : 100;
      stage = days < 0 ? "Überfällig" : "Geplant";
      reasons.push({ text: days < 0 ? "Termin ist überschritten – war geplant und freigegeben" : "Ist freigegeben und für die nächsten Tage eingeplant", source: "Redaktionsplan" });
      if (!d.approval_valid) missing.push("Erneut freigeben (Inhalt wurde nach der Freigabe geändert)");
      actionLabel = days < 0 ? "Veröffentlichung bestätigen oder neu planen" : "Entwurf ansehen";
    } else if (d.status === "freigegeben") {
      score = 80;
      stage = "Freigegeben";
      reasons.push({ text: "Ist bereits freigegeben", source: "Redaktionsplan" });
      if (!d.scheduled_at) missing.push("Termin festlegen");
    } else if (d.status === "bereit") {
      score = 70;
      stage = "Wartet auf Freigabe";
      reasons.push({ text: "Ist fertig formuliert und wartet auf deine Freigabe", source: "Redaktionsplan" });
      missing.push("Freigeben");
      if (!d.scheduled_at) missing.push("Termin festlegen");
    } else {
      score = d.status === "entwurf" ? 50 : 35;
      stage = d.status === "entwurf" ? "Entwurf" : "Idee im Plan";
      reasons.push({ text: "Steht bereits als Entwurf im Plan", source: "Redaktionsplan" });
      missing.push("Text fertigstellen und freigeben");
    }
    if (!d.body.trim()) missing.push("Text schreiben");
    else if (PLACEHOLDER_RE.test(d.body)) missing.push("Platzhalter [IN ECKIGEN KLAMMERN] durch eigene Angaben ersetzen");
    score += accountFacts(input, d.account_id, reasons, missing, uncertainty);
    score -= missing.length * 3;
    recs.push({
      key: `d${d.id}`,
      kind: "draft",
      id: d.id,
      account_id: d.account_id,
      title: shortTitle(d.title, d.body),
      stage,
      score,
      reasons,
      missing,
      uncertainty,
      action: { label: actionLabel, href: `/entwuerfe/${d.id}` },
    });
  }

  for (const i of input.ideas) {
    if (i.has_draft) continue;
    const reasons: Reason[] = [];
    const missing: string[] = [];
    const uncertainty: string[] = [];
    let accountId: number | null = null;
    let score = 10;
    if (i.coach) {
      accountId = i.coach.account_id;
      score = 40;
      reasons.push({
        text: `Der Coach hat diesen Account empfohlen${i.coach.provisional ? " (vorläufig)" : ""}`,
        source: "KI-Coach",
      });
      if (i.coach.provisional) uncertainty.push("Die Coach-Empfehlung ist vorläufig, weil die Positionierung noch offen ist.");
      if (i.coach.questions.length) missing.push(`Persönliche Angaben ergänzen: ${i.coach.questions.slice(0, 2).join(" · ")}${i.coach.questions.length > 2 ? " …" : ""}`);
      if (i.account_ids.includes(accountId)) reasons.push({ text: "Du hast die Idee selbst mit diesem Account verknüpft", source: "Deine Zuordnung" });
    } else if (i.account_ids.length) {
      accountId = i.account_ids[0];
      score = 30;
      reasons.push({
        text: i.account_ids.length > 1 ? `Du hast die Idee mit ${i.account_ids.length} Accounts verknüpft – hier der erste` : "Du hast die Idee mit diesem Account verknüpft",
        source: "Deine Zuordnung",
      });
      missing.push("Blickwinkel und Einstieg mit dem Coach klären");
      if (i.account_ids.length > 1) uncertainty.push("Welcher der verknüpften Accounts am besten passt, ist noch offen.");
    } else {
      missing.push("Passenden Account finden (Coach oder Zuordnung)");
      uncertainty.push("Noch keinem Account zugeordnet.");
    }
    missing.push("Entwurf schreiben");
    score += accountId ? accountFacts(input, accountId, reasons, missing, uncertainty) : 0;
    score -= missing.length * 3;
    recs.push({
      key: `i${i.id}`,
      kind: "idea",
      id: i.id,
      account_id: accountId,
      title: shortTitle(i.title, i.body),
      stage: "Idee",
      score,
      reasons,
      missing,
      uncertainty,
      action: { label: i.coach ? "Idee ausarbeiten" : "Im Coach öffnen", href: `/ideen/${i.id}#coach` },
    });
  }

  return recs.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)).slice(0, limit);
}

/* ---------- Aufgaben ---------- */

export type Task = { priority: number; text: string; href: string; source: SourceTag | "System" };

export type TaskInput = {
  now: string;
  drafts: PlannerDraft[];
  accounts: PlannerAccount[];
  postsMissingMetrics: { id: number; title: string; published_at: string | null }[];
  staleProfiles: { id: number; label: string; last_checked_at: string | null }[];
  unassignedOldIdeas: number;
};

export function buildTasks(t: TaskInput): Task[] {
  const tasks: Task[] = [];
  const now = Date.parse(t.now);
  for (const d of t.drafts) {
    const title = shortTitle(d.title, d.body);
    if (d.status === "geplant" && d.scheduled_at && Date.parse(d.scheduled_at) < now) {
      tasks.push({ priority: 1, text: `„${title}“ war geplant – veröffentlicht? Mit Link bestätigen oder neu planen`, href: `/entwuerfe/${d.id}`, source: "Redaktionsplan" });
    } else if (d.status === "bereit") {
      tasks.push({ priority: 2, text: `„${title}“ freigeben`, href: `/entwuerfe/${d.id}`, source: "Redaktionsplan" });
    } else if (d.status === "freigegeben" && !d.scheduled_at) {
      tasks.push({ priority: 3, text: `Termin für „${title}“ festlegen`, href: `/entwuerfe/${d.id}`, source: "Redaktionsplan" });
    }
    if (d.status !== "veroeffentlicht" && PLACEHOLDER_RE.test(d.body)) {
      tasks.push({ priority: 4, text: `Platzhalter in „${title}“ ersetzen`, href: `/entwuerfe/${d.id}`, source: "Redaktionsplan" });
    }
  }
  for (const p of t.postsMissingMetrics) {
    tasks.push({ priority: 3, text: `Kennzahlen für „${p.title || "Beitrag"}“ nachtragen`, href: `/performance/${p.id}`, source: "Eigene Daten" });
  }
  for (const a of t.accounts) {
    if (a.gaps.length) tasks.push({ priority: 5, text: `Strategie für ${a.label} ergänzen: ${a.gaps.join(", ")}`, href: `/accounts/${a.id}`, source: "Steckbrief" });
  }
  for (const p of t.staleProfiles) {
    tasks.push({
      priority: 6,
      text: p.last_checked_at ? `Radar: ${p.label} seit über 14 Tagen nicht angesehen` : `Radar: ${p.label} noch nie angesehen`,
      href: `/radar/profil/${p.id}`,
      source: "Content-Radar (extern)",
    });
  }
  if (t.unassignedOldIdeas > 0) {
    tasks.push({ priority: 7, text: `${t.unassignedOldIdeas} Idee${t.unassignedOldIdeas === 1 ? "" : "n"} älter als 14 Tage ohne Account – zuordnen oder archivieren`, href: "/ideen", source: "Deine Zuordnung" });
  }
  return tasks.sort((a, b) => a.priority - b.priority);
}
