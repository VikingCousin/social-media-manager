# Plattform-Verbindungen – Stand, Einrichtung, Sicherheit

Stand: 15.10.2026. Quellen sind am Ende genannt (geprüft am 15.10.2026). „ungeprüft“ heißt: nicht gegen offizielle Dokumentation bestätigt.

## Was je Plattform möglich ist

| Plattform | 1 · Identität verbinden | 2 · Eigene Beiträge & Kennzahlen | 3 · Veröffentlichen nach Freigabe | 4 · Fremde öffentliche Profile |
|---|---|---|---|---|
| **LinkedIn** (Beispiel LinkedIn) | **umgesetzt** – OpenID Connect (`openid`, `profile`), Produkt „Sign In with LinkedIn using OpenID Connect“ | **gesperrt** – `r_member_social` laut LinkedIn eingeschränkt („approved users only“); `r_member_postAnalytics` braucht gesonderten Zugang (für Einzelpersonen ungeprüft). Bis dahin manuell/CSV | **vorbereitet** – `w_member_social` über „Share on LinkedIn“; Posts API, Person-URN, Text-Maskierung, Freigabe-Prüfung und Vorschau der Anfrage sind gebaut. **Senden ist bewusst nicht freigeschaltet** | **nicht verfügbar** – keine offizielle API für Einzelpersonen bekannt; manuell im Content-Radar |
| **TikTok @beispiel_a** und **@beispiel_b** | **umgesetzt** – Login Kit (`user.info.basic`, `user.info.profile` für den Benutzernamen); jeder Account wird **einzeln** autorisiert, `open_id` eindeutig zugeordnet | **umgesetzt, ungetestet** – mit Scope `video.list` übernimmt „Synchronisieren“ eigene Videos mit Views, Likes, Kommentaren, Shares in „Performance“ | **gesperrt** – Content Posting API; nicht auditierte Apps posten nur privat | **nicht verfügbar** – Research API nur für Forschende (ungeprüft) |
| **Instagram @beispiel_insta** | **vorbereitet, ungetestet** – Instagram API mit Instagram Login; **nur für professionelle Konten** | **gesperrt** bis Umstellung – Insights (`instagram_business_manage_insights`) | **gesperrt** – erfordert öffentlich per URL erreichbare Medien | **gesperrt** – Business Discovery braucht den Zugang über Facebook Login |

## Sicherheit (umgesetzt)

- **OAuth mit doppelter State-Prüfung:**
  - zufälliger State mit 256 Bit, einmalig verwendbar, 10 Minuten gültig, an Plattform und Account gebunden;
  - zusätzlich ein httpOnly-Cookie im startenden Browser;
  - der Vergleich läuft zeitkonstant.
- **Tokens:**
  - nur serverseitig;
  - AES-256-GCM-verschlüsselt in der Datenbank;
  - Schlüssel in `data/token.key` (Dateirechte 600) oder in `CK_TOKEN_KEY` in `.env.local`;
  - nie im Browser, nie in Logs, nie in Git (`data/*`, `.env*` und `*.db` sind ausgeschlossen).
- **Client-Secrets:** nur in `.env.local`. Die Oberfläche fragt sie bewusst nicht ab.
- **Vor dem Speichern** zeigt die App das echte verbundene Profil (Name, @Benutzername, Bild, Plattform-ID) und gleicht es mit dem Account ab. Eine Abweichung, z. B. @beispiel_b statt @beispiel_a, wird rot markiert. Ein Plattform-Profil kann technisch nur **einem** Account zugeordnet sein.
- **Ablauf und Erneuerung:**

  | Plattform | Gültigkeit | Erneuerung |
  |---|---|---|
  | LinkedIn | 60 Tage | erneut autorisieren; Refresh-Tokens gibt es nur für ausgewählte Partner |
  | TikTok | 24 Stunden | automatisch über den Refresh-Token (365 Tage) |
  | Instagram | 60 Tage | automatisch, sobald der Token älter als 24 Stunden ist |

