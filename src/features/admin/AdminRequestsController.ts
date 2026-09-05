/**
 * AdminRequestsController — the unified admin request feed
 * (`GET /api/crm/admin/requests/`), filterable by kind / status / assignee.
 *
 * All the query/pagination/stale-response state comes from the shared
 * `ListController` base, the same seam `CatalogueController` and
 * `ArtistListController` use; this class only wires the call and the
 * transition action.
 */
import type { CrmService } from '../../api/services';
import type { AdminRequest, AdminRequestQuery, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';

export class AdminRequestsController extends ListController<AdminRequest, AdminRequestQuery> {
  private readonly crm: CrmService;

  constructor(crm: CrmService, initial: AdminRequestQuery = {}) {
    super(initial);
    this.crm = crm;
  }

  protected fetchPage(query: AdminRequestQuery): Promise<Paginated<AdminRequest>> {
    return this.crm.adminRequests(query);
  }

  /** Move one request to another status, then re-read the page so the feed
   * shows the server's result rather than an optimistic guess. `RequestAdmin`
   * carries a `version` optimistic-lock counter; a 409 surfaces as the list's
   * error, per the Phase 7 optimistic-lock rule in docs/TASKLIST.md. */
  async transition(id: string, toStatus: string, note = ''): Promise<void> {
    await this.crm.transitionRequest(id, toStatus, note);
    await this.reload();
  }
}
