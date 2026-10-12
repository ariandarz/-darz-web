/**
 * The Team tab's "Pricelist approvals" box (`_teamTabHTML`, `darz-studio.html:
 * 19339-19341`) over the W4 inbox, which the page shell owns (it also drives
 * the Team tab's badge).
 *
 * Approve is the gallery endpoint the partner page already uses —
 * `setPricelistStatus(id, 'accepted')` — then the inbox is re-read. The old
 * toast is kept ("Pricelist approved — they can print now", `:37146`).
 *
 * **Reject is shown, disabled, with the reason** (owner decision 2026-10-12).
 * The old desk set `rejected`; a gallery pricelist here has only
 * `submitted · accepted · superseded` (`GalleryPricelist.STATUS_CHOICES`), so
 * there is nothing true for the button to send. Backend gap G-TEAM-2.
 */
import { useState } from 'react';
import { useApi } from '../../../api/hooks';
import type { PricelistApproval } from '../../../api/types';
import { cx } from '../../../lib/cx';

const REJECT_REASON =
  'Not available yet — a gallery pricelist has no “rejected” state on the server (only submitted, accepted or superseded).';

export function PricelistApprovals({
  rows,
  loading,
  error,
  onChanged,
  say,
}: {
  rows: readonly PricelistApproval[];
  loading: boolean;
  error: string | null;
  /** re-read the inbox (the shell's controller) */
  onChanged: () => void;
  say: (message: string) => void;
}) {
  const { galleryAdmin } = useApi();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const waiting = rows.length;

  const approve = async (p: PricelistApproval) => {
    setBusyId(p.id);
    setActionError(null);
    try {
      await galleryAdmin.setPricelistStatus(p.id, 'accepted');
      say('Pricelist approved — they can print now');
      onChanged();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not approve the pricelist.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={cx('ad-card ws-pa', waiting > 0 && 'is-waiting')}>
      <div className="ws-pa-h">
        Pricelist approvals
        {waiting > 0 && (
          <>
            {' '}
            <span className="ws-pa-badge">{waiting} waiting</span>
          </>
        )}
      </div>
      {actionError && (
        <p className="dz-state err" role="alert">
          {actionError}
        </p>
      )}
      {waiting > 0 ? (
        rows.map((p) => {
          // `From {submitter} · {key} · {when}` (:19341): the submitting link's
          // name, then its contact, then when it was sent.
          const from = [p.link.name, p.link.contact_name].filter(Boolean).join(' · ') || '—';
          return (
            <div className="ws-pa-row" key={p.id} aria-busy={busyId === p.id || undefined}>
              <div className="ws-pa-main">
                <div className="ws-pa-t">{p.title || 'Pricelist'}</div>
                <div className="ws-pa-from">
                  From {from} · {new Date(p.submitted_at).toLocaleString()}
                </div>
              </div>
              <div className="ws-pa-acts">
                <button
                  type="button"
                  className="ws-addbtn"
                  disabled={busyId === p.id}
                  onClick={() => void approve(p)}
                >
                  Approve
                </button>
                <button type="button" className="ws-x" disabled title={REJECT_REASON}>
                  Reject
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <div className="ws-pa-none" role={error ? 'alert' : undefined}>
          {error
            ? error
            : loading
              ? 'Loading…'
              : 'No pricelists waiting. When a teammate or dealer sends one, it appears here for your confirmation before they can print.'}
        </div>
      )}
    </div>
  );
}