- **Trennen:** löscht den gespeicherten Zugang. Bei TikTok wird er zusätzlich offiziell widerrufen. Bei LinkedIn und Instagram entziehst du der App den Zugriff zusätzlich in den Konto-Einstellungen.
- **Backup:** `npm run backup` sichert die Datenbank, nicht aber `data/token.key`. Ohne Schlüssel sind gespeicherte Tokens nach einer Wiederherstellung unbrauchbar, dann einfach neu verbinden.

## Callback-Adressen

| Plattform | Anforderung laut Doku | In der Entwickler-App einzutragen |
|---|---|---|
| LinkedIn | exakte Übereinstimmung; Doku nennt HTTPS, LinkedIns eigene Beispiel-App nutzt `http://localhost:8080/login` | `http://localhost:3210/api/oauth/linkedin/callback` |
| TikTok | absolut, **muss mit https beginnen**, ohne Parameter, max. 10 URIs | `https://<geraet>.<tailnet>.ts.net/api/oauth/tiktok/callback` |
| Instagram | exakte Übereinstimmung (Dashboard ergänzt ggf. einen Schrägstrich) | `https://<geraet>.<tailnet>.ts.net/api/oauth/instagram/callback` |

Die Rückleitung ist eine Weiterleitung **im eigenen Browser**. Die Plattformen müssen deinen Mac nicht aus dem Internet erreichen. Deshalb funktioniert die **private** Tailscale-Adresse (`tailscale serve`, nur im eigenen Tailnet, gültiges HTTPS-Zertifikat) ohne öffentliche Freigabe. **Kein** `tailscale funnel`, keine Portfreigabe.

### HTTPS für TikTok und Instagram (nur wenn du es willst)

1. Tailscale auf dem Mac installieren und anmelden, im Admin-Bereich unter DNS MagicDNS und HTTPS aktivieren. Vorher einen neutralen Gerätenamen wählen, denn er erscheint in öffentlichen Zertifikats-Logs.
2. `tailscale serve --bg --https=443 http://127.0.0.1:3210`
3. In `.env.local`:
   - `CK_HTTPS_BASE_URL=https://<geraet>.<tailnet>.ts.net`
   - `CK_ALLOWED_TAILSCALE_LOGINS=<deine Tailscale-Login-Adresse>`
   - falls nötig `CK_ALLOWED_ORIGINS=<geraet>.<tailnet>.ts.net`
4. Den Social Media Manager unter dieser HTTPS-Adresse öffnen und dort „Mit TikTok verbinden“ wählen. Cookie und Rückleitung müssen zur selben Adresse gehören, sonst weist die App freundlich darauf hin.

## Instagram: Entscheidung vor dem Verbinden

Die offizielle API setzt ein **professionelles Konto** voraus. Laut Instagram-Hilfe gilt:
- Professionelle Konten können **nicht privat** sein, @beispiel_insta würde öffentlich.
- Offene Follow-Anfragen werden beim Umstellen automatisch angenommen.
- Öffentliche professionelle Konten können in Suchmaschinen erscheinen.
- Zurückwechseln ist möglich, dann entfallen Insights und der API-Zugang.

Die Umstellung nimmst du selbst vor (Instagram-App → Einstellungen → Kontotyp und Tools). Die App stellt nichts automatisch um.

## Quellen (geprüft am 15.10.2026)

- LinkedIn 3-legged OAuth (Redirect, State, 60-Tage-Token, Refresh nur für Partner): https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- Sign In with LinkedIn using OpenID Connect (Scopes, `/v2/userinfo`): https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
- LinkedIn Posts API und Berechtigungen: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- LinkedIn-Beispiel-App mit `http://localhost:8080/login`: https://learn.microsoft.com/en-us/linkedin/shared/authentication/sample-applications
- TikTok Login Kit for Web (HTTPS-Redirect, State, `disable_auto_auth`): https://developers.tiktok.com/doc/login-kit-web
- TikTok Token-Verwaltung (24 h / 365 Tage, Refresh, Revoke): https://developers.tiktok.com/doc/oauth-user-access-token-management
- TikTok User Info (Felder je Scope): https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info
- TikTok Video Object: https://developers.tiktok.com/doc/tiktok-api-v2-video-object
- Instagram Business Login (Endpunkte, Scopes, Langzeit-Token, Refresh): https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
- Instagram-Hilfe, professionelles Konto: https://help.instagram.com/502981923235522
