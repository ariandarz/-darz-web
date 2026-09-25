/**
 * MembershipSheet — `DZ.viewMemberships()` (app.html:10303-10341), the private
 * room's access tiers, opened from the Settings › Membership row (:9923-9927).
 *
 * Ported in the old sheet's own order: the seam + "Membership" eyebrow + the
 * heading that changes once you are a member, the lede, the active-membership
 * (or "Membership ended") block, the redeem box, the billing-period segment,
 * the two tier cards, and the closing "nothing is charged in the app" line —
 * each string verbatim.
 *
 * ## Where the membership comes from
 *
 * The old app kept `{code, plan, expiry}` on the device
 * (`localStorage.darz_membership`, :10272) and re-validated it best-effort
 * (`dzMembRevalidate`, :10285). Here the server answers:
 * `GET /api/auth/my-membership/` (G-MEMB-3/6/7) gives `{tier, status,
 * active_until}`, read by the Settings page (`useMyMembership`) and passed in,
 * and re-read after a redeem — so a code the owner revoked stops reading
 * "active" on the next open, not after a lucky network call.
 * `membership.ts` turns it into the old two states.
 *
 * **One line of the old block is not built:** "Code DZ-P-…" (:10317). The
 * summary does not return the redeemed code, so there is nothing to print —
 * a flag, not an invention (CLAUDE.md rule 6).
 *
 * The plan is labelled from `GET /api/options/` (`accounts.collector_tier`),
 * never the old app's basic/premium mapping — see `tiers.ts` for why that
 * would print "Basic Access" for a VIP.
 */
import { useCallback, useState } from 'react';
import { Button, Sheet, Toast } from '../../components';
import { useApi, useOptions, useSession } from '../../api/hooks';
import type { Choice, MyMembership } from '../../api/types';
import { settingString } from '../shell/ownerSettings';
import { formatUntil, membershipState } from './membership';
import { TIERS, type Term, tierPrice, whatsappLink } from './tiers';
import './membership.css';

const TERMS: ReadonlyArray<readonly [Term, string]> = [
  ['1', '1 month'],
  ['6', '6 months · save 10%'],
];

const TICK = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const WA = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.2-5.5A8.4 8.4 0 1 1 21 11.5z" />
  </svg>
);

