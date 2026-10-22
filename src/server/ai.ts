import "server-only";
// Serverseitige Anthropic-Anbindung. Der API-Schlüssel wird ausschließlich hier aus der Umgebung gelesen,
// nie an den Browser gegeben und nie geloggt. Aufrufe erfolgen nur nach einer bewussten Nutzeraktion.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Account } from "@/lib/domain";
import {
  COACH_RULES,
  ENGAGEMENT_RULES,
  RADAR_RULES,
  PACKAGE_RULES,
  packageUserMessage,
  coachUserMessage,
  engagementUserMessage,
  radarUserMessage,
  type DraftKind,
  type IdeaForPrompt,
  type RadarForPrompt,
} from "@/lib/prompts";
import { getSetting } from "./repo";

export const DEFAULT_MODEL = "claude-opus-5";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function currentModel(): string {
  return getSetting("ai_model") || process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export class AiError extends Error {}

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new AiError("Kein API-Schlüssel hinterlegt. KI-Funktionen benötigen einen eigenen Anthropic-API-Schlüssel in .env.local.");
  return new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
}

export const CoachSchema = z.object({
  recommended_account_id: z.number().int(),
  recommendation_provisional: z.boolean(),
  recommendation_reason: z.string(),
  missing_positioning: z.array(z.string()),
  alternative_account_id: z.number().int(),
  alternative_reason: z.string(),
  angles: z.array(z.string()),
  hooks: z.array(z.string()),
  throughline: z.array(z.string()),
  questions_for_me: z.array(z.string()),
  basis: z.array(z.string()),
  uncertainties: z.array(z.string()),
  draft_text: z.string(),
});
export type CoachOutput = z.infer<typeof CoachSchema> & { draft_kind: DraftKind };

export const EngagementSchema = z.object({
  focus_point: z.string(),
  comment: z.string(),
  missing_info: z.array(z.string()),
});
export type EngagementOutput = z.infer<typeof EngagementSchema>;

function translateError(err: unknown): never {
  if (err instanceof AiError) throw err;
  if (err instanceof Anthropic.AuthenticationError) throw new AiError("Der API-Schlüssel wurde abgelehnt. Bitte in .env.local prüfen.");
  if (err instanceof Anthropic.PermissionDeniedError) throw new AiError("Der API-Schlüssel hat keine Berechtigung für dieses Modell.");
  if (err instanceof Anthropic.NotFoundError) throw new AiError("Das eingestellte Modell wurde nicht gefunden. Bitte unter Einstellungen prüfen.");
  if (err instanceof Anthropic.RateLimitError) throw new AiError("Rate-Limit erreicht. Bitte kurz warten und erneut versuchen.");
  if (err instanceof Anthropic.BadRequestError) throw new AiError(`Anfrage abgelehnt: ${err.message.slice(0, 300)}`);
  if (err instanceof Anthropic.APIConnectionError) throw new AiError("Keine Verbindung zur Anthropic API. Internetverbindung prüfen.");
  if (err instanceof Anthropic.APIError) throw new AiError(`API-Fehler (${err.status ?? "?"}). Bitte später erneut versuchen.`);
  throw new AiError("Unerwarteter Fehler beim KI-Aufruf.");
}

export async function runCoach(idea: IdeaForPrompt, accounts: Account[], kind: DraftKind, learning = ""): Promise<{ output: CoachOutput; model: string }> {
  const model = currentModel();
  try {
    const response = await client().messages.parse({
      model,
      max_tokens: 16000,
      system: COACH_RULES,
      messages: [{ role: "user", content: coachUserMessage(idea, accounts, kind, learning) }],
      output_config: { format: zodOutputFormat(CoachSchema), effort: "medium" },
    });
    if (response.stop_reason === "refusal") throw new AiError("Das Modell hat die Anfrage abgelehnt.");
    if (response.stop_reason === "max_tokens") throw new AiError("Antwort wurde abgeschnitten. Bitte erneut versuchen.");
    const parsed = response.parsed_output;
    if (!parsed) throw new AiError("Antwort konnte nicht gelesen werden.");
    const ids = new Set(accounts.map((a) => a.id));
    if (!ids.has(parsed.recommended_account_id)) throw new AiError("Die KI hat einen unbekannten Account empfohlen. Bitte erneut versuchen.");
    if (!ids.has(parsed.alternative_account_id) || parsed.alternative_account_id === parsed.recommended_account_id) {
      parsed.alternative_account_id = 0;
    }
    return { output: { ...parsed, draft_kind: kind }, model };
  } catch (err) {
    translateError(err);
  }
}

