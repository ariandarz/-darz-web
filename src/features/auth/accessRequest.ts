/**
 * The pure pieces of the gate's "Request access" submission, lifted out of
 * `LoginPage` so they run in the node-only `logic` test project.
 *
 * Ports of `app.html`'s `submitRequest` (:2554-2566), plus the retry key and the
 * 429 message the backend's dedupe and rate limit (G-P34-1/2) call for.
 */

import { HttpError } from '../../api/errors';

/**
 * The old gate asks for **one** "Email or phone" and decides which it is by
 * looking for an `@` — `var email=/@/.test(em)?em:'', phone=/@/.test(em)?'':em;`
 * (app.html:2558). The backend has two separate fields
 * (`AccessRequestCreateSerializer`), so the split happens here.
 *
 * Owner decision D2 (2026-09-18): keep the single field. It is the approved
 * design and the shipped behaviour; this is the one line that reconciles it
 * with the API.
 *
 * Deliberately the same crude test as the original: anything containing `@`
 * is treated as the email, everything else as the phone. It is not validation
 * — the backend's `EmailField` is what actually rejects a malformed address,
 * and its message is what the gate shows.
 */
export function splitContact(raw: string): { email: string; phone: string } {
  const value = raw.trim();
  return /@/.test(value) ? { email: value, phone: '' } : { email: '', phone: value };
}

/**
 * Referral attribution: `?ref=` on the URL, else a previously stored
 * `darz_ref`, else nothing (app.html:2560). The old app decodes the URL value;
 * so does this.
 *
 * Every access is wrapped — a blocked `localStorage` (private mode, disabled
 * site data) must not stop someone requesting access.
 */
export function readRefCode(
  search: string = typeof location === 'undefined' ? '' : location.search,
  storage: Storage | null = safeLocalStorage(),
): string {
  const fromUrl = /[?&]ref=([^&#]+)/.exec(search)?.[1];
  if (fromUrl) {
    try {
      return decodeURIComponent(fromUrl);
    } catch {
      return fromUrl; // a malformed %-escape is still better than nothing
    }
  }
  try {
    return storage?.getItem('darz_ref') ?? '';
  } catch {
    return '';
  }
}

/**
 * The old app's idempotency key, same shape: `ar_` + base-36 time + 6 random
 * base-36 chars (app.html:2559).
 *
 * The backend honours it (G-P34-1): a repeat with the same key answers **200**
 * with the row it already holds instead of filing a second one (a first insert
 * is 201). Both are success to the gate.
 */
export function newClientReqId(): string {
  return 'ar_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Holds one `client_req_id` across retries of the same submission, so a retry
 * after a lost response replays the row the backend already filed rather than
 * queueing a duplicate for review. A different submission — any field edited —
 * gets a fresh key: the backend would otherwise answer the edit with the
 * original row, silently dropping the correction.
 */
export class AccessRequestKey {
  private current: { key: string; fingerprint: string } | null = null;
  private readonly mint: () => string;

  constructor(mint: () => string = newClientReqId) {
    this.mint = mint;
  }

  /** The key for a submission of exactly these values. */
  for(values: Readonly<Record<string, string>>): string {
    const fingerprint = JSON.stringify(Object.entries(values).sort());
    if (this.current?.fingerprint !== fingerprint) {
      this.current = { key: this.mint(), fingerprint };
    }
    return this.current.key;
  }

  /** Forget the key — once a submission landed, or the form closed. */
  reset(): void {
    this.current = null;
  }
}

/**
 * What the gate shows when a submission fails. The backend's own messages
 * stand, except a 429: `POST /api/auth/access-requests/` is rate-limited
 * (G-P34-2, 5/hour per IP by default) and DRF's "Request was throttled.
 * Expected available in N seconds." is not a sentence for this gate. The old
 * app had no limit, so it has no copy for it; the wording is the adoption
 * guide's (`API_GAPS_FRONTEND_ADOPTION.md`, G-P34-1).
 */
export function accessRequestError(err: unknown): string {
  if (err instanceof HttpError && err.status === 429) {
    return 'Too many attempts — try again shortly.';
  }
  return err instanceof Error && err.message ? err.message : 'Something went wrong.';
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
