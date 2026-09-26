/**
 * The owner Access desk's pure rules (V1 Phase 8, G-KEY-1) — everything the
 * page decides that does not need a renderer, so it is testable in the node
 * project.
 *
 * Old source: `accessView()`, `darz-studio.html:33024-33113` (the desk), and
 * `DarzAdmin.accessExtend` (`:37096-37101`, the extend toast).
 */
import type {
  AccessKeyDeskSummary,
  AccessKeyRoster,
  AccessKeyRosterQuery,
} from '../../api/types';
import { HttpError } from '../../api/errors';

export type AccessDisplayStatus = 'active' | 'locked' | 'expired';

/**
 * **C-17.** The stored `status` lags: it only flips to `expired` when someone
 * tries to sign in with a lapsed key, so a key nobody has tried since still
 * reads `active`. The display rule is exactly the backend's computed filter
 * (`AccessKeyEffectiveStatusFilter`, `accounts/filters.py:54-80`) and summary
 * (`services.py:550-580`) — locked wins, then `is_expired`, else active — so a
 * row, the status filter and the tiles always agree.
 *
 * Deliberately NOT `|| status === 'expired'`: that would disagree with the
 * server's filter. It does leave one honest gap, raised as **C-25**: a key the
 * lazy flip already stored as `expired` and then extended reads Active here
 * (and in the server's own filter) but is still refused at sign-in, because
 * login only considers stored-`active` keys and extend does not reset the
 * status (`services.py:81`, `:458-480`).
 */
export function displayStatus(
  key: Pick<AccessKeyRoster, 'status' | 'is_expired'>,
): AccessDisplayStatus {
  if (key.status === 'locked') return 'locked';
  if (key.is_expired) return 'expired';
  return 'active';
}

/** The pill tone per state — the old status select's colours (`accStatusSel`,
 * `:32964`: active `#1f9d57` green, locked `#C97A00` amber) and `expCell`'s
 * red for Expired (`:33042`), on the kit's `.ad-stpill` tones. */
export const STATUS_TONE: Record<AccessDisplayStatus, 'ok' | 'res' | 'gone'> = {
  active: 'ok',
  locked: 'res',
  expired: 'gone',
};

/** Extend and revoke apply to a key that is not locked — the old desk offered
 * the extend buttons on every non-admin key, lapsed ones included (the review
 * banner, `:33049-33058`). A locked key is refused at sign-in and stays on
 * record; there is nothing to extend. */
export function canAct(key: Pick<AccessKeyRoster, 'status' | 'is_expired'>): boolean {
  return displayStatus(key) !== 'locked';
}

/**
 * The desk's controls → the roster's query string (`AccessKeyFilterSet`,
 * `accounts/filters.py:101-112`). An empty search, an unknown status and a
 * switched-off `expiring_soon` drop out entirely — the server treats
 * `expiring_soon=false` as a no-op, so sending it would only add noise.
 */
export function rosterQuery(q: AccessKeyRosterQuery): AccessKeyRosterQuery {
  const out: AccessKeyRosterQuery = {};
  const search = q.search?.trim();
  if (search) out.search = search;
  if (q.status === 'active' || q.status === 'locked' || q.status === 'expired') {
    out.status = q.status;
  }
  if (q.collector) out.collector = q.collector;
  if (q.expiring_soon === true) out.expiring_soon = true; // → `?expiring_soon=true`
  if (q.per_page) out.per_page = q.per_page;
  if (q.page) out.page = q.page;
  return out;
}

export interface AccessTile {
  key: keyof AccessKeyDeskSummary;
  label: string;
  value: string;
  /** the old number's colour (`stat(n, l, c)`, `:21518`) */
  tone: 'ok' | 'soon' | 'muted' | null;
}

function show(n: unknown): string {
  return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
}

/**
 * The old stat row (`:33111`), label for label and in order: Total Collectors ·
 * Active Collectors (green) · Expiring ≤ 7d (amber when non-zero, grey at
 * zero) · Logins today (grey).
 *
 * The old fifth tile, **Admin keys**, has no counterpart: this backend's
 * access keys are collectors' only — admin sign-in is a `TeamUser` with a
 * password (the Team desk). It is named here rather than faked.
 *
 * A pending or failed read shows `—`, never a zero (`collectorTiles.ts`'s rule).
 */
