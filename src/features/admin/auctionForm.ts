/**
 * The auction and lot editors' non-React half (V1 Phase 3): the date-window
 * and estimate checks the backend does not make (C-18), the draft ⇄ PATCH
 * mapping, and the old desk's terms rule.
 *
 * Ported from the old Manage-auction modal (`editAuc`/`saveAuc`,
 * `darz-studio.html:32027-32172`):
 *  - the window is two `datetime-local` fields read as LOCAL time (`dtl()`,
 *    `:32036`) — the create form used to slice the ISO string, which shows
 *    UTC as if it were local;
 *  - terms: the textarea opens on the auction's own text, else the Darz
 *    default (`:32106`), and a save identical to the default stores `''`
 *    (`:32166`, "so the default can evolve") — the backend's own rule too
 *    ("Blank = the app's default text");
 *  - "No terms gate" (`au_termsOff`, `:32105`) is `terms_required: false`.
 *
 * **Validation copy is not from the old app** — the old modal accepted any
 * window (it defaulted a missing end to +7 days, `:32158`). C-18 leaves the
 * wording to the owner; these two sentences are the minimal placeholder.
 */
import type { Auction, AuctionPatch, LotAdmin, LotPatch } from '../../api/types';
import { DARZ_AUC_TERMS } from '../auctions/terms';

/** C-18 — flagged copy (see the header). */
export const WINDOW_ERROR = 'The end must be after the start.';
export const ESTIMATE_ERROR = 'The low estimate cannot be above the high estimate.';

/** ISO → the `datetime-local` value in the viewer's own zone (old `dtl()`). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** `datetime-local` value → ISO (the browser reads it as local time). */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

/** `starts_at < ends_at`, or the reason it is not. Blank fields are the
 * caller's "required" check, not this one's. */
export function windowError(startsAt: string, endsAt: string): string | null {
  if (!startsAt || !endsAt) return null;
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return s < e ? null : WINDOW_ERROR;
}

/** Low ≤ high when both are set. The old row stripped thousands separators
 * before reading a figure (`Lib.num`, `:32008`) — so does this. */
export function estimateError(low: string, high: string): string | null {
  const lo = parseAmount(low);
  const hi = parseAmount(high);
  if (lo === null || hi === null) return null;
  return lo <= hi ? null : ESTIMATE_ERROR;
}

/** A typed figure → the API's decimal string, or `null` when blank.
 * Separators are stripped (`1,200,000` → `"1200000"`). */
export function amountOrNull(value: string): string | null {
  const n = parseAmount(value);
  return n === null ? null : String(n);
}

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** What the textarea opens on (`:32106`). */
export function termsForEditing(terms: string | null | undefined): string {
  return terms && terms.trim() ? terms : DARZ_AUC_TERMS;
}

/** What is stored: `''` when the text IS the Darz default (`:32166`). */
export function termsForSaving(text: string): string {
  return text.trim() === DARZ_AUC_TERMS.trim() ? '' : text;
}

/** Only an auction in these states takes a PATCH (`AuctionService.update`). */
export const EDITABLE_AUCTION = ['draft', 'scheduled'] as const;

export function auctionEditable(status: string): boolean {
  return (EDITABLE_AUCTION as readonly string[]).includes(status);
}

/** The auction editor's fields, as the inputs hold them. */
export interface AuctionDraft {
  title: string;
  description: string;
  currency: string;
  startsAt: string;
  endsAt: string;
  terms: string;
  /** "No terms gate" — the inverse of `terms_required` */
  noTermsGate: boolean;
}

export function auctionDraft(a: Auction): AuctionDraft {
  return {
    title: a.title,
    description: a.description ?? '',
    currency: a.currency,
    startsAt: toLocalInput(a.starts_at),
    endsAt: toLocalInput(a.ends_at),
    terms: termsForEditing(a.terms),
    noTermsGate: !a.terms_required,
  };
}

/** The PATCH for a draft: only the fields that changed, plus the lock. A
 * field sent unchanged is not harmless — the server writes every key it gets
 * (C-16: never overwrite what you did not edit). */
