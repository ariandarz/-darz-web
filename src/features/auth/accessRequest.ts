/**
 * The three pure pieces of the gate's "Request access" submission, lifted out
 * of `LoginPage` so they can be tested without a DOM renderer (this repo has
 * no component-test stack — every test is a logic test).
 *
 * All three are ports of `app.html`'s `submitRequest` (:2554-2566).
 */

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
 * The backend **ignores it today** — `AccessRequestService.create` is a plain
 * `objects.create` with no uniqueness (docs/PHASE_24_35_API_GAPS.md G-P34-1).
 * Sent anyway per owner decision D3: it costs nothing, and the day the backend
 * honours it the way it already does for `POST /api/crm/requests/`, this
 * client already complies.
 */
export function newClientReqId(): string {
  return 'ar_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
