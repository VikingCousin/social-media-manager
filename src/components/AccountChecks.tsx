import { PLATFORMS, type Account } from "@/lib/domain";

export function AccountChecks({ accounts, selected, name = "account_ids", short = false }: { accounts: Account[]; selected: number[]; name?: string; short?: boolean }) {
  if (!accounts.length) return <p className="muted small">Noch keine Accounts angelegt.</p>;
  return (
    <div className="checks">
      {accounts.map((a) => (
        <label key={a.id} className="check">
          <input type="checkbox" name={name} value={a.id} defaultChecked={selected.includes(a.id)} />
          {short ? <>{a.display_name} <span className="muted">· {PLATFORMS[a.platform] ?? a.platform}</span></> : <>{PLATFORMS[a.platform] ?? a.platform} · {a.display_name}</>}
        </label>
      ))}
    </div>
  );
}

export function AccountSelect({ accounts, value, name = "account_id", allowEmpty = true, required = false }: { accounts: Account[]; value: number | null; name?: string; allowEmpty?: boolean; required?: boolean }) {
  return (
    <select name={name} defaultValue={value ?? ""} required={required}>
      {allowEmpty ? <option value="">– noch kein Account –</option> : null}
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {PLATFORMS[a.platform] ?? a.platform} · {a.display_name} {a.handle.startsWith("@") ? a.handle : ""}
        </option>
      ))}
    </select>
  );
}
