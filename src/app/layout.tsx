import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Link from "next/link";
import "./tokens.css";
import "./globals.css";
import { color } from "@/lib/design-tokens";
import { Nav } from "@/components/Nav";
import { MobileTabBar } from "@/components/MobileNav";
import { Flash } from "@/components/Flash";
import { ConnectionStatus } from "@/components/ConnectionStatus";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Social Media Manager",
  description: "Persönlicher KI-Assistent für LinkedIn, Instagram und TikTok – Strategie, Ideen, Content, Planung und Analyse.",
  applicationName: "Social Media Manager",
  appleWebApp: {
    capable: true,
    title: "Social Media",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: color("color.bg.canvas") },
    { media: "(prefers-color-scheme: dark)", color: color("color.bg.canvas", "dark") },
  ],
};

function CompassIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.5 8.5 13.2 13.2 8.5 15.5l2.3-4.7 4.7-2.3Z" fill="currentColor" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <Link href="/" className="brand">
              <CompassIcon /> Social Media Manager
            </Link>
            <Nav />
            <div className="sidebar-foot">Dein KI-Assistent für LinkedIn, Instagram & TikTok<br />Lokal · Europe/Berlin · nichts wird extern veröffentlicht</div>
          </aside>
          <header className="topbar">
            <Link href="/" className="brand">
              <CompassIcon /> Social Media Manager
            </Link>
          </header>
          <main className="main">
            <ConnectionStatus />
            <Suspense fallback={null}>
              <Flash />
            </Suspense>
            {children}
          </main>
          <MobileTabBar />
        </div>
      </body>
    </html>
  );
}
