# Social Media Manager – Hinweise für Claude

Persönlicher Assistent für eigene LinkedIn-, Instagram- und TikTok-Accounts. Lokale Einzelbenutzer-Web-App (Deutsch, Europe/Berlin), ohne eigene Anmeldung – nur für `127.0.0.1` gedacht. Paketname `content-kompass`, Datenbank `data/contentkompass.db` (früherer Projektname). Es wird nichts extern veröffentlicht.

## Befehle

```bash
npm run dev        # Entwicklungsserver auf http://localhost:3210
npm run build      # Produktions-Build (muss fehlerfrei durchlaufen)
npm start          # Produktionsserver auf Port 3210
npm test           # Unit-Tests: node --test mit --experimental-strip-types (tests/*.test.ts)
npm run typecheck  # tsc --noEmit
npm run backup     # konsistente SQLite-Kopie nach backups/
npm run restore -- <datei.db>   # App vorher beenden
```

## Architektur

- **Next.js 16 (App Router) + React 19 + TypeScript.** Seiten sind Server Components. Mutationen laufen über Server Actions in `src/app/actions.ts` und enden mit einem `redirect` mit `?ok=` bzw. `?fehler=`, den `src/components/Flash.tsx` anzeigt.
- **SQLite über better-sqlite3** (synchron, natives Modul, in `next.config.ts` als `serverExternalPackages` eingetragen). Schema-Migrationen stehen als Liste in `src/lib/db.ts` und werden über `PRAGMA user_version` versioniert. **Neue Migrationen nur anhängen, bestehende nie ändern.** Der Seed von vier Beispiel-Accounts (`src/lib/seed.ts`, Platzhalter) läuft einmalig (`settings.seeded_accounts`).
- **Datenzugriff** nur über `src/server/repo.ts` (server-only).
- **KI** nur in `src/server/ai.ts` (server-only): `@anthropic-ai/sdk`, `messages.parse` mit Zod-Structured-Output. Das Modell kommt aus `settings.ai_model`, sonst `ANTHROPIC_MODEL`, sonst `claude-opus-5`. Der Schlüssel wird nur aus `ANTHROPIC_API_KEY` gelesen und nie geloggt. Es gibt keine automatischen Aufrufe, nur nach einem Button-Klick.
- **Reine, testbare Logik** in `src/lib/` (keine DB-Imports, relative Importe mit `.ts`-Endung für node --test):
  - `csv.ts`: CSV-Parsing, Zahlen („unbekannt“ = `null`, nie 0), URL-Normalisierung, Dedup-Schlüssel, Merge-Regel.
  - `time.ts`: Berlin ↔ UTC. Die DB speichert ISO-UTC, `datetime-local` ist Berliner Zeit.
  - `analytics.ts`: Auswertung je Account (Median, Abdeckung, vorsichtige Hinweise ab 5 Beiträgen).
  - `prompts.ts`: Coach- und Engagement-Prompts. Nutzerinhalte stehen in `fence()`-Tags und gelten als Daten.
  - `domain.ts`: Status, Plattformen, `approvalHash()` (Freigabe bindet Account, Format, Titel, Text und Termin).
  - `planner.ts`: „Als Nächstes posten“ (`recommendNext`) und Aufgaben (`buildTasks`) – regelbasiert, jede Begründung mit Quelle.
  - `radar.ts`: Content-Radar – Einstiegs-Grobeinordnung (`classifyHook`), Profil-Mediane, Ausreißer (≥ 2× Median ab 3 Werten).
  - `experiments.ts`: Experiment-Vorschläge je Account (Datenlücke / eigene Daten / Radar extern, mit Belastbarkeit).
  - `learning.ts`: Überarbeitungs-Kennwerte (Ausgangs- vs. Endfassung).
- **Kontext** in `src/server/context.ts`: Lernbasis für Prompts (`learningContextText`), Übersichtsdaten (`overviewData`), tatsächlicher Status von Verbindungen und Automatisierungen (`automationStatus`).
- **Content-Radar**: Tabellen `watch_profiles` und `radar_posts` (Migration 2, übernimmt alte `inspirations`; `/inspiration` leitet nach `/radar` weiter). Dedup über normalisierten Link (`url_key`). Externe Daten nie mit `posts` (eigene Daten) vermischen.
- **Lernbasis**: `drafts.original_body` (Ausgangsfassung bei KI/extern), `coach_results.feedback`/`feedback_note`.
- **Gedanke → drehfertiger Beitrag** (Migration 4):
  - **Erfassen:** `QuickCapture` mit `captureIdeaAction`, die ein Ergebnisobjekt statt eines Redirects liefert. Der ruhige Modus liegt unter `/neu?modus=ruhig`. `ideas.original_text` wird nie überschrieben. Der localStorage-Zwischenstand ist kein Offline-Speicher.
  - **Ausarbeiten:** `runPackage` (API) oder der kopierbare Prompt mit 19 `##`-Überschriften. Die eingefügte Antwort wird über `parsePackageMarkdown` eingelesen.
  - **Paket:** Ergebnis ist ein Entwurf mit `drafts.package_json` (`src/lib/package.ts`). Skript und Titel stehen in `body` und `title`, das Paket gehört zur Freigabe.
  - **Meine Sprache** (`/sprache`):
    - Tabellen `voice_traits` und `voice_feedback`.
    - `deriveStyleTraits` in `src/lib/voice.ts` liefert nur Merkmale mit Beleg; sie bleiben Vorschlag, bis die Person sie bestätigt.
    - `voiceContextText` macht daraus Prompt-Kontext. Das ist Kontextanpassung, kein Modelltraining.
  - **Regeln:** Drehvorschläge nie während der Fahrt (`drivingRisk`). Fehlen eigene Erfahrungen, gibt es Platzhalter und Fragen statt erfundener Details.

