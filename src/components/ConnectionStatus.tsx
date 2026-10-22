"use client";

import { useEffect, useState } from "react";

/**
 * Zeigt ehrlich an, wenn das Gerät offline ist. Social Media Manager hat keine Offline-Funktion:
 * Ohne Verbindung zum Server kann nichts angezeigt oder gespeichert werden.
 */
export function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return (
    <div className="notice danger flash" role="alert">
      <span>Keine Verbindung – nichts kann gespeichert werden, und nichts wird im Hintergrund nachgeholt. Ein angefangener Gedanke bleibt im Eingabefeld, bis du wieder speichern kannst.</span>
    </div>
  );
}
