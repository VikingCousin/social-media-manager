# Social Media Manager sicher auf dem iPhone nutzen – Empfehlung

Stand: 29.09.2026. Dieses Dokument ist ein Vorschlag für die eigene Einrichtung. Der Ablauf mit Tailscale ist **nicht end-to-end getestet**.

## Kurzfassung

**Empfehlung: ein privates Netzwerk mit Tailscale, kein öffentlicher Zugang.**

- **Stufe 1 (jetzt, 0 €):** Der Mac bleibt der Server, die SQLite-Datei bleibt, wo sie ist. Mac und iPhone verbinden sich über Tailscale. `tailscale serve` stellt Social Media Manager mit gültigem HTTPS **nur innerhalb deines privaten Tailscale-Netzes** bereit. Login bedeutet: Nur Geräte, die mit deinem Tailscale-Konto angemeldet sind, kommen überhaupt an die App. Zusätzlich prüft die App dein Tailscale-Konto.
- **Stufe 2 (nur wenn nötig, ca. 4–7 € im Monat):** Wenn die App auch erreichbar sein soll, während das Mac zugeklappt ist, zieht sie auf einen kleinen EU-Server. Der hängt ebenfalls nur im Tailscale-Netz und hat keinen öffentlichen Port. Das bedeutet eine **Datenverschiebung**, die nur mit deiner ausdrücklichen Zustimmung passiert.

Nicht empfohlen: die App öffentlich ins Internet stellen (Tailscale Funnel, Portfreigabe am Router, öffentliches Hosting mit eigenem Login). Das bringt mehr Angriffsfläche und mehr Pflege, und für eine Einzelperson gibt es keinen Vorteil.

## Ausgangslage (vor der Einrichtung selbst prüfen)

| Punkt | Worauf achten |
|---|---|
| Rechner | Ein Laptop ist kein Dauerläufer: Zugeklappt oder im Ruhezustand ist die App nicht erreichbar |
| Energiesparen | Ruhezustand-Einstellungen bestimmen, wann der Server schläft |
| Daten | Eine SQLite-Datei `data/contentkompass.db` (+ WAL) |
| Backup | `npm run backup` ist vorhanden; zusätzlich eine Kopie außerhalb des Rechners (z. B. Time Machine) einrichten |
| Netzwerk | Der Server lauscht standardmäßig nur auf `127.0.0.1` und ist damit im WLAN nicht erreichbar |

Konsequenz: Mit einem Laptop als Server ist die App unterwegs nur erreichbar, solange er **aufgeklappt, wach und online** ist. Für „immer erreichbar“ ist Stufe 2 sinnvoll.

## Optionen im Vergleich

| | A: Mac + Tailscale | B: Kleiner Heimserver + Tailscale | C: EU-Cloud-Server + Tailscale | D: Öffentlich + eigenes Login |
|---|---|---|---|---|
| Erreichbar unterwegs | nur wenn Mac wach und online | immer (Strom und Internet zu Hause vorausgesetzt) | immer | immer |
| Daten | bleiben auf dem Mac | eigenes Gerät zu Hause | beim Hoster (EU-Rechenzentrum) | beim Hoster |
| Öffentlich erreichbar | nein | nein | nein (nur Tailscale) | **ja** |
| HTTPS | automatisch über `tailscale serve` | dito | dito | Zertifikat des Hosters bzw. Proxys |
| Login | Tailscale-Konto + Gerät, zusätzlich App-Prüfung | dito | dito | selbst bauen oder Cloudflare Access (eigene Domain nötig) |
| Backup | Skript + Time Machine | Skript + externes Laufwerk | Skript + Snapshots beim Hoster | dito |
| Laufende Kosten | 0 € | Strom, einmalig Hardware | ca. 4–7 €/Monat (siehe Kosten) | ab ca. 4 €/Monat + ggf. Domain |
| Aufwand | gering | mittel | mittel | hoch (Sicherheit, Updates) |

## Empfehlung Stufe 1: Schritt für Schritt

Alle Schritte führst **du** aus. Keiner davon stellt etwas öffentlich ins Internet.

**1. Mac umbenennen, bevor HTTPS aktiviert wird.**
Die Namen der Geräte werden bei Tailscale-Zertifikaten in öffentlichen Certificate-Transparency-Logs sichtbar. Dein Tailnet-Name selbst ist zufällig (z. B. `yak-bebop.ts.net`). Wähle einen neutralen Gerätenamen ohne Klarnamen, z. B. `kompass`. Das geht unter *Systemeinstellungen → Allgemein → Info → Name* oder später im Tailscale-Adminbereich.

