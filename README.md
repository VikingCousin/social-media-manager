# Social Media Manager

Ein lokaler, persönlicher Assistent für eigene Social-Media-Accounts (LinkedIn, Instagram, TikTok): Gedanken schnell festhalten, mit oder ohne KI zu einem drehfertigen Content-Paket ausarbeiten, freigeben, planen und die eigenen Ergebnisse auswerten. Einzelbenutzer-Web-App, Oberfläche auf Deutsch, Zeitzone Europe/Berlin.

Grundsatz: Es werden keine Erfahrungen, Zahlen oder Erfolge erfunden. Wo persönliche Angaben fehlen, setzt die App Platzhalter und Fragen. Empfehlungen nennen ihre Quelle, Datenlücken und Unsicherheit.

> **Status: privates Entwicklungsprojekt.** Die App hat **keine eigene Anmeldung** und ist nur für den Betrieb auf dem eigenen Rechner (`127.0.0.1`) gedacht. Sie ist in diesem Stand **nicht für einen öffentlichen Betrieb geeignet** – dafür wären mindestens Authentifizierung, HTTPS, Härtung und ein Sicherheitsreview nötig.

## Lizenz

**Es wurde noch keine Lizenz festgelegt.** Das Repository ist öffentlich einsehbar, aber öffentliche Sichtbarkeit ist keine Open-Source-Lizenz: Ohne ausdrückliche Lizenz bleiben alle Rechte beim Urheber. Nutzung, Weitergabe oder Veränderung bitte vorher anfragen.

## Funktionsumfang

| Bereich | Was geht |
|---|---|
| Schnellerfassung | Gedanken tippen oder per iPhone-Diktat festhalten, ohne Pflichtfelder. Wortlaut und Zeitpunkt bleiben unverändert erhalten. „Ruhiger Modus“ (`/neu?modus=ruhig`): speichern, Bestätigung, fertig. |
| Content-Paket | „Ausarbeiten“ an der Idee: Account-Empfehlung mit Begründung und Alternative, Blickwinkel, drei Einstiege (gesprochen, Text im Bild, Bildmotiv) plus Kombination, roter Faden, optionales Skript, Drehplan (sagen / zeigen / ergänzend filmen / Drehort), Titel, Caption, offene Fragen. Alles als bearbeitbarer Entwurf. |
| Ohne API-Schlüssel | Kopierbarer Prompt; die Antwort eines externen KI-Tools wird eingefügt und automatisch auf die Felder verteilt. |
| Meine Sprache | Eigene Sprachmerkmale, „Klingt nach mir / klingt nicht nach mir“ mit Begründung, belegte Ableitung aus eigenen Texten (bleibt Vorschlag bis zur Bestätigung). Das ist Kontextanpassung für Prompts, **kein Modelltraining**. |
| Accounts & Strategie | Zielgruppe, Positionierung, Themen, Tonalität, Formate, Ziele, Grenzen je Account; „Noch offen“ ist erlaubt. |
| Redaktionsplan | Idee → Entwurf → Bereit → Freigegeben → Geplant → Veröffentlicht. Die Freigabe gilt für genau Inhalt, Account, Format, Termin und Paket; jede Änderung hebt sie auf. |
| Performance | Manuelle Erfassung oder CSV-Import ohne Duplikate; Auswertung je Account. Unbekannte Werte bleiben unbekannt (nie 0). |
| Content-Radar | Manuell erfasste fremde Beiträge (Konkurrenz, Inspiration), strikt getrennt von eigenen Daten; kein Scraping. |
| Mobil | Responsive Oberfläche, Web-App-Manifest und App-Symbol für den Home-Bildschirm. Keine Offline-Funktion. |

## Integrationen: implementiert vs. getestet

| Integration | Implementiert | Gegen den echten Dienst getestet |
|---|---|---|
| Anthropic API („Ausarbeiten“, Coach, Radar-Analyse) | ja (`src/server/ai.ts`, Structured Output) | **nein** – bisher nur der Weg über den kopierbaren Prompt. Der Standard-Modellname `claude-opus-5` ist ungeprüft und ggf. in den Einstellungen anzupassen. |
| LinkedIn (OpenID-Anmeldung, Profilabgleich, Beitragsvorbereitung) | ja; **Senden bewusst nicht implementiert** | **nein** (keine App-Zugangsdaten hinterlegt) |
| TikTok (Login Kit, Profil) | ja | **nein** (braucht HTTPS-Rückleitung) |
| Instagram (Business Login, Profil) | ja | **nein** (nur professionelle Konten) |
| Tailscale-Zugriff vom iPhone | Zugangsprüfung (`src/proxy.ts`) und Anleitung | **nein**, nicht end-to-end |
| Zugriff im lokalen WLAN | per `next start -H <LAN-IP>` möglich | Speichern und Bearbeiten über die LAN-Adresse vom Mac aus geprüft; ohne Login und ohne HTTPS |

Unit-Tests decken die reine Logik ab (CSV, Zeitzonen, Auswertung, Radar, Planer, Prompts, Content-Paket, Sprache, Verbindungs-Hilfen, Token-Verschlüsselung, Kontraste). Sie ersetzen keinen Test gegen die echten Plattform-APIs.

