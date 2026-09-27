/**
 * SalesController — the deals ledger (`GET /api/sales/admin/sales/`, backend
 * Phase 7). Query params are the server's own `SaleAdminFilterSet`
 * (G-SALE-2): `search`, exact `status` / `payment_status` / `delivery_status`
 * / `source`, and `ordering`. The old desk's filter bar (`darz-studio.html:
 * 12576-12581`) filtered and sorted its in-memory deal store client-side; here
 * every control is one of these params.
 *
 * One controller serves both nav tabs (`:11750`): Market Sales is the whole
 * ledger, Auction Sales is the same list with a fixed `scope` of
 * `{source: 'auction'}` that no filter can clear — the old `SALES.src` axis
 * (`:12511-12512`).
 *
 * It also reads the tab's header strip (`readStrip`): the old desk counted its
 * four tiles over the whole deal store (`:12540-12543`), which a paginated list
 * cannot do from the page it holds.
 */
import { MAX_PER_PAGE, walkPages } from '../../api/paging';
import type { SalesAdminService } from '../../api/services';
import type { Paginated, SaleAdmin, SaleQuery } from '../../api/types';
import { ListController } from '../shared/ListController';
import { countByStatus, countOverdue, saleTiles, type SaleTiles } from './saleForm';

/** The strip over one tab's scope. */
export interface SalesStrip {
  tiles: SaleTiles;
  /** "Need attention" — overdue follow-ups (see `countOverdue`). */
  attention: number;
  /** The sub-line's "N total" (`:12568`). */
  total: number;
  /** The `source` values the ledger knows (the summary's `by_source` keys) —
   * the Source filter's options, since `/api/options/` has none (C-14). */
  sources: string[];
}

export class SalesController extends ListController<SaleAdmin, SaleQuery> {
  private readonly sales: SalesAdminService;
  /** Params every read carries, whatever the filters say (the tab's axis). */
  private readonly scope: SaleQuery;

  constructor(sales: SalesAdminService, initial: SaleQuery = {}, scope: SaleQuery = {}) {
    super(initial);
    this.sales = sales;
    this.scope = scope;
  }

  protected fetchPage(query: SaleQuery): Promise<Paginated<SaleAdmin>> {
    return this.sales.sales({ ...query, ...this.scope });
  }

  /**
   * The strip's numbers.
   *
   * - **Unscoped (Market Sales)**: the four status tiles and the total come
   *   from `summary/` (G-SALE-1) — one read in place of the four
   *   `per_page=1` status counts this desk used to make.
   * - **Scoped (Auction Sales)**: the summary is ledger-wide and takes no
   *   `source`, so the tab counts its own rows. Auction sales are one per won
   *   lot, so the walk is short.
   *
   * "Need attention" has no aggregate at all — `follow_up_overdue` is a
   * per-row property the server computes and cannot filter or count — so it
   * is counted over a walk of the scope's rows in both cases. Backend
   * candidate: an overdue count on `summary/` (or `?follow_up_overdue=`).
   */
  async readStrip(): Promise<SalesStrip> {
    const walk = () =>
      walkPages((page) => this.sales.sales({ ...this.scope, page, per_page: MAX_PER_PAGE }));

    if (this.scope.source) {
      const rows = await walk();
      return {
        tiles: saleTiles(countByStatus(rows)),
        attention: countOverdue(rows),
        total: rows.length,
        sources: [],
      };
    }
    const [summary, rows] = await Promise.all([this.sales.summary(), walk()]);
    return {
      tiles: saleTiles(summary.by_status ?? {}),
      attention: countOverdue(rows),
      total: summary.total,
      sources: Object.keys(summary.by_source ?? {}),
    };
  }
}
