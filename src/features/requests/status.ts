/**
 * status.ts — the ONE collector-facing vocabulary for a request's state.
 *
 * The backend's status words are internal workflow tokens, different per kind
 * (`apps/crm/lifecycle.py:14-52`, published as `crm.request_status_by_kind` on
 * `GET /api/options/`): a hold runs `requested → active → expired/released/
 * converted`, an offer `submitted → countered/accepted/declined/withdrawn`, a
 * viewing `requested → scheduled/cancelled → completed`, a purchase
 * `intent → qualified → negotiation → confirmed`, and the four simple kinds
 * (`information · price · availability · message`) `new → assigned → answered
 * → closed`.
 *
 * The old app never showed those words. It mapped whatever the admin had set
 * onto a small collector vocabulary — `dzStatusMeta` (app.html:9421-9429):
 * **In review · Replied · Accepted · Resolved · Not accepted · Closed**, with
 * no pill at all on a just-filed request — a four-step rail `MKT_RAIL`
 * (:9678, via `dzMktStage` :9670-9677), and a per-kind explanatory line
 * `dzActStatusNote` (:9433-9477). This module is that mapping, over the
 * backend's real vocabulary (owner decision D3, 2026-09-17 — the table in
 * `docs/PHASE_5_PLAN.md`, confirmed here against `lifecycle.py`: every status
 * of every kind has a row).
 *
 * It replaces the three hardcoded status lists this repo had grown
 * (`conversations/rows.ts`, `profile/ProfilePage.tsx`,
 * `ConversationsController`). A status this map does not know falls back to
 * the label `GET /api/options/` publishes — never a hardcoded guess
 * (CLAUDE.md).
 */
import type { CollectorRequest, HoldDetail, RequestKind } from '../../api/types';

/** app.html:9678 — the four steps of an acquisition. */
export const MKT_RAIL = ['Requested', 'In review', 'Accepted', 'Complete'] as const;

/** app.html:878-882 — the pill's colour class. '' = no pill. */
export type PillClass = '' | 's-rev' | 's-ok' | 's-no' | 's-cl';

/** Where a request stands, in the collector's words. */
export type Phase =
  | 'pending'
  | 'reviewing'
  | 'replied'
  | 'accepted'
  | 'resolved'
  | 'rejected'
  | 'closed'
  | 'unknown';

export interface StatusMeta {
  phase: Phase;
  /** the pill text — `null` on a just-filed request, which shows none (:9422) */
  label: string | null;
  pill: PillClass;
  /** -1 when the request has ended (the rail collapses to one line), else the
   * index into `MKT_RAIL` (`dzMktStage`, :9670-9677) */
  stage: number;
  /** the line shown when Darz has not written yet (`dzActStatusNote`, :9433) */
  note: string;
}

/** backend `(kind, status)` → the collector's phase. Source of every value:
 * `apps/crm/lifecycle.py` `TRANSITIONS` + `KIND_INITIAL_STATUS`. */
const PHASE_BY_KIND: Record<string, Record<string, Phase>> = {
  hold: {
    requested: 'pending',
    active: 'accepted',
    converted: 'resolved',
    expired: 'closed',
    released: 'closed',
  },
  offer: {
    submitted: 'pending',
    countered: 'reviewing',
    accepted: 'accepted',
    declined: 'rejected',
    withdrawn: 'closed',
  },
  viewing: {
    requested: 'pending',
    scheduled: 'accepted',
    completed: 'resolved',
    cancelled: 'rejected',
  },
  purchase: {
    intent: 'pending',
    qualified: 'reviewing',
    negotiation: 'reviewing',
    confirmed: 'accepted',
  },
};

/** `information · price · availability · message` share one lifecycle. */
const SIMPLE_PHASE: Record<string, Phase> = {
  new: 'pending',
  assigned: 'reviewing',
  answered: 'replied',
  closed: 'closed',
};

/** app.html:9421-9429 — the label and colour each phase wears. `resolved`
 * reads "Resolved" (the pill vocabulary); "Complete" is the RAIL's name for
 * the same step, not a pill. */
const PRESENTATION: Record<Phase, { label: string | null; pill: PillClass; stage: number }> = {
  pending: { label: null, pill: '', stage: 0 },
  reviewing: { label: 'In review', pill: 's-rev', stage: 1 },
  replied: { label: 'Replied', pill: 's-rev', stage: 1 },
  accepted: { label: 'Accepted', pill: 's-ok', stage: 2 },
  resolved: { label: 'Resolved', pill: 's-ok', stage: 3 },
  rejected: { label: 'Not accepted', pill: 's-no', stage: -1 },
  closed: { label: 'Closed', pill: 's-cl', stage: -1 },
  unknown: { label: null, pill: 's-rev', stage: 0 },
};

/** The old app's action verbs, which its copy is keyed by. */
type Verb = 'buy' | 'hold' | 'visit' | 'offer' | 'inquire' | 'other';

const VERB_BY_KIND: Record<string, Verb> = {
  purchase: 'buy',
  hold: 'hold',
  viewing: 'visit',
  offer: 'offer',
  price: 'inquire',
  information: 'inquire',
  availability: 'inquire',
  message: 'other',
};

