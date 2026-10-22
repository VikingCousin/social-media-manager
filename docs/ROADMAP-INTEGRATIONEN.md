# Roadmap: offizielle Plattform-Integrationen des Social Media Managers

> Aktueller Umsetzungsstand der Verbindungen (15.10.2026): siehe [VERBINDUNGEN.md](VERBINDUNGEN.md).

Stand: 29.09.2026. In Version 1 ist **keine** Plattform angebunden. Profil-Links sind nur Links,
Kennzahlen werden manuell oder per CSV erfasst, und es wird nichts extern veröffentlicht.

Grundsätze für alle Ausbaustufen:

- Nur offizielle APIs mit OAuth. Keine Passwort-Automation, kein Cookie-Scraping, keine inoffiziellen Endpunkte.
- Tokens bleiben serverseitig (verschlüsselt gespeichert) und gelangen nie in den Browser oder in Logs.
- Veröffentlichen nur nach ausdrücklicher Freigabe durch die Nutzerin bzw. den Nutzer.
- Muster aus eigenen Beiträgen bleiben getrennt von externen Trends. Eigene Profildaten liefern keine Trendübersicht.

Legende: **geprüft** = gegen die offizielle Dokumentation am angegebenen Datum abgeglichen · **ungeprüft** = Annahme, vor der Umsetzung klären.

---

## Stufe 1 (Vorrang): LinkedIn-Veröffentlichung nach Freigabe

### Anforderungen an die App (unabhängig von der API)

Die Grundlage dafür ist in Version 1 schon angelegt (`drafts.approved_hash`, `approvalHash()` in `src/lib/domain.ts`).

1. **Freigabe bindet Inhalt, Account und Termin.** Der Fingerabdruck aus Account, Format, Titel, Text und Termin wird bei der Freigabe gespeichert. Jede Änderung hebt die Freigabe auf. Das ist bereits umgesetzt.
2. **Veröffentlichungsjob pro Freigabe:** eigene Tabelle `publish_jobs` mit `draft_id`, `approved_hash`, `status` (`wartend`, `laeuft`, `erfolgreich`, `fehlgeschlagen`, `unklar`), `external_id` und einem eindeutigen `idempotency_key`.
3. **Keine Doppelposts:**
   - Vor dem Senden prüft die App, ob der Hash noch stimmt und ob es bereits einen Job mit `external_id` gibt. Danach wird der Job atomar auf `laeuft` gesetzt.
   - Bei Timeout oder Netzwerkfehler wird **nicht** automatisch erneut gesendet. Der Job geht auf `unklar`. Die App prüft dann über „Find Posts by Authors“ (siehe unten), ob der Beitrag schon existiert, oder fragt nach.
   - Automatische Wiederholung gibt es nur bei eindeutig nicht angekommenen Anfragen (z. B. 429 vor Annahme). Das ist *ungeprüft*: Welche Fehlercodes garantieren „nicht erstellt“? Vor der Umsetzung testen.
4. **Scheduler:** Er läuft nur lokal, solange die App läuft. Verpasste Termine werden nicht still nachgeholt, sondern zur erneuten Bestätigung angezeigt.

### LinkedIn-API (geprüft am 29.09.2026)

| Punkt | Stand | Quelle |
|---|---|---|
| Beitrag als Mitglied erstellen | `POST https://api.linkedin.com/rest/posts`, Header `Linkedin-Version: YYYYMM` und `X-Restli-Protocol-Version: 2.0.0`. Die Antwort 201 liefert die Post-ID im Header `x-restli-id`. Das Posts API ersetzt das ältere ugcPosts API. | [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api) (Seite aktualisiert 13.05.2026) |
| Berechtigung zum Posten | `w_member_social` („Post, comment, and like posts on behalf of an authenticated member“). Wird über das Produkt „Share on LinkedIn“ im Developer Portal freigeschaltet. | Posts API; [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin) |
| Autor | Person-URN `urn:li:person:{id}`. Die ID kommt aus „Sign In with LinkedIn using OpenID Connect“. | Share on LinkedIn |
| Eigene Beiträge lesen | `GET /rest/posts?author=…&q=author` erfordert `r_member_social`. Laut Doku **eingeschränkt, nur für freigegebene Nutzer**. | Posts API |
| Rate-Limit (Share on LinkedIn) | 150 Anfragen pro Mitglied und Tag, 100.000 pro App (UTC). | Share on LinkedIn (Seite 2023, ggf. veraltet) |
| Versionierung | Die Marketing-Version 202510 läuft am 15.10.2026 aus. Immer eine aktuelle `Linkedin-Version` verwenden. | Posts API (Hinweis) |
| Idempotenz-Header beim Erstellen | In der Posts-API-Doku **nicht dokumentiert**. Deshalb braucht es den eigenen Doppelpost-Schutz (siehe oben). | Posts API |

Offene Punkte (**ungeprüft**):
- Kann eine private Einzelperson-App „Share on LinkedIn“ plus „Sign In with LinkedIn using OpenID Connect“ ohne Prüfverfahren nutzen? Vor dem Start im Developer Portal prüfen.
- Die Redirect-URI für eine lokale App (`http://localhost:3210/...`) muss LinkedIn akzeptieren.
- Bilder und Videos brauchen vorab Uploads über die Images/Videos API. Der erste Schritt ist daher nur Text.

## Stufe 2: Kennzahlen abrufen

