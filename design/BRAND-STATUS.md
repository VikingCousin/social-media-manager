# Gestaltung – Status

Dieses Repository enthält **keine Marke**. Die Oberfläche nutzt neutrale Standardwerte.

| Punkt | Status |
|---|---|
| Name „Social Media Manager“ | Projektname |
| Farben, Schrift, App-Symbol, Anrede, Dunkelmodus | Arbeitswerte, frei anpassbar |
| Barrierefreiheit | Baseline WCAG 2.2 AA; Kontraste (Text ≥ 4,5:1, Bedienelemente/Fokus ≥ 3:1) und Schriftgrößen (≥ 12 px, Fließtext 16 px) prüft `tests/design.test.ts` |
| Schrift | Systemschrift, keine Lizenzfrage |
| App-Symbol | im Code erzeugt (`src/lib/app-icon.tsx`), keine externen Bilddateien |

## Anpassen

1. Werte in `design/tokens.json` ändern (W3C-Design-Token-Format, Rollennamen wie `color.text.primary`).
2. `npm run tokens` erzeugt `src/app/tokens.css` (nie von Hand bearbeiten).
3. `npm test` prüft Kontraste und dass `tokens.css` aktuell ist.

Komponenten-CSS verwendet nur Rollen-Variablen (`--color-…`), keine Rohwerte.
