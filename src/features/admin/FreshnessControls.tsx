/**
 * The source-freshness controls a work tile carries (G-CAT-9) — the old
 * `spConfirmRow` (`darz-studio.html:27072-27082`, v736): the freshness pill,
 * the one-tap **Confirm** (stamps today) and the small **Update…** picker that
 * confirms AND records what the source said.
 *
 * The pill's text is the row's own `freshness.label` — the server writes the
 * old tile's words ("Confirmed 12d ago", "Needs update", "Not confirmed 75d",
 * "Risky · 120d", "Awaiting first confirm"); its colour is the band
 * (`.sp-fresh.<state>`, `:9665-9686`).
 *
 * The write half both desks share is `useConfirmAvailable.ts`.
 */
import type { ArtworkAdmin, ArtworkFreshness } from '../../api/types';
import { confirmAsOptions, freshTitle, type ConfirmAs } from './freshness';

export function FreshPill({ f }: { f: ArtworkFreshness | null | undefined }) {
  if (!f?.label) return null;
  return (
    <span className={`sp-fresh ${f.state}`} title={freshTitle(f.confirmed_at)}>
      {f.label}
    </span>
  );
}

/** `:27076-27080` — pill · Confirm · Update…, under a work that takes part. */
export function ConfirmRow({
  work,
  busy,
  onConfirm,
  onConfirmAs,
}: {
  work: ArtworkAdmin;
  busy: boolean;
  onConfirm: () => void;
  onConfirmAs: (as: ConfirmAs) => void;
}) {
  return (
    <div className="sp-confirm">
      <FreshPill f={work.freshness} />
      <button
        type="button"
        className="sp-cbtn"
        title="Mark this work confirmed available as of today"
        disabled={busy}
        onClick={onConfirm}
      >
        Confirm
      </button>
      <select
        className="sp-cstat"
        title="Confirm with a status update from the source"
        aria-label="Confirm with a status update from the source"
        value=""
        disabled={busy}
        onChange={(e) => {
          if (e.target.value) onConfirmAs(e.target.value as ConfirmAs);
        }}
      >
        <option value="">Update…</option>
        {confirmAsOptions(String(work.availability_status ?? '')).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
