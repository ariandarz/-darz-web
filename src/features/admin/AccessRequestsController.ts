/**
 * AccessRequestsController — the review queue
 * (`GET /api/auth/admin/access-requests/`, backend Phase 34). The server
 * defaults the list to `status=pending`, which is the old desk's only view —
 * a reviewed request leaves the queue (`:37370`'s "It leaves the pending
 * list."), it is not re-listed under another tab.
 */
import type { AdminAccountsService } from '../../api/services';
import type { AccessRequestAdmin, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';

export interface AccessRequestQuery {
  status?: string;
  search?: string;
  per_page?: number;
  page?: number;
}

export class AccessRequestsController extends ListController<
  AccessRequestAdmin,
  AccessRequestQuery
> {
  private readonly accounts: AdminAccountsService;

  constructor(accounts: AdminAccountsService, initial: AccessRequestQuery = {}) {
    super(initial);
    this.accounts = accounts;
  }

  protected fetchPage(query: AccessRequestQuery): Promise<Paginated<AccessRequestAdmin>> {
    return this.accounts.accessRequests(query);
  }
}
