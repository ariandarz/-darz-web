/**
 * CollectorForm — create and edit share one form, because the writable field
 * set is one thing: `CollectorAdminSerializer`'s
 * display_name / full_name / email / phone / city / tier / access_status /
 * notes. `preferences` is deliberately absent — it is the collector's own app
 * state (saved filters, consents), not the admin's to type over; the old desk
 * never edited its equivalent either.
 *
 * Editing carries the row's `version` and a stale write's 409 surfaces as the
 * form's error with the server's own message — the Phase 7 optimistic-lock
 * rule, same as the request desk's transition.
 */
import { useState } from 'react';
import { useApi, useOptions } from '../../api/hooks';
import type { Choice, CollectorAdmin } from '../../api/types';
import { isConflict } from './kit';
import './admin.css';

type Draft = Pick<
  CollectorAdmin,
  | 'display_name'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'city'
  | 'tier'
  | 'access_status'
  | 'notes'
>;

function draftOf(c: CollectorAdmin | null): Draft {
  return {
    display_name: c?.display_name ?? '',
    full_name: c?.full_name ?? '',
    email: c?.email ?? '',
    phone: c?.phone ?? '',
    city: c?.city ?? '',
    tier: c?.tier ?? null,
    access_status: c?.access_status ?? 'invited',
    notes: c?.notes ?? '',
  };
}

export function CollectorForm({
  title,
  existing = null,
  onClose,
  onSaved,
}: {
  title: string;
  /** null = create; a row = edit (its `version` rides on the PATCH) */
  existing?: CollectorAdmin | null;
  onClose: () => void;
  onSaved: (saved: CollectorAdmin) => void;
}) {
  const { adminAccounts } = useApi();
  const options = useOptions();
  const [draft, setDraft] = useState<Draft>(() => draftOf(existing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tiers = (options?.['accounts.collector_tier'] as Choice[] | undefined) ?? [];
  const statuses =
    (options?.['accounts.collector_access_status'] as Choice[] | undefined) ?? [];

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  const save = async () => {
    if (busy) return;
    if (!draft.display_name?.trim()) {
      setError('A display name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = existing
        ? await adminAccounts.updateCollector(existing.id, {
            ...draft,
            expected_version: existing.version,
          })
        : await adminAccounts.createCollector(draft);
      onSaved(saved);
    } catch (err: unknown) {
      // A 409 means someone else saved this collector while the form was
      // open. Saying "Could not save." would send the admin back to press the
      // button again on a form that is now stale — the fix is to reopen the
      // record, not to retry (TD-5's rule, applied here for the first time:
      // this form sent no lock at all until 2026-09-22, see
      // `AdminAccountsService.updateCollector`).
      setError(
        isConflict(err)
          ? 'Someone else saved this collector while you were editing. Close and reopen the record to see their changes before saving again.'
          : err instanceof Error
            ? err.message
            : 'Could not save.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">{title}</div>
      <div className="ad-form-grid">
        <Field label="Display name">
          <input
            value={draft.display_name ?? ''}
            onChange={(e) => set({ display_name: e.target.value })}
            autoFocus={!existing}
          />
        </Field>
        <Field label="Full name">
          <input
            value={draft.full_name ?? ''}
            onChange={(e) => set({ full_name: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={draft.email ?? ''}
            onChange={(e) => set({ email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input value={draft.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="City">
          <input value={draft.city ?? ''} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="Tier">
          <select
            value={draft.tier ?? ''}
            onChange={(e) => set({ tier: (e.target.value || null) as Draft['tier'] })}
          >
            <option value="">—</option>
            {tiers.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Access status">
          <select
            value={draft.access_status ?? 'invited'}
            onChange={(e) => set({ access_status: e.target.value as Draft['access_status'] })}
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes" wide>
          <textarea
            rows={3}
            value={draft.notes ?? ''}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>
      </div>
      {error && (
        <p className="dz-state err" role="alert">
          {error}
        </p>
      )}
      <div className="ad-form-a">
        <button type="button" className="ad-ghostbtn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="ad-action"
          onClick={() => void save()}
          disabled={busy}
        >
          {existing ? 'Save changes' : 'Create collector'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`ad-field${wide ? ' ad-field--wide' : ''}`}>
      <span className="ad-filter-l">{label}</span>
      {children}
    </label>
  );
}
