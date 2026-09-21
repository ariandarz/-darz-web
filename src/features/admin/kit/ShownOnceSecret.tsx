/**
 * ShownOnceSecret — the panel's one answer to a credential the server will
 * never show again.
 *
 * Four endpoints return one: issuing an access key
 * (`POST /admin/collectors/{id}/access-keys/`), approving an access request
 * (`.../access-requests/{id}/approve/`), creating a team user (its generated
 * password) and issuing a membership code. All four are "never persisted,
 * never re-exposed" on the backend, in its own words. Four desks, one rule —
 * so one component, not four ad-hoc panels.
 *
 * The approve endpoint's own success message is the model for the copy:
 * *"Key issued for {name} — shown once, deliver it privately."* The three parts
 * that matters is made of are what this renders: **what it is**, **that it will
 * not come back**, and **a way to take it** without hand-transcribing.
 *
 * `navigator.clipboard` is absent on an insecure origin and can reject even
 * where it exists, so the value stays selectable text and the copy button is an
 * accelerator, never the only way out.
 */
import { useState } from 'react';
import '../admin.css';

export function ShownOnceSecret({
  label,
  value,
  /** What this unlocks and for whom — the desk's own sentence. */
  hint,
  onDismiss,
}: {
  label: string;
  value: string;
  hint?: string;
  onDismiss?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  return (
    <div className="ad-secret" role="alert">
      <div className="ad-secret-h">{label}</div>
      {hint && <p className="ad-secret-hint">{hint}</p>}
      <div className="ad-secret-row">
        {/* selectable, so a blocked clipboard is never a dead end */}
        <code className="ad-secret-v">{value}</code>
        <button type="button" className="ad-secret-copy" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="ad-secret-warn">
        Shown once — it cannot be retrieved again. Deliver it privately.
      </p>
      {onDismiss && (
        <button type="button" className="ad-secret-done" onClick={onDismiss}>
          I have saved it
        </button>
      )}
    </div>
  );
}
