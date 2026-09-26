/**
 * Documents desk rules — pure, so the node test project covers them.
 *
 *  - **Who may act on an owner-locked document** (`ownerLockReason`). The
 *    backend's `_guard_owner_lock` (`apps/documents/services.py:17-19`) refuses
 *    a non-owner's edit, upload, confirm, sign, archive and delete on a
 *    document with `owner_lock` set, with "This document is owner-locked."
 *    The desk used to print "owner-locked" and leave every button live, so a
 *    standard admin found out by 403. **Share is not in the list**: the
 *    backend's `share_with_collector` / `unshare` carry no lock guard.
 *  - **Which kinds may reach a collector** (`isCollectorVisibleKind`) — the
 *    backend's `Document.COLLECTOR_VISIBLE_KINDS` (`apps/documents/models.py:39-42`),
 *    enforced at share time and again on the collector read. Both the share
 *    control and the chat's attach picker offer only these.
 *  - **A History row** (`activityWho`, `spAgo`) — `DocumentActivity`, whose
 *    actor is flat (C-15).
 */
import type { DocumentActivity, DocumentAdmin } from '../../api/types';
import type { AdminRole } from './adminNav';

/** `Document.COLLECTOR_VISIBLE_KINDS`, verbatim. */
export const COLLECTOR_VISIBLE_KINDS: readonly string[] = [
  'invoice',
  'certificate',
  'provenance',
  'contract',
  'receipt',
  'proforma',
  'artwork_sheet',
  'condition_report',
];

export function isCollectorVisibleKind(kind: string | null | undefined): boolean {
  return !!kind && COLLECTOR_VISIBLE_KINDS.includes(kind);
}

/**
 * Why this admin cannot run the guarded moves on this document, or `null`
 * when they can. Owner → always `null`; anyone else on a locked document gets
 * the reason. The wording follows the old panel's owner gate on its legal
 * documents ("Read-only — only the owner can edit the legal documents.",
 * `darz-studio.html:30965`) and names the moves the backend guards; the old
 * panel had no per-document lock, so there was no sentence to port whole
 * (flagged).
 */
export function ownerLockReason(
  doc: Pick<DocumentAdmin, 'owner_lock'> | null | undefined,
  role: AdminRole,
): string | null {
  if (!doc?.owner_lock || role === 'owner') return null;
  return 'Owner-locked — only the owner can edit, upload, confirm, sign or archive this document.';
}

/** "Who" on a History row: the actor's name, or "system" for an entry with no
 * actor (the Settings audit log's own fallback). */
export function activityWho(a: Pick<DocumentActivity, 'actor' | 'actor_name'>): string {
  const name = (a.actor_name ?? '').trim();
  return name || 'system';
}

/** `create` → `Create` — the action as the server recorded it, capitalised
 * (the old log was free text; the server's verbs are the honest words). */
export function activityAction(action: string): string {
  const spaced = (action || '').replace(/_/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '—';
}

/** The old panel's `_spAgo` (`darz-studio.html:27024`), verbatim in shape:
 * today · yesterday · Nd ago (under 30 days) · the date. */
export function spAgo(iso: string | null | undefined, now: number = Date.now()): string {
  const ts = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ts) || !ts) return '—';
  const d = now - ts;
  const day = 864e5;
  if (d < day) return 'today';
  if (d < 2 * day) return 'yesterday';
  if (d < 30 * day) return `${Math.round(d / day)}d ago`;
  return new Date(ts).toLocaleDateString();
}

/**
 * The documents the chat composer may attach for this thread's collector.
 *
 * Attaching SHARES the document with the thread's collector and **rewrites the
 * document's `collector`** (`RequestMessageService.post` → `share_with_collector`),
 * so a document already issued to someone else must never be offered — it
 * would move. Offered: collector-visible kinds, not archived, and either this
 * collector's own or not yet issued to anyone; this collector's first, then
 * newest. With no collector known (a cold deep link — G-CHAT-1), only the
 * unissued ones.
 */
export function attachableDocuments(
  docs: readonly DocumentAdmin[],
  collectorId: string | null | undefined,
): DocumentAdmin[] {
  return docs
    .filter(
      (d) =>
        isCollectorVisibleKind(d.kind) &&
        d.status !== 'archived' &&
        (d.collector == null || (!!collectorId && d.collector === collectorId)),
    )
    .sort((a, b) => {
      const mine = Number(b.collector === collectorId) - Number(a.collector === collectorId);
      return mine || b.updated_at.localeCompare(a.updated_at);
    });
}