export function MembershipSheet({
  open,
  onClose,
  membership,
  onRedeemed,
}: {
  open: boolean;
  onClose: () => void;
  /** The `my-membership` summary; `undefined` while it loads, `null` if it
   * failed — both read as "no membership". */
  membership: MyMembership | null | undefined;
  /** Re-read the summary after a successful redeem. */
  onRedeemed: () => Promise<unknown>;
}) {
  const { auth } = useApi();
  const { me } = useSession();
  const options = useOptions();
  const [term, setTerm] = useState<Term>('1');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const state = membershipState(membership);

  /** The plan's own label, from `GET /api/options/`. */
  const planLabel = (plan: string): string => {
    const tiers = (options?.['accounts.collector_tier'] as Choice[] | undefined) ?? [];
    return tiers.find((c) => c.value === plan)?.label ?? plan;
  };

  const redeem = async () => {
    const value = code.trim().toUpperCase();
    if (!value) {
      setMsg({ text: 'Enter the access code Darz sent you.', ok: false });
      return;
    }
    setBusy(true);
    setMsg({ text: 'Checking…', ok: true });
    try {
      const result = await auth.redeemMembership(value);
      // Reload the session and the summary: the redeem changed this
      // collector's `tier` server-side, and the sheet re-renders from the
      // server's answer — the old `DZ.viewMemberships()` re-open (:10356).
      await Promise.all([auth.me(), onRedeemed()]);
      setCode('');
      setMsg(null);
      // `Lib.toast('✓ '+dzMembPlanLabel(row.plan)+' activated')` (:10355)
      setToast(`✓ ${planLabel(result.plan)} activated`);
    } catch {
      // The old sheet distinguishes a rejected code from a failed request
      // because its RPC does. This client cannot tell a 400 "not recognised"
      // from a dead connection without reading the error body, so it says the
      // thing that is true of both and names the recovery.
      setMsg({
        text: 'Code not recognised, or it could not be checked. Check it, or contact Darz.',
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet open={open} onClose={onClose} className="mb-sheet">
        <div className="mb-head">
          <div className="mb-seam" />
          <div className="mb-eyebrow">Membership</div>
          <h3 className="mb-h">
            {state.kind === 'active' ? 'Your membership' : 'Choose your access'}
          </h3>
          <p className="mb-lede">
            A private room for selected collectors. Both tiers include auctions; Premium adds
            earlier access and more personal attention.
          </p>
        </div>

        {/* The persistent "Active membership" block (:10313-10318) and the
          "Membership ended" one (:10320-10323). */}
        {state.kind === 'active' && (
          <div className="mb-active">
            <div className="mb-active-lab">Active membership</div>
            <div className="mb-active-plan">{planLabel(state.tier)}</div>
            <div className="mb-active-sub">
              {state.until && formatUntil(state.until)
                ? `Active until ${formatUntil(state.until)}`
                : 'Active'}
            </div>
          </div>
        )}
        {state.kind === 'ended' && (
          <div className="mb-ended">
            <div className="mb-ended-lab">Membership ended</div>
            <div className="mb-ended-p">
              Your {planLabel(state.tier)} ended {formatUntil(state.until) ?? '—'}. Renew below
              and activate the code Darz sends you.
            </div>
          </div>
        )}

        <div className="mb-redeem">
          <div className="mb-redeem-t">
            {state.kind === 'active' ? 'Enter a new access code' : 'Have an access code?'}
          </div>
          <div className="mb-redeem-s">
            After payment, Darz sends an access code over WhatsApp or chat. Enter it to
            activate.
          </div>
          <div className="mb-redeem-row">
            <input
              className="mb-code"
              placeholder="e.g. DZ-P-XXXXXX"
              aria-label="Access code"
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              disabled={busy}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void redeem();
                }
              }}
            />
            <Button className="mb-activate" disabled={busy} onClick={() => void redeem()}>
              Activate
            </Button>
          </div>
          {msg && (
            <div className={`mb-msg${msg.ok ? ' ok' : ' err'}`} role="status">
              {msg.text}
            </div>
          )}
        </div>

        <div className="mb-term">
          <div className="mb-term-lab">Billing period</div>
          <div className="mb-term-seg" role="group" aria-label="Billing period">
            {TERMS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={term === value ? 'on' : undefined}
                aria-pressed={term === value}
                onClick={() => setTerm(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-tiers">
          {TIERS.map((t) => {
            const price = tierPrice(t, term);
            const link = whatsappLink(
              settingString('whatsapp', ''),
              t.label,
              term,
              me?.display_name || me?.name || '',
            );
            return (
              <div className="mb-tier" key={t.id}>
                <div className="mb-seam" />
                <div className="mb-tier-eyebrow">{t.eyebrow}</div>
                <div className="mb-tier-label">{t.label}</div>
                <div className="mb-price">
                  <span className="v">{price.ir}</span>
                  <span className="r">Iran</span>
                </div>
                <div className="mb-price intl">
                  <span className="v">{price.intl}</span>
                  <span className="r">International</span>
                </div>
                {price.save && <div className="mb-save">10% discount applied · 6 months</div>}
                <div className="mb-rule" />
                <div className="mb-includes">
                  {t.includes.map((li) => (
                    <div className="mb-inc" key={li}>
                      <span className="tk">{TICK}</span>
                      <span>{li}</span>
                    </div>
                  ))}
                </div>
                {link ? (
                  <a className="mb-wa" href={link} target="_blank" rel="noopener noreferrer">
                    {WA}
                    <span>Subscribe via WhatsApp</span>
                  </a>
                ) : (
                  <div className="mb-nowa">Contact Darz to subscribe.</div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mb-foot">
          Payment is arranged over WhatsApp or chat — nothing is charged in the app. Questions?
          Message Darz.
        </p>
      </Sheet>
      <Toast message={toast ?? ''} open={toast !== null} onClose={closeToast} />
    </>
  );
}