## Voraussetzungen

- Node.js ≥ 20 (entwickelt mit Node 24) und npm; entwickelt unter macOS
- Optional: eigener Anthropic-API-Schlüssel. Die API wird **separat nutzungsabhängig abgerechnet**; ein Claude-Abo ist kein API-Zugang.

## Installation und Start

```bash
git clone https://github.com/VikingCousin/social-media-manager.git
cd social-media-manager
npm install
npm run dev
```

Danach **http://localhost:3210** öffnen. Der Server lauscht nur auf `127.0.0.1`.

`better-sqlite3` ist ein natives Modul und in `package.json` unter `allowScripts` freigegeben. Falls npm warnt: `npm approve-scripts better-sqlite3` und `npm rebuild better-sqlite3`.

Produktionsbetrieb lokal:

```bash
npm run build
npm start
```

Beim ersten Start entsteht `data/contentkompass.db` mit **vier Beispiel-Accounts** (Platzhalter-Namen wie „Beispielkanal A“). Ersetze oder archiviere sie unter *Accounts*. Weitere Beispieldaten gibt es nicht.

## Konfiguration

`cp .env.example .env.local` und nur die benötigten Werte eintragen. `.env.local` ist per `.gitignore` ausgeschlossen. Schlüssel nie committen.

| Variable | Zweck |
|---|---|
| `ANTHROPIC_API_KEY` | KI-Funktionen. Wird nur serverseitig gelesen, nie geloggt. |
| `ANTHROPIC_MODEL` | Optional, Modellname (auch in den Einstellungen änderbar). |
| `CONTENTKOMPASS_DB` | Optional, Pfad zur SQLite-Datei. |
| `CK_ALLOWED_TAILSCALE_LOGINS` | Optional, erlaubte Tailscale-Logins hinter `tailscale serve`. |
| `CK_ALLOWED_ORIGINS` | Optional, zusätzliche Origins für Server Actions hinter einem Proxy. |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_SCOPES`, `LINKEDIN_API_VERSION` | LinkedIn-App aus dem LinkedIn Developer Portal. Produkte: „Sign In with LinkedIn using OpenID Connect“ (`openid profile`), optional „Share on LinkedIn“ (`w_member_social`). Rückleitung: `http://localhost:3210/api/oauth/linkedin/callback`. |
| `CK_HTTPS_BASE_URL` | HTTPS-Basisadresse für TikTok/Instagram-Rückleitungen. |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_SCOPES` | TikTok-App (Login Kit), z. B. `user.info.basic,user.info.profile`. |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_SCOPES` | Meta-App mit Instagram Business Login, z. B. `instagram_business_basic`. |
| `CK_TOKEN_KEY` | Optional, 32-Byte-Schlüssel (base64) für die Token-Verschlüsselung. Sonst wird `data/token.key` (Rechte 600) erzeugt. |

Plattform-Tokens werden nur serverseitig und AES-256-GCM-verschlüsselt in der Datenbank gespeichert. Details: [docs/VERBINDUNGEN.md](docs/VERBINDUNGEN.md), Ausblick: [docs/ROADMAP-INTEGRATIONEN.md](docs/ROADMAP-INTEGRATIONEN.md), iPhone-Zugriff: [docs/IPHONE-ZUGRIFF.md](docs/IPHONE-ZUGRIFF.md).

## Daten, Backup, Wiederherstellung

Alle Daten liegen in einer Datei (`data/contentkompass.db`), nicht im Repository.

```bash
npm run backup                         # konsistente Kopie nach backups/
npm run restore -- backups/<datei>.db  # App vorher beenden
```

## Gestaltung

Neutrale Standardwerte in `design/tokens.json` (W3C-Token-Format); `npm run tokens` erzeugt daraus `src/app/tokens.css`. Kontraste (WCAG 2.2 AA) und Schriftgrößen prüft `tests/design.test.ts`. Es ist keine Marke hinterlegt; Farben, Schrift und App-Symbol sind Arbeitswerte. Siehe [design/BRAND-STATUS.md](design/BRAND-STATUS.md).

## Prüfungen

```bash
npm test
npm run typecheck
npm run build
```

## Bekannte Grenzen

- Keine eigene Authentifizierung, kein Mehrbenutzerbetrieb; nur für `127.0.0.1` bzw. ein vertrauenswürdiges privates Netz gedacht.
- Nichts wird automatisch veröffentlicht; „Geplant“ ist nur ein Eintrag im Redaktionsplan. LinkedIn-Senden ist nicht implementiert.
- Keine Offline-Funktion und kein Service Worker; ein lokaler Entwurf im Browser ist kein Backup.
- Plattform-Integrationen sind nicht gegen die echten Dienste getestet (siehe Tabelle oben).
- „Lernen“ bedeutet Prompt-Kontext aus eigenen Texten und Rückmeldungen, kein Modelltraining.
- Auswertungen beschreiben Muster aus eigenen Beiträgen und sind bei wenigen Datenpunkten nur Hinweise.
- Interner Paket- und Datenbankname ist noch `content-kompass` / `contentkompass` (früherer Projektname).
