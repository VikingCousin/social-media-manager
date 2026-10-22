"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Übersicht" },
  { href: "/ideen", label: "Ideen" },
  { href: "/entwuerfe", label: "Entwürfe & Plan" },
  { href: "/engagement", label: "LinkedIn-Engagement" },
  { href: "/performance", label: "Performance" },
  { href: "/radar", label: "Content-Radar" },
  { href: "/accounts", label: "Accounts & Strategie" },
  { href: "/sprache", label: "Meine Sprache" },
  { href: "/verbindungen", label: "Verbindungen" },
];

export function Nav() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className={isActive(i.href) ? "active" : ""} aria-current={isActive(i.href) ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
      <div className="sep" />
      <Link href="/einstellungen" className={isActive("/einstellungen") ? "active" : ""} aria-current={isActive("/einstellungen") ? "page" : undefined}>
        Einstellungen
      </Link>
    </nav>
  );
}
