/**
 * The Team tab's "Pricelist approvals" box (`_teamTabHTML`, `darz-studio.html:
 * 19339-19341`) over the W4 inbox, which the page shell owns (it also drives
 * the Team tab's badge).
 *
 * Both buttons are the gallery endpoint the partner page already uses —
 * `setPricelistStatus(id, …)` — then the inbox is re-read (the row leaves it,
 * being no longer `submitted`). The old toasts are kept (`:37146-37147`):
 *  - Approve → `accepted`, "Pricelist approved — they can print now";
 *  - Reject → `rejected`, "Pricelist rejected". The backend gained that status
 *    for this button (G-TEAM-2, `darz-backend-api#91`); unlike accepting, it
 *    leaves the gallery's current accepted list alone. Until it did, Reject
 *    was shown disabled with the reason.
 */
import { useState } from 'react';
import { useApi } from '../../../api/hooks';
import type { GalleryPricelistStatus, PricelistApproval } from '../../../api/types';
import { cx } from '../../../lib/cx';

/** What each button sends, and the old desk's toast for it. */
const ACTIONS: Record<
  'approve' | 'reject',
  { status: GalleryPricelistStatus; done: string; failed: string }
> = {
  approve: {
    status: 'accepted',
    done: 'Pricelist approved — they can print now',
    failed: 'Could not approve the pricelist.',
  },
  reject: {
    status: 'rejected',
    done: 'Pricelist rejected',
    failed: 'Could not reject the pricelist.',
  },
};

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

  const act = async (p: PricelistApproval, action: keyof typeof ACTIONS) => {
    const { status, done, failed } = ACTIONS[action];
    setBusyId(p.id);
    setActionError(null);
    try {
      await galleryAdmin.setPricelistStatus(p.id, status);
      say(done);
      onChanged();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : failed);
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
                  onClick={() => void act(p, 'approve')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="ws-x"
                  disabled={busyId === p.id}
                  onClick={() => void act(p, 'reject')}
                >
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
