/**
 * ConfirmDialog — the panel's confirm step, generalising the old panel's own
 * `dzConfirm(message, {okLabel})` (used at `darz-studio.html:37370` for
 * "Decline this access request?" and throughout the destructive actions).
 *
 * The old helper took a message and an OK label and resolved a promise; the
 * same two pieces are the props here. Keeping the shape means the copy ports
 * one-for-one when each desk lands.
 *
 * `danger` is the one addition: several of the actions behind this are
 * irreversible (revoke a key, remove a team login, discard an import batch) and
 * the old panel signalled that with a red control inline rather than in the
 * confirm. Carrying it into the confirm is a mechanics change — same actions,
 * same wording, the warning just arrives with the question instead of before it.
 */
import type { ReactNode } from 'react';
import '../admin.css';

export function ConfirmDialog({
  message,
  okLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  message: ReactNode;
  okLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="ad-confirm-wrap" role="dialog" aria-modal="true">
      <div className="ad-confirm">
        <p className="ad-confirm-m">{message}</p>
        <div className="ad-confirm-a">
          <button type="button" className="ad-confirm-no" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`ad-confirm-ok${danger ? ' is-danger' : ''}`}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