export async function runEngagement(e: { source_text: string; my_notes: string }, account: Account | undefined): Promise<{ output: EngagementOutput; model: string }> {
  const model = currentModel();
  try {
    const response = await client().messages.parse({
      model,
      max_tokens: 8000,
      system: ENGAGEMENT_RULES,
      messages: [{ role: "user", content: engagementUserMessage(e, account) }],
      output_config: { format: zodOutputFormat(EngagementSchema), effort: "medium" },
    });
    if (response.stop_reason === "refusal") throw new AiError("Das Modell hat die Anfrage abgelehnt.");
    const parsed = response.parsed_output;
    if (!parsed) throw new AiError("Antwort konnte nicht gelesen werden.");
    return { output: parsed, model };
  } catch (err) {
    translateError(err);
  }
}

export const RadarAnalysisSchema = z.object({
  hook_type: z.string(),
  structure: z.array(z.string()),
  possible_reasons: z.array(z.string()),
  angles: z.array(z.object({ account_id: z.number().int(), angle: z.string() })),
  cautions: z.array(z.string()),
});
export type RadarAnalysis = z.infer<typeof RadarAnalysisSchema>;

export async function runRadarAnalysis(r: RadarForPrompt, accounts: Account[]): Promise<{ output: RadarAnalysis; model: string }> {
  const model = currentModel();
  try {
    const response = await client().messages.parse({
      model,
      max_tokens: 8000,
      system: RADAR_RULES,
      messages: [{ role: "user", content: radarUserMessage(r, accounts) }],
      output_config: { format: zodOutputFormat(RadarAnalysisSchema), effort: "medium" },
    });
    if (response.stop_reason === "refusal") throw new AiError("Das Modell hat die Anfrage abgelehnt.");
    const parsed = response.parsed_output;
    if (!parsed) throw new AiError("Antwort konnte nicht gelesen werden.");
    const ids = new Set(accounts.map((a) => a.id));
    return { output: { ...parsed, angles: parsed.angles.filter((a) => ids.has(a.account_id)) }, model };
  } catch (err) {
    translateError(err);
  }
}

/* ---------- Content-Paket ---------- */

export const PackageSchema = z.object({
  recommended_account_id: z.number().int(),
  recommendation_provisional: z.boolean(),
  recommendation_reason: z.string(),
  alternative_account_id: z.number().int(),
  alternative_reason: z.string(),
  angle: z.string(),
  effect: z.string(),
  hook_spoken: z.string(),
  hook_text_on_screen: z.string(),
  hook_visual: z.string(),
  hook_combination: z.string(),
  throughline: z.array(z.string()),
  script: z.string(),
  shoot_say: z.string(),
  shoot_show: z.string(),
  shoot_broll: z.string(),
  shoot_location: z.string(),
  format: z.string(),
  title: z.string(),
  caption: z.string(),
  questions_for_me: z.array(z.string()),
  examples_needed: z.array(z.string()),
  basis: z.array(z.string()),
  uncertainties: z.array(z.string()),
});
export type PackageOutput = z.infer<typeof PackageSchema>;

export async function runPackage(
  idea: IdeaForPrompt & { original: string },
  accounts: Account[],
  withScript: boolean,
  learning = "",
): Promise<{ output: PackageOutput; model: string }> {
  const model = currentModel();
  try {
    const response = await client().messages.parse({
      model,
      max_tokens: 16000,
      system: PACKAGE_RULES,
      messages: [{ role: "user", content: packageUserMessage(idea, accounts, withScript, learning) }],
      output_config: { format: zodOutputFormat(PackageSchema), effort: "medium" },
    });
    if (response.stop_reason === "refusal") throw new AiError("Das Modell hat die Anfrage abgelehnt.");
    if (response.stop_reason === "max_tokens") throw new AiError("Antwort wurde abgeschnitten. Bitte erneut versuchen.");
    const parsed = response.parsed_output;
    if (!parsed) throw new AiError("Antwort konnte nicht gelesen werden.");
    const ids = new Set(accounts.map((a) => a.id));
    if (!ids.has(parsed.recommended_account_id)) throw new AiError("Die KI hat einen unbekannten Account empfohlen. Bitte erneut versuchen.");
    if (!ids.has(parsed.alternative_account_id) || parsed.alternative_account_id === parsed.recommended_account_id) parsed.alternative_account_id = 0;
    if (!withScript) parsed.script = "";
    return { output: parsed, model };
  } catch (err) {
    translateError(err);
  }
}
