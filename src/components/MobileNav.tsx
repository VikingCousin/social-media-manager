"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MORE = ["/mehr", "/engagement", "/performance", "/radar", "/accounts", "/sprache", "/verbindungen", "/einstellungen", "/installieren"];

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Untere Tab-Leiste für kleine Bildschirme (iPhone). */
export function MobileTabBar() {
  const path = usePathname();
  const under = (p: string) => path === p || path.startsWith(p + "/");
  const items = [
    { href: "/", label: "Übersicht", active: path === "/", d: "M3 11.5 12 4l9 7.5M5.5 10v10h13V10" },
    { href: "/ideen", label: "Ideen", active: under("/ideen"), d: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" },
    { href: "/entwuerfe", label: "Plan", active: under("/entwuerfe"), d: "M4 6h16M4 12h16M4 18h10" },
    { href: "/mehr", label: "Mehr", active: MORE.some(under), d: "M5 12h.01M12 12h.01M19 12h.01" },
  ];
  return (
    <nav className="tabbar" aria-label="Hauptnavigation (mobil)">
      {items.slice(0, 2).map((i) => (
        <Link key={i.href} href={i.href} className={i.active ? "active" : ""} aria-current={i.active ? "page" : undefined}>
          <Icon d={i.d} />
          <span>{i.label}</span>
        </Link>
      ))}
      <Link href="/neu" className={`tab-add ${path === "/neu" ? "active" : ""}`} aria-label="Neue Idee erfassen">
        <span className="tab-add-circle"><Icon d="M12 5v14M5 12h14" /></span>
        <span>Idee</span>
      </Link>
      {items.slice(2).map((i) => (
        <Link key={i.href} href={i.href} className={i.active ? "active" : ""} aria-current={i.active ? "page" : undefined}>
          <Icon d={i.d} />
          <span>{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}