**2. Tailscale installieren und anmelden.**
- Mac: Tailscale aus dem Mac App Store oder von tailscale.com installieren und anmelden.
- iPhone: Tailscale aus dem App Store installieren und mit **demselben Konto** anmelden.
- Für das Anmeldekonto die Zwei-Faktor-Authentifizierung aktivieren, denn es ist dein Schlüssel zur App.

**3. HTTPS im Tailscale-Adminbereich aktivieren.**
Unter *DNS*: MagicDNS einschalten, dann „Enable HTTPS“.

**4. Social Media Manager dauerhaft auf dem Mac laufen lassen.**
```bash
cd /pfad/zum/social-media-manager
npm run build
cp scripts/launchd/de.contentkompass.server.plist.example ~/Library/LaunchAgents/de.contentkompass.server.plist
launchctl load ~/Library/LaunchAgents/de.contentkompass.server.plist
```
Die App läuft dann nach jeder Anmeldung im Hintergrund, nur auf `127.0.0.1:3210`. Beenden kannst du sie mit `launchctl unload ~/Library/LaunchAgents/de.contentkompass.server.plist`.

**5. Tägliches Backup einrichten** (siehe Abschnitt Backup).

**6. Zugangsprüfung der App einschalten.** In `.env.local`:
```
CK_ALLOWED_TAILSCALE_LOGINS=deine-tailscale-login-adresse
```
Danach die App neu starten (`launchctl unload …` und `launchctl load …`).
Wirkung: Über Tailscale kommt nur dieses Konto herein. Direkt auf dem Mac funktioniert `localhost` weiter. Das ist getestet (siehe `tests/access.test.ts` und die Prüfung mit dem Produktions-Build).

**7. Tailscale Serve starten – nur im privaten Netz.**
```bash
tailscale serve --bg --https=443 http://127.0.0.1:3210
tailscale serve status
```
Die App ist dann unter `https://kompass.<dein-tailnet>.ts.net` erreichbar, **nur** für deine Tailscale-Geräte. Serve läuft nach Neustarts weiter. Ausschalten geht mit `tailscale serve reset`.
**Nicht** `tailscale funnel` verwenden, denn Funnel stellt Dienste öffentlich ins Internet.

**8. Auf dem iPhone testen und installieren.**
Tailscale-VPN einschalten, die `…ts.net`-Adresse in Safari öffnen und die Anleitung unter *Mehr → Auf dem iPhone installieren* befolgen.
Falls beim Speichern „Invalid Server Actions request“ erscheint, trage in `.env.local` `CK_ALLOWED_ORIGINS=kompass.<dein-tailnet>.ts.net` ein und starte die App neu. Dieser Fall ist **ungeprüft**: Ob `tailscale serve` den Host-Header verändert, ließ sich ohne Tailscale nicht testen.

**9. Mac wach halten, solange er als Server dient** (am Netzteil).
Unter *Systemeinstellungen → Batterie → Optionen* „Automatischen Ruhezustand verhindern, wenn das Display ausgeschaltet ist“ aktivieren. Die Bezeichnung variiert je nach macOS-Version. Zugeklappt schläft ein Mac trotzdem, außer im Betrieb mit externem Monitor.

## Backup

Die Datenbank ist eine einzige Datei. Das Backup-Skript nutzt die SQLite-Backup-Funktion und ist deshalb auch bei laufender App konsistent.

1. **Täglich automatisch:**
   ```bash
   cp scripts/launchd/de.contentkompass.backup.plist.example ~/Library/LaunchAgents/de.contentkompass.backup.plist
   launchctl load ~/Library/LaunchAgents/de.contentkompass.backup.plist
   ```
   Das schreibt jeden Abend um 21:30 eine Kopie nach `backups/`. Schläft der Mac um diese Zeit, holt launchd den Termin beim Aufwachen nach; ist er ausgeschaltet, entfällt das Backup an diesem Tag.
2. **Zweite Kopie außerhalb des Macs:** Time Machine auf ein externes Laufwerk einrichten. Sie erfasst den Projektordner inklusive `backups/`. Alternativ kannst du `backups/` regelmäßig in iCloud Drive kopieren; dann liegen die Daten allerdings bei Apple.
3. **Wiederherstellen:** `npm run restore -- backups/<datei>.db` bei beendeter App (siehe README).
4. **Aufräumen:** Alte Dateien in `backups/` gelegentlich löschen. Eine automatische Rotation gibt es noch nicht (Backlog).

## Sicherheitsregeln

