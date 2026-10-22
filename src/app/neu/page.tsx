import Link from "next/link";
import { listAccounts } from "@/server/repo";
import { PageHead } from "@/components/ui";
import { QuickCapture } from "@/components/QuickCapture";

type SP = Promise<Record<string, string | string[] | undefined>>;

/** Gedanken festhalten. Ruhiger Modus: nur Eingabe, Speichern, Bestätigung – keine Analyse, keine Rückfragen. */
export default async function QuickCapturePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const calm = sp.modus === "ruhig";
  const accounts = listAccounts().map((a) => ({ id: a.id, platform: a.platform, display_name: a.display_name }));
  if (calm) {
    return (
      <div className="calm">
        <QuickCapture accounts={accounts} mode="ruhig" autoFocus />
        <p className="small muted calm-foot"><Link href="/neu">Normaler Modus</Link></p>
      </div>
    );
  }
  return (
    <>
      <PageHead title="Neuer Gedanke" intro="Einfach festhalten – Kanal, Titel und Ausarbeitung kommen später." />
      <div className="card">
        <QuickCapture accounts={accounts} mode="schnell" autoFocus />
      </div>
    </>
  );
}
