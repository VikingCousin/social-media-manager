import type { NextConfig } from "next";

// Optional: zusätzliche erlaubte Herkunft für Server Actions, falls ein vorgeschalteter Proxy
// (z. B. `tailscale serve`) den Host-Header umschreibt. Beispiel:
// CK_ALLOWED_ORIGINS=kompass.tail1234.ts.net
const allowedOrigins = (process.env.CK_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // better-sqlite3 ist ein natives Modul und wird nicht gebündelt.
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  ...(allowedOrigins.length ? { experimental: { serverActions: { allowedOrigins } } } : {}),
};

export default nextConfig;
