import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty" style={{ marginTop: 40 }}>
      <strong>Nicht gefunden</strong>
      <p>Diesen Eintrag gibt es nicht (mehr).</p>
      <Link href="/" className="btn">Zur Übersicht</Link>
    </div>
  );
}
