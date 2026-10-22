import { ImageResponse } from "next/og";
import { color } from "./design-tokens";

// Arbeitsentwurf: Farben aus den Design-Tokens (markenseitig OFFEN, siehe design/BRAND-STATUS.md).
export const ICON_BG = color("color.brand.primary");
export const ICON_FG = color("color.bg.canvas");

/**
 * App-Symbol (ARBEITSENTWURF, kein freigegebenes Logo): heller Kompass auf der Arbeits-Markenfarbe. `inset` = Anteil des Rands (für maskierbare Icons größer,
 * damit das Motiv in der sicheren Zone liegt). iOS rundet die Ecken selbst ab.
 */
export function renderAppIcon(size: number, inset = 0.18, rounded = false) {
  const inner = Math.round(size * (1 - inset * 2));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ICON_BG,
          borderRadius: rounded ? size * 0.22 : 0,
        }}
      >
        <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={ICON_FG} strokeWidth="1.6" />
          <path d="M16.2 7.8 13.3 13.3 7.8 16.2l2.9-5.5 5.5-2.9Z" fill={ICON_FG} />
          <circle cx="12" cy="12" r="1.1" fill={ICON_BG} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
