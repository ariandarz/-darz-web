/**
 * saleForm — the pure logic under the Sales desks.
 */
import type { SaleAdmin } from '../../api/types';

/**
 * The sale status machine, ported from
 * `darzmarket-api/apps/sales/lifecycle.py::SALE_TRANSITIONS` — a linear chain
 * draft → confirmed → invoiced → paid → delivered → completed → archived,
 * with `lost` reachable from every non-terminal state. One place to update if
 * the backend chain changes.
 */
export const SALE_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ['confirmed', 'lost'],
  confirmed: ['invoiced', 'lost'],
  invoiced: ['paid', 'lost'],
  paid: ['delivered', 'lost'],
  delivered: ['completed', 'lost'],
  completed: ['archived', 'lost'],
  archived: [],
  lost: [],
};

export function saleTransitionTargets(from: string): readonly string[] {
  return SALE_TRANSITIONS[from] ?? [];
}

/** The chain's forward step — what the old row's "Next: …" prompt named. */
export function saleNextStep(from: string): string | null {
  const forward = saleTransitionTargets(from).filter((t) => t !== 'lost');
  return forward[0] ?? null;
}

/** R7 — the commercial snapshot is editable in draft only. */
export function saleTermsLocked(sale: SaleAdmin): boolean {
  return sale.status !== 'draft';
}

/** The desk's status tone, in the artworks pill's own vocabulary:
 * ok (moving), res (waiting on money/logistics), gone (lost),
 * neut (parked). */
export function saleTone(status: string): 'ok' | 'res' | 'gone' | 'neut' {
  if (status === 'lost') return 'gone';
  if (status === 'invoiced' || status === 'paid' || status === 'delivered') return 'res';
  if (status === 'archived') return 'neut';
  return 'ok';
}