export function auctionPatch(a: Auction, d: AuctionDraft): AuctionPatch {
  const body: AuctionPatch = { expected_version: a.version };
  if (d.title.trim() !== a.title) body.title = d.title.trim();
  if (d.description !== (a.description ?? '')) body.description = d.description;
  if (d.currency !== a.currency) body.currency = d.currency as AuctionPatch['currency'];
  if (d.startsAt !== toLocalInput(a.starts_at)) body.starts_at = fromLocalInput(d.startsAt);
  if (d.endsAt !== toLocalInput(a.ends_at)) body.ends_at = fromLocalInput(d.endsAt);
  const terms = termsForSaving(d.terms);
  if (terms !== (a.terms ?? '')) body.terms = terms;
  if (!d.noTermsGate !== a.terms_required) body.terms_required = !d.noTermsGate;
  return body;
}

/** The first reason an auction draft cannot be saved, or null. */
export function auctionDraftError(d: AuctionDraft): string | null {
  if (!d.title.trim() || !d.currency || !d.startsAt || !d.endsAt)
    return 'Title, currency and the sale window are all required.';
  return windowError(d.startsAt, d.endsAt);
}

/** The lot editor's fields, as the inputs hold them. */
export interface LotDraft {
  lotNumber: string;
  opening: string;
  reserve: string;
  low: string;
  high: string;
  premium: string;
  startsAt: string;
  endsAt: string;
  softCloseSec: string;
}

export function lotDraft(l: LotAdmin): LotDraft {
  return {
    lotNumber: String(l.lot_number),
    opening: l.opening_amount ?? '',
    reserve: l.reserve_amount ?? '',
    low: l.low_estimate ?? '',
    high: l.high_estimate ?? '',
    premium: l.premium_pct ?? '0',
    startsAt: toLocalInput(l.starts_at),
    endsAt: toLocalInput(l.ends_at),
    softCloseSec: l.soft_close_sec != null ? String(l.soft_close_sec) : '',
  };
}

/** Same-number check for decimal strings (`"8000.00"` vs `"8000"`). */
function sameAmount(a: string | null | undefined, b: string | null): boolean {
  const x = a == null || a === '' ? null : Number(a);
  const y = b == null ? null : Number(b);
  return x === y;
}

export function lotPatch(l: LotAdmin, d: LotDraft): LotPatch {
  const body: LotPatch = { expected_version: l.version };
  const n = Number(d.lotNumber);
  if (n !== l.lot_number) body.lot_number = n;
  const opening = amountOrNull(d.opening);
  if (opening !== null && !sameAmount(l.opening_amount, opening))
    body.opening_amount = opening;
  const reserve = amountOrNull(d.reserve);
  if (!sameAmount(l.reserve_amount, reserve)) body.reserve_amount = reserve;
  const low = amountOrNull(d.low);
  if (!sameAmount(l.low_estimate, low)) body.low_estimate = low;
  const high = amountOrNull(d.high);
  if (!sameAmount(l.high_estimate, high)) body.high_estimate = high;
  const premium = amountOrNull(d.premium) ?? '0';
  if (!sameAmount(l.premium_pct ?? '0', premium)) body.premium_pct = premium;
  if (d.startsAt !== toLocalInput(l.starts_at)) body.starts_at = fromLocalInput(d.startsAt);
  if (d.endsAt !== toLocalInput(l.ends_at)) body.ends_at = fromLocalInput(d.endsAt);
  if (d.softCloseSec.trim() !== '') {
    const sec = Number(d.softCloseSec);
    if (sec !== l.soft_close_sec) body.soft_close_sec = sec;
  }
  return body;
}

/** The first reason a lot draft cannot be saved, or null. */
export function lotDraftError(d: LotDraft): string | null {
  if (!d.lotNumber.trim() || !d.opening.trim() || !d.startsAt || !d.endsAt)
    return 'A lot number, an opening amount and the bidding window are required.';
  return windowError(d.startsAt, d.endsAt) ?? estimateError(d.low, d.high);
}
