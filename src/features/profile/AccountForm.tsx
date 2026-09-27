/**
 * AccountForm — the "Account details" card of Profile › Account, port of
 * `profAccountHTML` (app.html:9765-9788): Full name · Phone · City text fields
 * (`field(…)`, :9767-9768 — label `PF_LST`, input `PF_FST`, :9440-9441) and the
 * "Preferred communication language" custom dropdown (`dzSel('uLangSel', …)`,
 * :9784) with its "For WhatsApp communication with Darz." note (:9786). Copy
 * and placeholders verbatim ("Your name", "09…", "Tehran", "Select language").
 *
 * The fields are the shared `Input` (whose `.dz-field` / `.dz-field-label`
 * are the same recipe as `PF_FST` / `PF_LST`: 16px, 11×13 padding, radius 10,
 * a 9px 0.12em uppercase label) and `Dropdown` (the `dzSel` port).
 *
 * What the backend takes, and the Email field the old card also had, are in
 * `account.ts`'s header: four fields, no email (flagged).
 *
 * ## When it saves
 *
 * The old card saved **on every keystroke** (`oninput="DZ.profileEdit(this)"`,
 * :11146) — cheap there, because it wrote `localStorage`. Here a save is a
 * network write, so a text field saves **when the collector leaves it** (blur,
 * or Enter), only if its value changed; the language saves **the moment it is
 * picked**, as `DZ.setCommLang` did (:11427). A successful save shows the old
 * `Lib.toast('Saved')` (:11427) — the one confirmation the old card had, used
 * for every field so a network save is never silent. A rejected value keeps
 * what was typed and shows the server's message under that field
 * (`ValidationError.fields`); any other failure shows its message there too.
 * There is no Save button: the old card had none, and the design package's
 * capture (`18-profile-account`) shows none.
 */
import { useCallback, useState } from 'react';
import { useApi, useOptions, useSession } from '../../api/hooks';
import { ValidationError } from '../../api/errors';
import { Dropdown, Input, Toast } from '../../components';
import {
  type AccountField,
  type AccountValues,
  accountPatch,
  accountValues,
  languageOptions,
} from './account';

type TextField = Exclude<AccountField, 'preferred_language'>;

const TEXT_FIELDS: ReadonlyArray<
  readonly [field: TextField, label: string, placeholder: string, type: string]
> = [
  ['full_name', 'Full name', 'Your name', 'text'],
  ['phone', 'Phone', '09…', 'tel'],
  ['city', 'City', 'Tehran', 'text'],
];

export function AccountForm() {
  const { auth } = useApi();
  const { me } = useSession();
  const options = useOptions();
  // Seeded once from the session; after a save the session's `me` is the
  // server's answer, and the field already shows what was saved.
  const [values, setValues] = useState<AccountValues>(() => accountValues(me));
  const [errors, setErrors] = useState<Partial<Record<AccountField, string>>>({});
  const [saving, setSaving] = useState<AccountField | null>(null);
  const [toast, setToast] = useState(false);
  const closeToast = useCallback(() => setToast(false), []);

  const save = async (field: AccountField, value: string) => {
    const body = accountPatch({ [field]: value }, me);
    if (Object.keys(body).length === 0) {
      setErrors((e) => ({ ...e, [field]: undefined }));
      return;
    }
    setSaving(field);
    try {
      await auth.updateMe(body);
      setErrors((e) => ({ ...e, [field]: undefined }));
      setToast(true);
    } catch (err: unknown) {
      const message =
        err instanceof ValidationError
          ? (err.fields[field]?.[0] ?? err.message)
          : err instanceof Error
            ? err.message
            : 'Could not save. Try again.';
      setErrors((e) => ({ ...e, [field]: message }));
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <div className="pf-grp">Account details</div>
      <div className="pf-card pf-form">
        {TEXT_FIELDS.map(([field, label, placeholder, type]) => (
          <Input
            key={field}
            id={`pf-${field}`}
            name={field}
            type={type}
            label={label}
            placeholder={placeholder}
            value={values[field]}
            error={errors[field]}
            aria-busy={saving === field || undefined}
            onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
            onBlur={(e) => void save(field, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        ))}
        <div className="pf-lang">
          <span className="dz-field-label">Preferred communication language</span>
          <Dropdown
            label="Preferred communication language"
            placeholder="Select language"
            options={languageOptions(options)}
            value={values.preferred_language}
            disabled={saving === 'preferred_language'}
            onChange={(v) => {
              setValues((s) => ({ ...s, preferred_language: v }));
              void save('preferred_language', v);
            }}
          />
          {errors.preferred_language && (
            <p className="dz-field-err">{errors.preferred_language}</p>
          )}
          <div className="pf-note">For WhatsApp communication with Darz.</div>
        </div>
      </div>
      <Toast message="Saved" open={toast} onClose={closeToast} />
    </>
  );
}
