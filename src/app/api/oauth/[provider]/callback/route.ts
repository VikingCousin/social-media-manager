import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ConnectionError, completeAuthorization, providerSetup } from "@/server/connections";
import { PROVIDERS, type ProviderId } from "@/lib/platforms";

export const dynamic = "force-dynamic";

const CANCEL_CODES = new Set(["user_cancelled_login", "user_cancelled_authorize", "access_denied"]);

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// OAuth-Rückleitung: State doppelt prüfen (Cookie im Browser + einmaliger Eintrag in der Datenbank),
// Code serverseitig tauschen, Profil abrufen, unbestätigt ablegen und zur Bestätigung weiterleiten.
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!(provider in PROVIDERS)) return new NextResponse("Unbekannte Plattform", { status: 404 });
  const p = provider as ProviderId;
  const base = providerSetup(p).redirectBase || new URL(req.url).origin;
  const back = (kind: "ok" | "fehler", msg: string, path = "/verbindungen") => {
    const u = new URL(path, base);
    u.searchParams.set(kind, msg);
    const res = NextResponse.redirect(u);
    res.cookies.delete({ name: `ck_oauth_${p}`, path: "/api/oauth" });
    return res;
  };
  const q = req.nextUrl.searchParams;
  const error = q.get("error");
  if (error) {
    return back("fehler", CANCEL_CODES.has(error) ? `Verbindung mit ${PROVIDERS[p].label} abgebrochen – nichts wurde gespeichert.` : `${PROVIDERS[p].label} meldet: ${(q.get("error_description") || error).slice(0, 200)}`);
  }
  const code = q.get("code");
  const state = q.get("state");
  const cookie = req.cookies.get(`ck_oauth_${p}`)?.value;
  if (!code || !state) return back("fehler", "Unvollständige Rückmeldung der Plattform (Code oder State fehlt).");
  if (!cookie || !same(cookie, state)) {
    return back("fehler", "Sicherheitsprüfung fehlgeschlagen: Die Anmeldung wurde nicht in diesem Browser gestartet. Bitte unter Verbindungen erneut starten.");
  }
  try {
    const pendingId = await completeAuthorization(p, code, state);
    const u = new URL(`/verbindungen/bestaetigen/${pendingId}`, base);
    const res = NextResponse.redirect(u);
    res.cookies.delete({ name: `ck_oauth_${p}`, path: "/api/oauth" });
    return res;
  } catch (err) {
    return back("fehler", err instanceof ConnectionError ? err.message : "Unerwarteter Fehler bei der Verbindung.");
  }
}