/** app.html:9433-9477 — `dzActStatusNote`, verbatim, per phase × verb. */
const ACCEPTED: Record<Verb, string> = {
  offer: 'Darz has accepted your offer and will contact you to finalize the acquisition.',
  buy: 'Darz has accepted your purchase request and will contact you to finalize the acquisition.',
  hold: 'Darz has accepted your hold request. The work is being kept for you while Darz confirms the next step.',
  visit:
    'Darz has accepted your viewing request and will contact you to arrange the appointment.',
  inquire: 'Darz has confirmed your enquiry and will contact you with the next details.',
  other: 'Darz has accepted this request and will contact you for the next step.',
};
const REJECTED: Record<Verb, string> = {
  offer:
    'Darz could not accept this offer. You can write below if you would like to discuss another option.',
  buy: 'Darz could not accept this purchase request. You can write below if you would like to discuss another work.',
  hold: 'Darz could not place this work on hold. You can write below if you would like help with another option.',
  visit:
    'Darz could not confirm this viewing request. You can write below to arrange another time.',
  inquire:
    'Darz could not confirm availability for this enquiry. You can write below for alternatives.',
  other:
    'Darz could not accept this request. You can write below if you would like to discuss another option.',
};
/** ":9459" — "Darz is reviewing your <subject> and will contact you soon." */
const REVIEWING_SUBJECT: Record<Verb, string | null> = {
  offer: 'offer',
  buy: 'purchase request',
  hold: 'hold request',
  visit: 'viewing request',
  inquire: 'enquiry',
  other: null,
};
const PENDING_NOTE =
  'Darz has not replied yet. Their reply appears here, and you can write below.';
const REPLIED_NOTE =
  'Darz has replied to this request. Their message appears here once it reaches your app.';
const RESOLVED_NOTE =
  'Darz has resolved this request. You can write below if you need anything else.';
const CLOSED_NOTE =
  'Darz has closed this request. You can write below if you would like to reopen the conversation.';

function noteFor(phase: Phase, verb: Verb, status: string): string {
  switch (phase) {
    case 'accepted':
      return ACCEPTED[verb];
    case 'rejected':
      return REJECTED[verb];
    case 'reviewing': {
      const subject = REVIEWING_SUBJECT[verb];
      return subject
        ? `Darz is reviewing your ${subject} and will contact you soon.`
        : 'Darz is reviewing this request and will contact you soon.';
    }
    case 'replied':
      return REPLIED_NOTE;
    case 'resolved':
      return RESOLVED_NOTE;
    case 'closed':
      return CLOSED_NOTE;
    case 'pending':
      return PENDING_NOTE;
    default:
      // app.html:9476 — the catch-all keeps the server's own word, quoted.
      return `Darz updated this request to "${status}". You can write below if you have a question.`;
  }
}

/** A hold's server-set expiry (`detail.expires_at`, now + 48 h on create —
 * `apps/crm/models.py:155`), and whether it has passed.
 *
 * Since G-P5-6 the backend expires an overdue hold before every collector read
 * (list and detail — `RequestService.expire_overdue_for_collector`), so the
 * status is right on arrival. The check below is kept as a backstop only: a
 * hold that lapses while the page stays open still reads as closed without a
 * reload. It changes nothing on a fresh read. */
export function holdExpiry(
  request: Pick<CollectorRequest, 'kind' | 'detail'>,
  now: Date = new Date(),
): { at: Date; expired: boolean } | null {
  if (request.kind !== 'hold') return null;
  const raw = (request.detail as HoldDetail | null)?.expires_at;
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  return { at, expired: at.getTime() <= now.getTime() };
}

export interface StatusOptions {
  /** the label `GET /api/options/` publishes, for a status this map does not
   * know — pass `statusLabel(options, kind, status)` */
  fallbackLabel?: string;
  now?: Date;
}

/** Where this request stands, in the collector's words. */
export function statusMeta(request: CollectorRequest, opts: StatusOptions = {}): StatusMeta {
  const kind = request.kind as RequestKind;
  const status = request.status ?? '';
  const table = PHASE_BY_KIND[kind] ?? SIMPLE_PHASE;
  let phase: Phase = table[status] ?? 'unknown';

  // G-P5-6 backstop — a hold that lapsed since the last read reads as closed.
  const expiry = holdExpiry(request, opts.now);
  if (expiry?.expired && (phase === 'accepted' || phase === 'pending')) phase = 'closed';

  const shape = PRESENTATION[phase];
  const verb = VERB_BY_KIND[kind] ?? 'other';
  return {
    phase,
    label: phase === 'unknown' ? (opts.fallbackLabel ?? status) || null : shape.label,
    pill: shape.pill,
    stage: shape.stage,
    note: noteFor(phase, verb, status),
  };
}

/** The amount an offer carries, formatted for a list row (`actli-amt`,
 * app.html:9491). The backend returns `detail.amount` as a **string**
 * (`docs/PHASE_5_API_GAPS.md` G-P5-9). */
export function requestAmount(
  request: Pick<CollectorRequest, 'kind' | 'detail'>,
): { amount: string; currency: string } | null {
  if (request.kind !== 'offer') return null;
  const detail = request.detail as { amount?: number | string; currency?: string } | null;
  const raw = detail?.amount;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return { amount: n.toLocaleString('en-US'), currency: detail?.currency ?? '' };
}
