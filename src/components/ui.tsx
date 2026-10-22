import Link from "next/link";
import { PLATFORMS, STATUS_LABELS, type Account, type DraftStatus } from "@/lib/domain";

export function PageHead({ title, intro, children }: { title: string; intro?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {intro ? <p>{intro}</p> : null}
      </div>
      {children ? <div className="row">{children}</div> : null}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

const STATUS_TONE: Record<DraftStatus, string> = {
  idee: "",
  entwurf: "",
  bereit: "warn",
  freigegeben: "accent",
  geplant: "accent",
  veroeffentlicht: "ok",
};

export function StatusBadge({ status }: { status: DraftStatus }) {
  return <span className={`badge ${STATUS_TONE[status] ?? ""}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function AccountChip({ account }: { account?: Pick<Account, "id" | "platform" | "display_name" | "handle"> | null }) {
  if (!account) return <span className="badge">Kein Account</span>;
  return (
    <Link href={`/accounts/${account.id}`} className="badge accent" title={account.handle}>
      {PLATFORMS[account.platform] ?? account.platform} · {account.display_name}
    </Link>
  );
}

export function Tags({ tags }: { tags: string }) {
  const list = tags.split(",").filter(Boolean);
  if (!list.length) return null;
  return (
    <span className="row" style={{ gap: 4 }}>
      {list.map((t) => (
        <Link key={t} href={`/ideen?tag=${encodeURIComponent(t)}`} className="tag">
          #{t}
        </Link>
      ))}
    </span>
  );
}

export function Metric({ value, decimals = 0 }: { value: number | null; decimals?: number }) {
  if (value === null || value === undefined) return <span className="unknown">unbekannt</span>;
  return <>{value.toLocaleString("de-DE", { maximumFractionDigits: decimals })}</>;
}
