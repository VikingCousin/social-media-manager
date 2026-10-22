"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { captureIdeaAction, type CaptureResult } from "@/app/actions";
import { PLATFORMS, type Account } from "@/lib/domain";
import { formatDateTime } from "@/lib/time";

type Mode = "schnell" | "ruhig";
type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; id: number; savedAt: string; chars: number }
  | { kind: "error"; message: string };

const STORAGE_KEY = (m: Mode) => `ck-unsent-idea-${m}`;

function readLocal(m: Mode): string {
  try {
    return localStorage.getItem(STORAGE_KEY(m)) ?? "";
  } catch {
    return "";
  }
}
function writeLocal(m: Mode, v: string) {
  try {
    if (v.trim()) localStorage.setItem(STORAGE_KEY(m), v);
    else localStorage.removeItem(STORAGE_KEY(m));
  } catch {
    /* privater Modus: kein Zwischenspeicher */
  }
}

/**
 * Gedanken festhalten. Gespeichert ist ein Gedanke erst, wenn der Server es bestätigt.
 * Bis dahin bleibt der Text im Feld und – nur als Zwischenstand in diesem Browser – lokal erhalten.
 * Das ist KEINE Offline-Speicherung im Social Media Manager.
 */
export function QuickCapture({ accounts, mode = "schnell", autoFocus = false }: { accounts: Pick<Account, "id" | "platform" | "display_name">[]; mode?: Mode; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [restored, setRestored] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const saved = readLocal(mode);
    if (saved) {
      setText(saved);
      setRestored(true);
    }
  }, [mode]);

  const onChange = (v: string) => {
    setText(v);
    writeLocal(mode, v);
    if (status.kind === "error") setStatus({ kind: "idle" });
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!text.trim() || status.kind === "saving") return;
    if (!navigator.onLine) {
      setStatus({ kind: "error", message: "Keine Verbindung – nicht gespeichert. Dein Text bleibt hier im Feld (nur in diesem Browser), bis du erneut auf „Speichern“ tippst." });
      return;
    }
    setStatus({ kind: "saving" });
    const fd = new FormData(e.currentTarget);
    fd.set("body", text);
    fd.set("mode", mode);
    let r: CaptureResult;
    try {
      r = await captureIdeaAction(fd);
    } catch {
      setStatus({ kind: "error", message: "Nicht gespeichert – der Social Media Manager war nicht erreichbar. Dein Text ist noch hier im Feld." });
      return;
    }
    if (!r.ok) {
      setStatus({ kind: "error", message: r.error });
      return;
    }
    writeLocal(mode, "");
    setText("");
    setRestored(false);
    formRef.current?.reset();
    setStatus({ kind: "saved", id: r.id, savedAt: r.savedAt, chars: r.chars });
  };

  if (status.kind === "saved" && mode === "ruhig") {
    return (
      <div className="calm-done" role="status" aria-live="polite">
        <div className="calm-check" aria-hidden="true">✓</div>
        <p className="calm-title">Gespeichert.</p>
        <p className="muted">{formatDateTime(status.savedAt)} · {status.chars} Zeichen im Originalwortlaut</p>
        <p className="muted">Nichts weiter zu tun.</p>
        <button type="button" className="btn ghost" onClick={() => setStatus({ kind: "idle" })}>Noch ein Gedanke</button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="stack capture">
      <label htmlFor={`capture-${mode}`} className="sr">Gedanke</label>
      <textarea
        id={`capture-${mode}`}
        name="body"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        required
        maxLength={10000}
        autoFocus={autoFocus}
        autoCapitalize="sentences"
        autoCorrect="on"
        spellCheck
        enterKeyHint="enter"
        className={mode === "ruhig" ? "calm-input" : undefined}
        placeholder={mode === "ruhig" ? "Gedanke …" : "Was geht dir gerade durch den Kopf? Tippen oder über das Mikrofon der Tastatur diktieren."}
        aria-describedby={`capture-status-${mode}`}
      />
      {restored && status.kind !== "saved" ? <p className="small notice warn">Ungespeicherter Text von vorhin wiederhergestellt – noch nicht gespeichert.</p> : null}

      {mode === "schnell" ? (
        <details>
          <summary className="small">Mehr (optional): Titel, Tags, Accounts</summary>
          <div className="grid grid-2" style={{ marginTop: 8 }}>
            <div><label htmlFor="cap-title">Titel</label><input id="cap-title" name="title" type="text" maxLength={200} /></div>
            <div><label htmlFor="cap-tags">Tags</label><input id="cap-tags" name="tags" type="text" maxLength={500} autoCapitalize="none" /></div>
          </div>
          <div className="checks" style={{ marginTop: 8 }}>
            {accounts.map((a) => (
              <label key={a.id} className="check"><input type="checkbox" name="account_ids" value={a.id} /> {a.display_name} <span className="muted">· {PLATFORMS[a.platform] ?? a.platform}</span></label>
            ))}
          </div>
        </details>
      ) : null}

      <div className="row">
        <button type="submit" className="btn primary" disabled={status.kind === "saving" || !text.trim()}>
          {status.kind === "saving" ? "Speichert …" : "Speichern"}
        </button>
        {mode === "schnell" ? <Link href="/neu?modus=ruhig" className="btn ghost small">Ruhiger Modus</Link> : null}
      </div>

      <div id={`capture-status-${mode}`} role="status" aria-live="polite">
        {status.kind === "saved" ? (
          <p className="notice ok small">Gespeichert · {formatDateTime(status.savedAt)} · {status.chars} Zeichen im Originalwortlaut. <Link href={`/ideen/${status.id}`}>Idee öffnen</Link></p>
        ) : null}
        {status.kind === "error" ? <p className="notice danger small">{status.message}</p> : null}
      </div>
    </form>
  );
}
