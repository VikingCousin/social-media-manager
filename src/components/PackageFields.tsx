import { PACKAGE_LABELS, drivingRisk, type ContentPackage } from "@/lib/package";

function Field({ name, label, value, rows = 2, hint }: { name: string; label: string; value: string; rows?: number; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <textarea id={name} name={name} defaultValue={value} rows={rows} style={{ minHeight: rows * 26 + 20 }} maxLength={6000} />
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

/** Eingabefelder des Content-Pakets (ohne Skript/Titel – die liegen in drafts.body/title). */
export function PackageFields({ pkg }: { pkg: ContentPackage }) {
  const risk = drivingRisk(pkg);
  const list = (v: string[]) => v.join("\n");
  return (
    <div className="pkg">
      <input type="hidden" name="pkg_present" value="1" />
      <fieldset className="pkg-group">
        <legend>Kanal</legend>
        <Field name="pkg_account_reason" label={PACKAGE_LABELS.account_reason} value={pkg.account_reason} />
        <Field name="pkg_alternative" label={PACKAGE_LABELS.alternative} value={pkg.alternative} rows={1} />
      </fieldset>
      <fieldset className="pkg-group">
        <legend>Idee</legend>
        <Field name="pkg_angle" label={PACKAGE_LABELS.angle} value={pkg.angle} />
        <Field name="pkg_effect" label={PACKAGE_LABELS.effect} value={pkg.effect} rows={1} hint="Was soll beim Zuschauen ankommen? Keine Reichweiten-Versprechen." />
      </fieldset>
      <fieldset className="pkg-group">
        <legend>Einstieg</legend>
        <Field name="pkg_hook_spoken" label={PACKAGE_LABELS.hook_spoken} value={pkg.hook_spoken} />
        <Field name="pkg_hook_text" label={PACKAGE_LABELS.hook_text} value={pkg.hook_text} rows={1} />
        <Field name="pkg_hook_visual" label={PACKAGE_LABELS.hook_visual} value={pkg.hook_visual} />
        <Field name="pkg_hook_combo" label={PACKAGE_LABELS.hook_combo} value={pkg.hook_combo} />
      </fieldset>
      <fieldset className="pkg-group">
        <legend>Ablauf</legend>
        <Field name="pkg_throughline" label={`${PACKAGE_LABELS.throughline} (ein Schritt pro Zeile)`} value={list(pkg.throughline)} rows={4} />
      </fieldset>
      <fieldset className="pkg-group">
        <legend>Drehplan</legend>
        {risk ? <p className="notice danger small">Achtung: Ein Hinweis klingt nach Filmen oder Skriptbedienung während der Fahrt. Bitte nur zu Hause, draußen oder im geparkten Auto drehen.</p> : null}
        <Field name="pkg_shoot_say" label={PACKAGE_LABELS.shoot_say} value={pkg.shoot_say} rows={3} />
        <Field name="pkg_shoot_show" label={PACKAGE_LABELS.shoot_show} value={pkg.shoot_show} rows={2} />
        <Field name="pkg_shoot_broll" label={PACKAGE_LABELS.shoot_broll} value={pkg.shoot_broll} rows={2} />
        <Field name="pkg_shoot_location" label={PACKAGE_LABELS.shoot_location} value={pkg.shoot_location} rows={1} hint="Zu Hause, draußen oder im geparkten Auto – nie während der Fahrt." />
      </fieldset>
      <fieldset className="pkg-group">
        <legend>Veröffentlichungstext</legend>
        <Field name="pkg_caption" label={PACKAGE_LABELS.caption} value={pkg.caption} rows={4} />
      </fieldset>
      <fieldset className="pkg-group">
        <legend>Was noch fehlt</legend>
        <Field name="pkg_questions" label={`${PACKAGE_LABELS.questions} (eine pro Zeile)`} value={list(pkg.questions)} rows={3} hint="Antworten trägst du am besten in die Notizen der Idee ein – sie fließen in die nächste Ausarbeitung ein." />
        <Field name="pkg_examples_needed" label={`${PACKAGE_LABELS.examples_needed} (eines pro Zeile)`} value={list(pkg.examples_needed)} rows={2} />
      </fieldset>
    </div>
  );
}
