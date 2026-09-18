/**
 * CollectorsController — the admin Collectors roster
 * (`GET /api/auth/admin/collectors/`, backend Phase 27). Query params are the
 * server's own `CollectorFilterSet`: `search` over name/email/phone, exact
 * `tier` / `access_status`, `ordering` name|-name|created|-created.
 *
 * All the query/pagination/stale-response state comes from the shared
 * `ListController` base — this class only wires the call, same shape as
 * `AdminRequestsController`.
 */
import type { AdminAccountsService } from '../../api/services';
import type { CollectorAdmin, CollectorAdminQuery, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';

export class CollectorsController extends ListController<CollectorAdmin, CollectorAdminQuery> {
  private readonly accounts: AdminAccountsService;

  constructor(accounts: AdminAccountsService, initial: CollectorAdminQuery = {}) {
    super(initial);
    this.accounts = accounts;
  }

  protected fetchPage(query: CollectorAdminQuery): Promise<Paginated<CollectorAdmin>> {
    return this.accounts.collectors(query);
  }
}
