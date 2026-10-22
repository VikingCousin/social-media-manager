// Zugangsregel für den Betrieb hinter `tailscale serve` (reine Funktion, testbar).
//
// Solange CK_ALLOWED_TAILSCALE_LOGINS leer ist, gilt nur: Der Server lauscht auf 127.0.0.1
// (siehe package.json) und ist damit ausschließlich vom Mac selbst erreichbar.
//
// Ist die Variable gesetzt (z. B. "nutzer@example.com"), dann gilt zusätzlich:
// - Anfragen über Tailscale Serve tragen den Header `Tailscale-User-Login`. Tailscale entfernt
//   gleichnamige Header aus eingehenden Anfragen, der Wert stammt also von Tailscale selbst.
//   Nur freigegebene Logins werden durchgelassen.
// - Anfragen ohne diesen Header werden nur akzeptiert, wenn sie direkt an localhost gehen
//   (Browser auf dem Mac). Alles andere – z. B. von getaggten Geräten – wird abgewiesen.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function parseAllowedLogins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function hostName(hostHeader: string | null): string {
  const h = (hostHeader ?? "").trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
  return h.split(":")[0];
}

export type AccessDecision = { allow: true } | { allow: false; reason: string };

export function decideAccess(allowed: string[], loginHeader: string | null, hostHeader: string | null): AccessDecision {
  if (allowed.length === 0) return { allow: true };
  const login = loginHeader?.trim().toLowerCase();
  if (login) {
    return allowed.includes(login) ? { allow: true } : { allow: false, reason: "Dieses Tailscale-Konto ist nicht freigegeben." };
  }
  if (LOCAL_HOSTS.has(hostName(hostHeader))) return { allow: true };
  return { allow: false, reason: "Zugriff nur über Tailscale mit freigegebenem Konto oder direkt auf dem Mac." };
}
