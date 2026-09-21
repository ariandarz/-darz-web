/**
 * How long a request has been waiting, and whether that is too long — the old
 * panel's `actUrgency` (`darz-studio.html:21255-21264`), ported onto this
 * backend's per-kind state machine.
 *
 * ## The old rule, and what each branch became
 *
 * | old (`:21256-21263`)            | here |
 * | ------------------------------- | ---- |
 * | `a.reply` → Replied             | **dropped** — see below |
 * | stage `done` → Resolved         | no `allowed_transitions` → `resolved` |
 * | stage `closed` → Closed         | folded into `resolved` — see below |
 * | stage `progress` → In progress  | open, but moved off its initial status |
 * | new + older than 18h → Overdue  | same, against `crm.request_initial_status` |
 * | otherwise → New                 | same |
 *
 * **"Replied" is dropped, not forgotten.** The old row carried `a.reply`, a
 * single admin answer written onto the action. This backend has a real thread
 * (`RequestMessage`), and the row's only thread signal is `unread_count` —
 * *unseen collector* messages, which is the opposite of "we answered". There
 * is no "has the team replied" field, so the honest options were to omit the
 * state or to invent it from the wrong number. Omitted. A request the team has
 * answered but not moved still reads as waiting, which over-reports rather
 * than under-reports — the safe direction for a queue.
 *
 * **`done` and `closed` are one state here.** The old `actStage` split them
 * because its four statuses were universal. This backend's terminal statuses
 * differ per kind (`converted`/`released`/`expired` for a hold, `accepted`/
 * `declined`/`withdrawn` for an offer…) and carry no good/bad axis the panel
 * could read, so anything with nothing left to move to is simply finished.
 *
 * ## Why this is client-side
 *
 * The API exposes no age filter and no urgency field, and both pieces it needs
 * — `created_at` and `allowed_transitions` — are already on every row. The
 * threshold is the old app's own 18 hours, overridable by the owner through
 * `theme.requestWaitHours` rather than by a deploy.
 */
import type { AdminRequest } from '../../api/types';
import { settingNumber } from '../shell/ownerSettings';

export type UrgencyKey = 'new' | 'waiting' | 'progress' | 'resolved';

export interface Urgency {
  key: UrgencyKey;
  /** The old panel's own label for this state, where it had one. */
  label: string;
}

/** `ACT_WAIT_MS = 18*3600000` (`:21254`). */
export const DEFAULT_WAIT_HOURS = 18;

export function waitHours(): number {
  return settingNumber('requestWaitHours', DEFAULT_WAIT_HOURS);
}

/**
 * `initialByKind` is `crm.request_initial_status` from `GET /api/options/`.
 *
 * When it is missing — options still loading, or an older backend that does
 * not publish the key — every open row reads as `progress`: **not** `new`, and
 * so never `waiting`. Guessing "new" would paint the whole desk red the moment
 * a fetch was slow, which is exactly the false alarm that teaches people to
 * ignore the colour.
 */
export function requestUrgency(
  request: AdminRequest,
  initialByKind: Record<string, string> | null,
  now: number = Date.now(),
): Urgency {
  if (!request.allowed_transitions || request.allowed_transitions.length === 0) {
    return { key: 'resolved', label: 'Resolved' };
  }

  const initial = initialByKind?.[request.kind];
  if (initial === undefined || request.status !== initial) {
    return { key: 'progress', label: 'In progress' };
  }

  if (ageHours(request.created_at, now) > waitHours()) {
    // `:21263` — the old label, verbatim.
    return { key: 'waiting', label: 'Waiting — needs attention' };
  }
  return { key: 'new', label: 'New' };
}

/** Hours since `iso`. An unparseable or future date answers 0, so a bad
 * timestamp can never *raise* an alarm — the same fail-safe direction as the
 * missing-options case above. */
export function ageHours(iso: string, now: number = Date.now()): number {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, (now - then) / 3_600_000);
}

/** "3h" / "2d" — the age, at a glance, beside the row's date. */
export function ageLabel(iso: string, now: number = Date.now()): string {
  const hours = ageHours(iso, now);
  if (hours < 1) return 'just now';
  if (hours < 48) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** How many of these rows are waiting too long — the count the old desk put
 * in its banner ("7 have been waiting too long"). */
export function countWaiting(
  rows: readonly AdminRequest[],
  initialByKind: Record<string, string> | null,
  now: number = Date.now(),
): number {
  return rows.filter((r) => requestUrgency(r, initialByKind, now).key === 'waiting').length;
}
