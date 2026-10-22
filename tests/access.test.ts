import { test } from "node:test";
import assert from "node:assert/strict";
import { decideAccess, hostName, parseAllowedLogins } from "../src/lib/access.ts";

test("ohne Konfiguration ist die Sperre aus (Schutz: nur 127.0.0.1)", () => {
  assert.deepEqual(decideAccess([], null, "mac.tail1234.ts.net"), { allow: true });
});

test("freigegebenes Tailscale-Konto darf, andere nicht", () => {
  const allowed = parseAllowedLogins(" Nutzer@Example.com , ");
  assert.deepEqual(allowed, ["nutzer@example.com"]);
  assert.equal(decideAccess(allowed, "nutzer@example.com", "kompass.tail1234.ts.net").allow, true);
  assert.equal(decideAccess(allowed, "NUTZER@example.com", "kompass.tail1234.ts.net").allow, true);
  assert.equal(decideAccess(allowed, "fremd@example.com", "kompass.tail1234.ts.net").allow, false);
});

test("ohne Login-Header nur direkter Zugriff auf localhost", () => {
  const allowed = ["nutzer@example.com"];
  assert.equal(decideAccess(allowed, null, "localhost:3210").allow, true);
  assert.equal(decideAccess(allowed, null, "127.0.0.1:3210").allow, true);
  assert.equal(decideAccess(allowed, null, "[::1]:3210").allow, true);
  assert.equal(decideAccess(allowed, null, "kompass.tail1234.ts.net").allow, false);
  assert.equal(decideAccess(allowed, "", "192.0.2.10:3210").allow, false);
});

test("Host-Namen werden ohne Port verglichen", () => {
  assert.equal(hostName("LOCALHOST:3210"), "localhost");
  assert.equal(hostName("[::1]:3210"), "[::1]");
  assert.equal(hostName(null), "");
});
