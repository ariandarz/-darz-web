/**
 * MembershipSheet — `DZ.viewMemberships()` (app.html:10303-10341), the private
 * room's access tiers, opened from the Settings › Membership row (:9923-9927).
 *
 * Ported in the old sheet's own order: the seam + "Membership" eyebrow + the
 * heading that changes once you are a member, the lede, the active-membership
 * block, the redeem box, the billing-period segment, the two tier cards, and
 * the closing "nothing is charged in the app" line — each string verbatim.
 *
 * ## What this backend can and cannot answer — read this before changing it
 *
 * The old app kept the whole membership on the device
 * (`localStorage.darz_membership` = `{code, plan, name, expiry, ts}`, :10272)
 * and redeemed against a Supabase RPC. This backend's Phase 13 does the part
 * that matters properly — `POST /api/auth/membership/redeem/` validates a
 * single-use code server-side — and exposes **nothing else**. Specifically:
 *
 *  - **There is no "my membership" read.** No endpoint answers whether this
 *    collector has ever redeemed a code. `/api/auth/me/` carries `tier`, and
 *    `tier` is `CollectorTierEnum` (`vip · active · new · institutional`) —
 *    the CRM segmentation every collector already has, set by an admin on the
 *    Collectors desk whether or not any code was redeemed. Reading it as
 *    "is a member" would mark every collector a member. Backend gap
 *    **G-MEMB-6**.
 *  - **There is no expiry.** `MembershipRedeemResponse` is
 *    `{plan, tier, redeemed_at}`, so "Active until 12 Mar 2027" cannot be
 *    shown, and neither can the old sheet's "Membership ended" state, which is
 *    defined entirely by a stored expiry being in the past. **G-MEMB-3**.
 *  - **The redeemed code is not returned**, so the old block's "Code DZ-P-…"
 *    line has nothing to print.
 *
 * What follows from that, and is the whole design of this screen:
 *
 * **The persistent "Active membership" block is not built.** It would have to
 * come from a device copy, and a device copy is the exact failure the old app
 * papers over with `dzMembRevalidate` (:10285) — a code the owner revoked
 * keeps reading "active" until a network call gets through. Rather than
 * reproduce a bug this backend makes avoidable, the sheet confirms a redeem
 * **in the moment it happens**, from the server's own response, and says
 * plainly where the standing answer lives. The Settings row's green ACTIVE
 * pill is absent for the same reason — there is nothing to light it from.
 *
 * All three are flags, not deletions (CLAUDE.md rule 6): each is stated in the
 * UI's own words, and each becomes a few lines here the day the backend grows
 * a membership read.
 */
import { useState } from 'react';
import { Button, Sheet } from '../../components';
import { useApi, useOptions, useSession } from '../../api/hooks';
import type { Choice } from '../../api/types';
import { settingString } from '../shell/ownerSettings';
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

interface Redeemed {
  plan: string;
  redeemedAt: string;
}

export function MembershipSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { auth } = useApi();
  const { me } = useSession();
  const options = useOptions();
  const [term, setTerm] = useState<Term>('1');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  // Set from the redeem RESPONSE and nowhere else — this is the confirmation
  // of what just happened, not a claim about standing membership, which
  // nothing can answer (G-MEMB-6, above).
  const [redeemed, setRedeemed] = useState<Redeemed | null>(null);

  /** The redeemed plan's own label, from `GET /api/options/`. Never the old
   * app's basic/premium mapping — see `tiers.ts` for why that would print
   * "Basic Access" for a VIP. */
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
      // Reload the session: the redeem changed this collector's `tier`
      // server-side, and anything in the app reading `me.tier` should see it
      // without a sign-out.
      await auth.me();
      setCode('');
      setRedeemed({ plan: result.plan, redeemedAt: result.redeemed_at });
      setMsg(null);
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
    <Sheet open={open} onClose={onClose} className="mb-sheet">
      <div className="mb-head">
        <div className="mb-seam" />
        <div className="mb-eyebrow">Membership</div>
        <h3 className="mb-h">{redeemed ? 'Your membership' : 'Choose your access'}</h3>
        <p className="mb-lede">
          A private room for selected collectors. Both tiers include auctions; Premium adds
          earlier access and more personal attention.
        </p>
      </div>

      {/* The old sheet's persistent "Active membership" block (:10313-10318),
          shown here only for a redeem that just succeeded — nothing can answer
          it on a later open (G-MEMB-6). Its "Active until <date>" and
          "Code <code>" lines are replaced by the one honest sentence: Darz
          holds the dates. */}
      {redeemed && (
        <div className="mb-active">
          <div className="mb-active-lab">Membership activated</div>
          <div className="mb-active-plan">{planLabel(redeemed.plan)}</div>
          <div className="mb-active-sub">{formatRedeemed(redeemed.redeemedAt)}</div>
          <div className="mb-active-note">
            Darz holds your renewal date — ask in chat and we will tell you.
          </div>
        </div>
      )}

      <div className="mb-redeem">
        <div className="mb-redeem-t">
          {redeemed ? 'Enter a new access code' : 'Have an access code?'}
        </div>
        <div className="mb-redeem-s">
          After payment, Darz sends an access code over WhatsApp or chat. Enter it to activate.
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
  );
}

/** "Activated 22 Sep 2026", or the plain word when the server sent a timestamp
 * this runtime cannot parse — never a wrong date. */
function formatRedeemed(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Activated';
  return `Activated ${d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}