export function accessTiles(summary: AccessKeyDeskSummary | null): AccessTile[] {
  const soon = summary?.expiring_soon;
  return [
    {
      key: 'total_collectors',
      label: 'Total Collectors',
      value: show(summary?.total_collectors),
      tone: null,
    },
    {
      key: 'active_collectors',
      label: 'Active Collectors',
      value: show(summary?.active_collectors),
      tone: 'ok',
    },
    {
      key: 'expiring_soon',
      label: 'Expiring ≤ 7d',
      value: show(soon),
      tone: typeof soon === 'number' && soon > 0 ? 'soon' : 'muted',
    },
    {
      key: 'logins_today',
      label: 'Logins today',
      value: show(summary?.logins_today),
      tone: 'muted',
    },
  ];
}

/**
 * The review banner's rows (`:33045-33047`): already-lapsed keys plus those
 * lapsing within 7 days, soonest first. Here the two halves are the server's
 * own computed filters (`?status=expired`, `?expiring_soon=true`), so a key is
 * never in both — de-duplicated anyway, by id, in case the clock ticks between
 * the two reads.
 */
export function attentionRows(
  expired: readonly AccessKeyRoster[],
  soon: readonly AccessKeyRoster[],
): AccessKeyRoster[] {
  const seen = new Set<string>();
  const out: AccessKeyRoster[] = [];
  for (const k of [...expired, ...soon]) {
    if (seen.has(k.id) || displayStatus(k) === 'locked') continue;
    seen.add(k.id);
    out.push(k);
  }
  const at = (k: AccessKeyRoster) =>
    k.expires_at ? new Date(k.expires_at).getTime() : Number.POSITIVE_INFINITY;
  return out.sort((a, b) => at(a) - at(b));
}

/** `:33051`, verbatim — "1 key needs a decision…", "3 keys need a decision…". */
export function attentionHeading(n: number): string {
  return `${n} key${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} a decision — extend or let expire`;
}

/** The banner row's second line (`:33056`): "Expired <date>" / "Expires
 * today" / "Expires in n day(s)". The day count uses `expiryParts`' rounding
 * (whole days left, floored) rather than the old `accExpDays`' `Math.ceil`
 * (`:32961`), so the banner and the Access period cell beside it never
 * disagree by one — the shared cell's rounding predates this desk and is
 * flagged, not changed, here. */
export function attentionLine(expiresAt: string | null, now = Date.now()): string {
  if (!expiresAt) return '';
  const ts = new Date(expiresAt).getTime();
  if (Number.isNaN(ts)) return '';
  if (ts <= now) return `Expired ${new Date(ts).toLocaleDateString('en-GB')}`;
  const d = Math.floor((ts - now) / 86_400_000);
  if (d <= 0) return 'Expires today';
  return `Expires in ${d} day${d === 1 ? '' : 's'}`;
}

export type ExtendChoice = '1w' | '1m' | 'none';

const EXTEND_LABEL: Record<Exclude<ExtendChoice, 'none'>, string> = {
  '1w': '1 week',
  '1m': '1 month',
};

/** `accessExtend`'s toast (`:37097`, `:37101`): "<name> extended by 1 week —
 * until <date>" / "<name> — now permanent". The date is the server's new
 * `expires_at`, not a client guess. */
export function extendToast(
  name: string | null | undefined,
  choice: ExtendChoice,
  expiresAt: string | null,
): string {
  const who = name || 'Key';
  if (choice === 'none' || !expiresAt) return `${who} — now permanent`;
  return `${who} extended by ${EXTEND_LABEL[choice]} — until ${new Date(
    expiresAt,
  ).toLocaleDateString('en-GB')}`;
}

/**
 * A failed extend/revoke. **C-11:** a refusal can come back with
 * `code: "INTERNAL_ERROR"`, so this branches on the HTTP status, never the
 * code. A 404 means the key went away under us (removed elsewhere) — the list
 * must be re-read, not just annotated.
 */
export function actionFailure(err: unknown): { message: string; reload: boolean } {
  const message = err instanceof Error && err.message ? err.message : 'The action failed.';
  return { message, reload: err instanceof HttpError && err.status === 404 };
}
