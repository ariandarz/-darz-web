/**
 * The Projects dashboard's two pure readings of the server's summary.
 *
 * Extracted from the page for the reason `deskState.ts` gives: this is the
 * part with edge cases that are easy to get wrong and impossible to test
 * through a component in this repo (vitest only, no jsdom, by design). The
 * edge cases are not hypothetical — the un-guarded version of `readMembers`
 * threw `responsibility_by_member is not iterable` and blanked the whole desk.
 */
import type { ProjectDashboard } from '../../../api/types';
import type { Quick } from './projectForm';

export interface Member {
  member: string;
  active: number;
}

/** `responsibility_by_member` is typed as loose dicts on the wire; the
 * backend writes `{member, active_count}` (`services.py:267`). Sorted by
 * count, top five — the old `members.slice(0,5)` (:13601).
 *
 * The `Array.isArray` guard is not defensive habit: without it a response of
 * the wrong shape threw `responsibility_by_member is not iterable` during
 * render and **blanked the whole Projects dashboard**, the five cards
 * included. Same failure as `artworkFacets.ts` and `ledgerSummary.ts`; a
 * missing member strip is a degraded desk, a thrown render is no desk. */
export function readMembers(dash: ProjectDashboard): Member[] {
  const out: Member[] = [];
  if (!Array.isArray(dash.responsibility_by_member)) return out;
  for (const row of dash.responsibility_by_member) {
    const member = String(row.member ?? '').trim();
    if (!member) continue;
    out.push({ member, active: Number(row.active_count) || 0 });
  }
  return out.sort((a, b) => b.active - a.active).slice(0, 5);
}

/** The count behind each card (:13605-13610), from the server's summary.
 *
 * `count()` rather than the bare field: a card whose number is missing reads
 * **0**, never the string "undefined" or "NaN" on screen. */
export function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
export function cardCount(dash: ProjectDashboard, q: Quick): number {
  switch (q) {
    case 'active':
      return count(dash.active_count);
    case 'delayed':
      return count(dash.delayed_count);
    case 'approval':
      return count(dash.awaiting_approval_count);
    case 'deliverables':
      return count(dash.next_deliverables_count);
    case 'unpaid':
      return count(dash.unpaid_count);
  }
}
