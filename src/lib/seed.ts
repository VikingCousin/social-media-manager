// Beispiel-Accounts für eine frische Installation. Es sind KEINE echten Konten:
// Namen, Handles und Links sind Platzhalter und lassen sich unter „Accounts“ ändern oder archivieren.
// „Noch offen“ markiert bewusst ungeklärte Angaben. Keine erfundenen Zahlen.

export type SeedAccount = {
  platform: string;
  display_name: string;
  handle: string;
  profile_url: string;
  positioning: string;
  audience: string;
  topics: string;
  tone: string;
  formats: string;
  goals: string;
  boundaries: string;
  notes: string;
  snapshot: string;
};

const OFFEN = "Noch offen";
const HINWEIS = "Beispiel-Account – bitte durch deine eigenen Angaben ersetzen.";

export const SEED_ACCOUNTS: SeedAccount[] = [
  {
    platform: "linkedin",
    display_name: "Beispiel LinkedIn",
    handle: "beispiel-profil",
    profile_url: "https://www.linkedin.com/in/beispiel-profil/",
    positioning: HINWEIS,
    audience: OFFEN,
    topics: OFFEN,
    tone: OFFEN,
    formats: OFFEN,
    goals: OFFEN,
    boundaries: "Keine unterstellten Projektergebnisse, Zuständigkeiten, Kundenfälle oder Erfolge, die ich nicht selbst beschrieben habe.",
    notes: "",
    snapshot: "",
  },
  {
    platform: "instagram",
    display_name: "beispiel_insta",
    handle: "@beispiel_insta",
    profile_url: "https://www.instagram.com/beispiel_insta/",
    positioning: HINWEIS,
    audience: OFFEN,
    topics: OFFEN,
    tone: OFFEN,
    formats: OFFEN,
    goals: OFFEN,
    boundaries: OFFEN,
    notes: "",
    snapshot: "",
  },
  {
    platform: "tiktok",
    display_name: "Beispielkanal A",
    handle: "@beispiel_a",
    profile_url: "https://www.tiktok.com/@beispiel_a",
    positioning: HINWEIS,
    audience: OFFEN,
    topics: OFFEN,
    tone: OFFEN,
    formats: OFFEN,
    goals: OFFEN,
    boundaries: OFFEN,
    notes: "",
    snapshot: "",
  },
  {
    platform: "tiktok",
    display_name: "Beispielkanal B",
    handle: "@beispiel_b",
    profile_url: "https://www.tiktok.com/@beispiel_b",
    positioning: HINWEIS,
    audience: OFFEN,
    topics: OFFEN,
    tone: OFFEN,
    formats: OFFEN,
    goals: OFFEN,
    boundaries: OFFEN,
    notes: "",
    snapshot: "",
  },
];
