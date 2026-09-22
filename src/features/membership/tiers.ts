/**
 * The two access tiers and their prices — `DZ_TIERS` / `dzTierPrice`
 * (app.html:10221-10238), verbatim.
 *
 * **These literals are the old app's own, and that is why they are here rather
 * than in `theme`.** The old app hardcodes them too: there is no `theme` key
 * for a tier, a price or an included line, so the owner changes them by
 * editing the app. A faithful port keeps that, and this file is the one place
 * to change when the owner wants them owner-editable — at which point they
 * become a `theme.*` group read through `ownerSettings`, the way the
 * questionnaire's bank already is. Recorded as **G-MEMB-4**.
 *
 * Nothing is charged in the app, in either version: payment is arranged over
 * WhatsApp or chat, and Darz issues an access code afterwards (v806's own
 * note at :10215-10219).
 */

export interface Tier {
  id: string;
  label: string;
  eyebrow: string;
  /** Toman, per month. */
  irMonthly: number;
  /** USD, per month. */
  intlMonthly: number;
  includes: string[];
}

export const TIERS: readonly Tier[] = [
  {
    id: 'basic',
    label: 'Basic Access',
    eyebrow: 'Basic',
    irMonthly: 5_000_000,
    intlMonthly: 10,
    includes: [
      'Access to the app',
      'Browse available artworks',
      'Save artworks',
      'Request price and availability',
      'Message Darz',
      'Access to auctions when available',
    ],
  },
  {
    id: 'premium',
    label: 'Premium Access',
    eyebrow: 'Premium',
    irMonthly: 9_000_000,
    intlMonthly: 25,
    includes: [
      'Everything in Basic Access',
      'Early access to selected artworks',
      'Private previews before public release',
      'Priority replies from Darz',
      'More curated recommendations',
      'VIP invitation to special drops, auctions, and private offers',
    ],
  },
];

/** `'1'` month, or `'6'` months with 10% off (v813, :10227). */
export type Term = '1' | '6';

export function termMonths(term: Term): number {
  return term === '6' ? 6 : 1;
}

export interface TierPrice {
  ir: string;
  intl: string;
  save: boolean;
}

/**
 * `dzTierPrice` (:10232-10238), including its rounding rule: the Toman figure
 * is rounded to a **clean whole million** — the one-month values are already
 * exact millions, and the six-month discount is what would otherwise leave a
 * price reading "27,000,000" as "27,000,000.0000001"-shaped. USD is left
 * as-is.
 */
export function tierPrice(t: Tier, term: Term): TierPrice {
  const m = termMonths(term);
  const disc = m === 6 ? 0.9 : 1;
  const per = m === 6 ? '/ 6 months' : '/ month';
  const ir = Math.round((t.irMonthly * m * disc) / 1_000_000) * 1_000_000;
  return {
    ir: `${money(ir)} Toman ${per}`,
    intl: `$${money(t.intlMonthly * m * disc)} ${per}`,
    save: m === 6,
  };
}

/** `dzMembMoney` (:10230) — the v840 note there is worth keeping in mind: an
 * earlier version of this shadowed a string-safe formatter and rendered "NaN"
 * for any price stored with commas. These inputs are numbers, and stay so. */
function money(n: number): string {
  try {
    return Math.round(n).toLocaleString('en-US');
  } catch {
    return String(Math.round(n));
  }
}

/**
 * **`dzMembPlanLabel` (:10281) is deliberately NOT ported, and this note is
 * why — it is the single most important thing about this screen.**
 *
 * The old app's plans are `basic` / `premium` / `free`, and that function maps
 * them to "Basic Access" / "Premium Access" / "Free Invite". This backend's
 * membership code carries `plan: CollectorTierEnum`, and that enum is
 * **`vip · active · new · institutional`** — the CRM segmentation the admin
 * Collectors desk sorts by, not an access plan. The two vocabularies do not
 * overlap on a single value.
 *
 * So a `planLabel('vip')` written to the old mapping would fall through its
 * `else` and render **"Basic Access"** for a VIP — a confident, wrong answer
 * on the one line a paying collector reads. Instead the redeemed plan is
 * labelled from `GET /api/options/`'s own `accounts.collector_tier` pairs, at
 * the call site, which is the rule CLAUDE.md states for every choice field.
 *
 * The tier CARDS below keep their names, because they are marketing copy the
 * collector chooses from and the WhatsApp message quotes — they were never a
 * backend field in the old app either. What changes is only the line that
 * reports what the server DID.
 *
 * This is the collector half of the audit's **G-MEMB-1** note ("Premium is not
 * [answerable], because `plan` is the collector tier set"). Recorded as
 * **G-MEMB-6**: the backend has no access-plan field, so "are you a member?"
 * has no answer to read — see `MembershipSheet`.
 */

/**
 * `dzMembWaLink` (:10334-10344) — the pre-filled WhatsApp message, with the
 * number from `theme.whatsapp`.
 *
 * **The old app's hardcoded fallback number is deliberately not ported.** It
 * reads `Lib.getTheme().whatsapp || '447341632913'`, so a theme with no number
 * still links somewhere; baking a real phone number into this repo's source
 * would make it a deploy to change, and a wrong one would send collectors to a
 * stranger. Here an unset `theme.whatsapp` falls through to the old app's own
 * no-number line — "Contact Darz to subscribe." — which is already written for
 * exactly this case. The owner sets the number once in App Design and both
 * tiers link. Recorded as **G-MEMB-5**.
 */
export function whatsappLink(
  number: string,
  planLabel: string,
  term: Term,
  collectorName: string,
): string | null {
  const wn = number.replace(/[^0-9]/g, '');
  if (!wn) return null;
  const duration = termMonths(term) === 6 ? '6 months (10% discount)' : '1 month';
  const msg =
    `Hello Darz, I would like to subscribe to darzmarket.art.\n` +
    `Plan: ${planLabel}\n` +
    `Duration: ${duration}\n` +
    `Name: ${collectorName}\n` +
    `Please send me the payment details and access code.`;
  return `https://wa.me/${wn}?text=${encodeURIComponent(msg)}`;
}
