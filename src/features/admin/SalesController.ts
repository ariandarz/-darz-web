/**
 * SalesController — the deals ledger (`GET /api/sales/admin/sales/`, backend
 * Phase 7). The server's one filter is `status` (G-SALE-2: no search, no
 * payment/delivery filter); everything else the old desk filtered by is a
 * stated absence on the page.
 */
import type { SalesAdminService } from '../../api/services';
import type { Paginated, SaleAdmin, SaleQuery } from '../../api/types';
import { ListController } from '../shared/ListController';

export class SalesController extends ListController<SaleAdmin, SaleQuery> {
  private readonly sales: SalesAdminService;

  constructor(sales: SalesAdminService, initial: SaleQuery = {}) {
    super(initial);
    this.sales = sales;
  }

  protected fetchPage(query: SaleQuery): Promise<Paginated<SaleAdmin>> {
    return this.sales.sales(query);
  }
}
