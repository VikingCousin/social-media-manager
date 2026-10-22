"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "ck-install-hint-dismissed";

export type Env = { ios: boolean; standalone: boolean; safari: boolean; localOnly: boolean };

export function detectEnv(): Env {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const safari = ios && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const localOnly = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  return { ios, standalone, safari, localOnly };
}

/** Dezenter Hinweis auf der Übersicht – nur in iPhone-Safari und nur, solange nicht installiert. */
export function InstallHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const env = detectEnv();
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {
      /* privater Modus: Hinweis einfach anzeigen */
    }
    setShow(env.ios && !env.standalone && !dismissed);
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignorieren */
    }
    setShow(false);
  };
  return (
    <div className="notice info flash" style={{ marginBottom: 14 }}>
      <span>
        Tipp: Du kannst Social Media Manager wie eine App auf deinen Home-Bildschirm legen. <Link href="/installieren">So geht’s</Link>
      </span>
      <button type="button" onClick={dismiss} aria-label="Hinweis ausblenden">×</button>
    </div>
  );
}

/** Zeigt auf der Installationsseite, was auf diesem Gerät gerade zutrifft. */
export function InstallStatus() {
  const [env, setEnv] = useState<Env | null>(null);
  useEffect(() => setEnv(detectEnv()), []);
  if (!env) return null;
  if (env.standalone) {
    return <div className="notice ok">Social Media Manager läuft bereits als Home-Bildschirm-App.</div>;
  }
  if (env.ios && !env.safari) {
    return <div className="notice warn">Du nutzt einen anderen Browser als Safari. Öffne diese Seite in Safari, um sie zum Home-Bildschirm hinzuzufügen.</div>;
  }
  if (!env.ios) {
    return <div className="notice info">Diese Anleitung ist für das iPhone. Öffne Social Media Manager dort in Safari – sobald es vom iPhone aus erreichbar ist (siehe unten).</div>;
  }
  return <div className="notice info">Du bist in Safari auf dem iPhone – du kannst direkt loslegen.</div>;
}