### LinkedIn (geprüft am 29.09.2026)
- `GET /rest/memberCreatorPostAnalytics` mit `q=entity` (einzelner Beitrag) oder `q=me` (aggregiert).
- Berechtigung: `r_member_postAnalytics`.
- Kennzahlen ab Version 202604: IMPRESSION, MEMBERS_REACHED, RESHARE, REACTION, COMMENT, POST_SAVE, POST_SEND, LINK_CLICKS, FOLLOWER_GAINED_FROM_CONTENT, PROFILE_VIEW_FROM_CONTENT.
- Laut Doku ist die Zählung „best-effort accurate“. Reaktionen, Kommentare und Reshares sind in der aggregierten Abfrage „not consistent with UI“.
- Quelle: [Member Post Statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics) (aktualisiert 15.05.2026).
- **Ungeprüft:** Welcher Zugang (Community Management API) für `r_member_postAnalytics` nötig ist und ob Einzelpersonen ihn erhalten.

### Instagram (geprüft am 29.09.2026)
- Insights gibt es **nur für professionelle Konten** (Business/Creator). Für persönliche Konten liefert die API keine Daten. Ein privates Konto müsste dafür umgestellt werden. Diese Entscheidung liegt bei der Kontoinhaberin bzw. dem Kontoinhaber.
- `GET /<IG_MEDIA_ID>/insights`, Berechtigung `instagram_business_manage_insights` (Instagram Login).
- Laut Doku können fehlende Daten als leere Menge statt 0 zurückkommen. Das passt zu „unbekannt ≠ 0“ in Social Media Manager.
- Quelle: [Instagram Platform – Insights](https://developers.facebook.com/docs/instagram-platform/insights) (kein Datum auf der Seite).

### TikTok (geprüft am 29.09.2026)
- `POST https://open.tiktokapis.com/v2/video/list/`, Scope `video.list`, liefert öffentliche Videos des Nutzers (max. 20 pro Seite).
- Quelle: [List Videos](https://developers.tiktok.com/doc/tiktok-api-v2-video-list) (aktualisiert 04.08.2026).
- **Ungeprüft:** Welche Kennzahlenfelder das Video-Objekt enthält (z. B. `view_count`, `like_count`), welche Scopes dafür nötig sind und ob Wiedergabedauer oder Follower-Gewinn überhaupt verfügbar sind.

Umsetzung in Social Media Manager: Abgerufene Werte laufen durch denselben `upsertPost`-Pfad wie der CSV-Import. Dedup geht dann über die Plattform-ID statt über den Link, mit Quelle `api`. Unbekannte Werte bleiben `NULL`.

## Stufe 3: Weitere Veröffentlichungen

### Instagram (geprüft am 29.09.2026)
- Nur **professionelle Konten**. Ablauf: Container über `/media` anlegen, dann über `/media_publish` veröffentlichen.
- Berechtigungen (Instagram Login): `instagram_business_basic`, `instagram_business_content_publish`.
- Medien müssen öffentlich per URL erreichbar sein. Das ist für eine rein lokale App ein Hindernis und erfordert temporäres öffentliches Hosting.
- Limit: 100 per API veröffentlichte Beiträge in 24 Stunden.
- Quelle: [Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing).

### TikTok (geprüft am 29.09.2026)
- Content Posting API, Scope `video.publish` (Direct Post) oder Upload in die Inbox.
- Vorher muss `creator_info` abgefragt werden (erlaubte Privatsphäre-Stufen, maximale Dauer).
- **Wichtig:** Inhalte von nicht auditierten Clients sind auf private Sichtbarkeit beschränkt. Für öffentliche Posts ist ein Audit durch TikTok nötig.
- Quelle: [Content Posting API – Get Started](https://developers.tiktok.com/doc/content-posting-api-get-started) (aktualisiert 04.08.2026).

## Content-Radar: automatischer Abruf fremder Profile

Stand 14.10.2026. Der Radar wird bisher manuell befüllt.

- **Instagram – Business Discovery** (geprüft am 14.10.2026): Das Endpoint liest öffentliche Daten anderer **Business- oder Creator-Konten**, etwa `followers_count`, `media_count` und Beiträge mit `like_count`, `comments_count` und `view_count`. Es gibt nur Lesezugriff, und altersbeschränkte Konten sind ausgenommen. Voraussetzungen:
  - ein **eigenes professionelles Instagram-Konto** und der Instagram-API-Zugang mit Facebook Login,
  - die Berechtigungen `instagram_basic`, `instagram_manage_insights` und `pages_read_engagement`.

  Ist das Konto privat, gilt: Für diesen Abruf müsste es auf ein professionelles Konto umgestellt werden; das entscheidet die Kontoinhaberin bzw. der Kontoinhaber.
  Quelle: [Business Discovery](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery).
  Umsetzungsidee: Abgerufene Beiträge landen über denselben Pfad in `radar_posts` (Quelle „Business Discovery“, Dedup über den Link).
- **LinkedIn**: Eine offizielle API, mit der Einzelpersonen Beiträge fremder Profile lesen können, ist **ungeprüft bzw. nicht bekannt**. Fremde Beiträge bleiben deshalb eine manuelle Erfassung.
- **TikTok**: Ob ein offizieller Zugang zu fremden Profilen für Einzelpersonen möglich ist (z. B. die Research API), ist **ungeprüft**. Bis dahin bleibt es bei der manuellen Erfassung.

Kein Scraping, keine Passwort- oder Cookie-Automation, auch nicht für den Radar.

## Was ausdrücklich nicht geplant ist

- Automatisches Liken, Kommentieren, Vernetzen oder Versenden von Nachrichten auf LinkedIn. Engagement bleibt ein Entwurf, den man selbst verwendet.
- Automatische „Trenderkennung“ aus den eigenen Profilen. Externe Trends bleiben eine manuell gepflegte Sammlung mit Quelle und Datum.
