/**
 * ActivityFeedController — the collector self-logged event log
 * (`GET /api/crm/admin/activity/`, backend Phase 28), as a `ListController`
 * binding. Kept apart from the feed component for fast refresh.
 */
import type { CrmService } from '../../api/services';
import type { CollectorActivityAdmin, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';

export interface ActivityQuery {
  collector?: string;
  kind?: string;
  artwork?: string;
  per_page?: number;
  page?: number;
}

export class ActivityFeedController extends ListController<
  CollectorActivityAdmin,
  ActivityQuery
> {
  private readonly crm: CrmService;
  constructor(crm: CrmService, initial: ActivityQuery = {}) {
    super(initial);
    this.crm = crm;
  }
  protected fetchPage(query: ActivityQuery): Promise<Paginated<CollectorActivityAdmin>> {
    return this.crm.adminActivity(query);
  }
}
