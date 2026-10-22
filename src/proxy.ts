import { NextResponse, type NextRequest } from "next/server";
import { decideAccess, parseAllowedLogins } from "@/lib/access";

// Optionale Zugangssperre für den Betrieb hinter Tailscale Serve (standardmäßig aus).
// Details: src/lib/access.ts und docs/IPHONE-ZUGRIFF.md
export function proxy(request: NextRequest) {
  const allowed = parseAllowedLogins(process.env.CK_ALLOWED_TAILSCALE_LOGINS);
  const decision = decideAccess(allowed, request.headers.get("tailscale-user-login"), request.headers.get("host"));
  if (decision.allow) return NextResponse.next();
  return new NextResponse(`Kein Zugriff. ${decision.reason}`, {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export const config = {
  // Alles außer statischen Build-Dateien prüfen.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
