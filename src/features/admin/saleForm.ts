/**
 * saleForm — the pure logic under the Sales desks.
 */
import type { OptionsMap } from '../../api/services';
import type { Choice, SaleAdmin } from '../../api/types';

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

/** A choice list from `GET /api/options/` — empty until it loads, and empty
 * for a key the backend does not register (sale `source`, C-14). */
export function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

/** A value's label, **falling back to the raw value** — never a hardcoded map
 * (house rule). `source` has no options key yet (C-14), so it prints
 * `market` / `auction` until the backend registers one. */
export function label(list: readonly Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}

/** The two nav tabs over one ledger (`darz-studio.html:11750`): Market Sales
 * is the whole ledger (with a Source filter), Auction Sales is `?source=auction`. */
export type SalesTab = 'market' | 'auction';

export function salesTab(source: string | null): SalesTab {
  return source === 'auction' ? 'auction' : 'market';
}

/** The statuses the old "Open deals" tile counted — everything that is not
 * closed (`:12541`: stage neither `accounting` nor `rejected`; here neither
 * `completed`/`archived` nor `lost`). */
export const SALE_OPEN_STATUSES: readonly string[] = [
  'draft',
  'confirmed',
  'invoiced',
  'paid',
  'delivered',
];

export interface SaleTiles {
  open: number;
  payPending: number;
  completed: number;
  lost: number;
}

/** The strip's arithmetic over a per-status count map — the summary's
 * `by_status` (G-SALE-1) or one counted from rows. "Payment pending" is the
 * old `stage==='payment'` (`:12543`): here the two statuses between confirm
 * and paid. */
export function saleTiles(byStatus: Readonly<Record<string, number>>): SaleTiles {
  const n = (k: string) => byStatus[k] ?? 0;
  return {
    open: SALE_OPEN_STATUSES.reduce((sum, k) => sum + n(k), 0),
    payPending: n('confirmed') + n('invoiced'),
    completed: n('completed'),
    lost: n('lost'),
  };
}

/** Per-status counts over a set of rows — the Auction Sales tab's strip,
 * because the summary endpoint is ledger-wide and takes no `source`. */
export function countByStatus(rows: readonly { status: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1;
  return out;
}

/** "Need attention" — the rows whose follow-up is overdue. The server decides
 * overdue (`Sale.follow_up_overdue`: a past date on a deal not yet closed,
 * the old `salesFollowOverdue`, `:12373`). */
export function countOverdue(rows: readonly Pick<SaleAdmin, 'follow_up_overdue'>[]): number {
  return rows.filter((r) => r.follow_up_overdue).length;
}

/** The sort menu (`:12548`), cut to the four the server can order by. The
 * first option, "Recent first", is the server default (`-created`), so it is
 * the select's no-value option. */
export const SALE_SORT_DEFAULT = 'Recent first';
export const SALE_SORTS: readonly Choice[] = [
  { value: 'created', label: 'Oldest' },
  { value: '-price', label: 'Highest value' },
  { value: 'price', label: 'Lowest value' },
];

/** "Remind me in N days" (`setFollow`, `:12733`) — `salesToDate(now + N days)`,
 * the old `toISOString().slice(0,10)` (`:12277`). */
export function followUpIn(days: number, now: number = Date.now()): string {
  return new Date(now + days * 86_400_000).toISOString().slice(0, 10);
}

/** A note's stamp, the old `.dzs-note .m` line's first half (`:12634`):
 * `YYYY-MM-DD HH:MM`. */
export function noteStamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16).replace('T', ' ');
}
