/**
 * The access-key expiry cell — the old Access desk's `expCell`
 * (`darz-studio.html:33042`): Never / Expired / "Expires today" / "*n*d left"
 * in its three colours (red / amber / green), the date underneath. Shared by
 * the collector detail's key list and the owner Access desk (Phase 8); the day
 * maths is `expiryParts`.
 */
import { expiryParts } from './expiry';
import './admin.css';

export function ExpiryCell({ expiresAt }: { expiresAt: string | null }) {
  const { label, tone } = expiryParts(expiresAt);
  return (
    <>
      <span className={`ad-exp is-${tone}`}>{label}</span>
      {expiresAt && (
        <span className="ad-cellsub">{new Date(expiresAt).toLocaleDateString('en-GB')}</span>
      )}
    </>
  );
}