- **Mobil/PWA:** Unterhalb von 760 px ersetzen die obere Leiste (`.topbar`) und die Tab-Leiste (`src/components/MobileNav.tsx`) die Sidebar. `/neu` ist die Schnellerfassung. `src/app/manifest.ts`, `icon.tsx`, `apple-icon.tsx` und `app-icon/[variant]` erzeugen Manifest und Symbole (`src/lib/app-icon.tsx`). Es gibt bewusst **keinen Service Worker und keine Offline-Funktion**; `ConnectionStatus` zeigt nur an, wenn das Gerät offline ist.
- **Netz & Zugang:** `npm run dev`/`npm start` binden an `127.0.0.1`. Optional aktiviert `src/proxy.ts` (Next 16 „Proxy“, ehemals Middleware) mit `CK_ALLOWED_TAILSCALE_LOGINS` eine Prüfung des Headers `Tailscale-User-Login` (Logik: `src/lib/access.ts`). `CK_ALLOWED_ORIGINS` erlaubt Server Actions hinter einem Proxy. Hintergrund: `docs/IPHONE-ZUGRIFF.md`.

- **Design:** Neutrale Standardwerte. Einzige Token-Quelle ist `design/tokens.json` (W3C-Format, Rollennamen). `npm run tokens` erzeugt daraus `src/app/tokens.css`, das nie von Hand bearbeitet wird. `src/lib/design-tokens.ts` liefert die Werte für App-Symbol, Manifest und Theme-Farbe. Es ist keine Marke hinterlegt (`design/BRAND-STATUS.md`).

- **Verbindungen:** `src/lib/platforms.ts` (Fähigkeiten, Autorisierungs-URL, Profilabgleich, Status, LinkedIn-Vorbereitung; rein und getestet). `src/server/connections.ts` (State, Token-Tausch, Profil, Erneuerung, Sync, Trennen). `src/lib/token-box.ts` (AES-256-GCM). `src/server/secrets.ts` (Schlüssel). Callback: `src/app/api/oauth/[provider]/callback`. Seiten: `/verbindungen`, `/verbindungen/bestaetigen/[id]`. Details: `docs/VERBINDUNGEN.md`.

## Wichtige Regeln

- Keine erfundenen Zahlen, Erfahrungen oder Scheinanalysen, weder in der UI noch in Prompts. Unbekannte Kennzahlen bleiben `NULL`.
- Keine vorgetäuschten Plattform-Anbindungen. `accounts.api_status` wird nur durch eine bestätigte Verbindung auf `verbunden` gesetzt. Tokens nie loggen, nie an den Client geben, nur verschlüsselt speichern. Nichts automatisch veröffentlichen; LinkedIn-Senden ist bewusst nicht implementiert.
- Freigabe-Logik: Jede Änderung an Inhalt, Account, Format oder Termin hebt die Freigabe auf. „Geplant“ erfordert eine gültige Freigabe und einen Termin.
- CSV-Import und Veröffentlichungs-Bestätigung laufen über `repo.upsertPost` (Dedup über `posts.dedup_key`).
- Jeder sichtbare Button braucht eine echte Funktion. Keine Demo-Daten.
- Eigene Daten und Content-Radar (extern) immer getrennt halten und in UI und Prompts kennzeichnen. Kein Scraping fremder Profile; Radar-Erfassung ist manuell, bis eine offizielle API genutzt wird.
- Empfehlungen nennen Quelle, Datenlücken und Unsicherheit. Nur Migrationen anhängen, keine bestehenden ändern.
- Nie an `0.0.0.0` binden und nie `tailscale funnel` oder andere öffentliche Freigaben einrichten ohne ausdrückliche Zustimmung.
- Mobile Regeln: Eingabefelder mindestens 16 px (sonst zoomt iOS), Tippflächen mindestens 44 px, kein horizontales Scrollen der Seite (Grid-Kinder haben `min-width: 0`).
- Design: Keine Markenwerte (Farben, Schrift, Logo, Anrede, Dunkelmodus) als entschieden ausgeben – es sind Arbeitswerte. Komponenten-CSS nutzt nur Rollen-Variablen (`--color-…`), keine Rohwerte. `tests/design.test.ts` prüft Kontraste (Text ≥ 4,5:1, Bedienelemente/Fokus ≥ 3:1), Schriftgrößen (≥ 12 px, Fließtext 16 px) und dass `tokens.css` aktuell ist.
- UI-Texte auf Deutsch. Datum und Zeit über `formatDateTime`/`formatDate` (Europe/Berlin).

## Dateien

- `data/contentkompass.db`: Nutzerdaten, nicht im Repository.
- `templates/performance-vorlage.csv`: CSV-Vorlage, auch unter `/performance/vorlage` erreichbar.