- Der Server lauscht nur auf `127.0.0.1`. **Nicht** auf `0.0.0.0` umstellen und keine Portfreigabe am Router einrichten.
- Nur `tailscale serve`, **nie** `tailscale funnel`.
- Zwei-Faktor-Authentifizierung für das Tailscale-Anmeldekonto und eine Code-Sperre auf dem iPhone.
- iPhone verloren? Das Gerät im Tailscale-Adminbereich entfernen. Danach hat es keinen Zugang mehr.
- Der Anthropic-API-Schlüssel bleibt in `.env.local` auf dem Server und gelangt nie aufs iPhone.
- Keine Offline-Funktion: Ohne Verbindung zum Server zeigt die App einen Hinweis und speichert nichts. Es werden keine Daten auf dem iPhone zwischengespeichert.

## Stufe 2 (optional): immer erreichbar über einen kleinen EU-Server

Wann sinnvoll: Du willst unterwegs Ideen festhalten, während das Mac zugeklappt im Rucksack ist.

Vorgehen (nur mit deiner Zustimmung):
1. Kleinen Linux-Server im EU-Rechenzentrum mieten und Tailscale installieren.
2. Öffentliche Ports per Firewall schließen, nur Tailscale zulassen.
3. Social Media Manager dort mit Node installieren (`npm ci && npm run build && npm start`) und die SQLite-Datei auf die Server-Festplatte legen.
4. `tailscale serve` wie in Stufe 1 einrichten.
5. Backups: tägliches `npm run backup` plus Snapshots beim Hoster, dazu eine Kopie zurück auf den Mac.
6. Daten umziehen: `npm run backup` auf dem Mac, Datei per `scp` über Tailscale übertragen, `npm run restore` auf dem Server. **Erst nach deiner Freigabe.**

Die Codebasis ist dafür schon geeignet: eine Datei als Datenbank, der Pfad lässt sich über `CONTENTKOMPASS_DB` setzen, keine Cloud-Abhängigkeit.

## Kosten

| Posten | Preis | Stand |
|---|---|---|
| Tailscale Personal | kostenlos, bis 6 Nutzer, unbegrenzt viele Geräte | geprüft 29.09.2026, [tailscale.com/pricing](https://tailscale.com/pricing) |
| Stufe 1 gesamt | **0 €** (nur Strom des Macs) | – |
| Fly.io (Beispiel Stufe 2) | kleinste Shared-CPU-Maschine (256 MB) ca. 3,50 $/Monat, Volume 0,15 $/GB/Monat, dedizierte IPv4 2 $/Monat (mit Tailscale nicht nötig) | geprüft 29.09.2026, [docs.fly.io/about/pricing](https://docs.fly.io/about/pricing/) |
| Hetzner Cloud (Beispiel Stufe 2, Standort Deutschland) | kleinste Tarife ca. 4–6 €/Monat, Backup-Option aufpreispflichtig | **ungeprüft**: Die Preise waren auf der Hetzner-Seite nicht abrufbar |
| Cloudflare Access + Tunnel (Option D) | eigene Domain bei Cloudflare nötig; Kosten des kostenlosen Zero-Trust-Tarifs | **ungeprüft** |
| Anthropic API (optional) | nutzungsabhängig, unabhängig von der Zugriffsart | – |

## Quellen (geprüft am 29.09.2026)

- Tailscale Serve – nur im Tailnet, automatische HTTPS-Zertifikate, Identitäts-Header `Tailscale-User-Login`, gefälschte Header werden von Tailscale entfernt, Backend soll nur auf localhost lauschen: [tailscale.com/kb/1312/serve](https://tailscale.com/kb/1312/serve) (validiert 20.01.2026)
- Tailscale Serve CLI – `--bg`, Fortbestehen nach Neustart, `tailscale serve status` / `reset`, Funnel für öffentliche Freigabe: [tailscale.com/kb/1242/tailscale-serve](https://tailscale.com/kb/1242/tailscale-serve) (validiert 26.01.2026)
- HTTPS-Zertifikate und Hinweis auf öffentliche Certificate-Transparency-Logs: [tailscale.com/kb/1153/enabling-https](https://tailscale.com/kb/1153/enabling-https) (validiert 10.12.2025)
- Tailscale-Preise: [tailscale.com/pricing](https://tailscale.com/pricing)
- Fly.io-Preise: [docs.fly.io/about/pricing](https://docs.fly.io/about/pricing/)
- Cloudflare Access für selbst gehostete Apps (eigene Domain erforderlich): [developers.cloudflare.com](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/) (aktualisiert 17.04.2026)
- Apple-Anleitung zum Home-Bildschirm: Die genauen Button-Bezeichnungen je iOS-Version wurden **nicht** gegen die Apple-Dokumentation geprüft. Die In-App-Anleitung ist daher versionsneutral formuliert.
