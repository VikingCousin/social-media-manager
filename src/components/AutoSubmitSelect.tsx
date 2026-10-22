"use client";

/** Select, das sein Formular bei Änderung sofort absendet (spart auf dem iPhone einen Tipp). */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
