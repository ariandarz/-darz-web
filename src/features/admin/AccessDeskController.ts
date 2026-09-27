/**
 * AccessDeskController — the owner Access desk's roster
 * (`GET /api/auth/admin/access-keys/`, G-KEY-1). Query/paging/stale-response
 * state is the shared `ListController` base; this class wires the call through
 * `rosterQuery()`, so a control that is off never reaches the query string.
 */
import type { AdminAccountsService } from '../../api/services';
import type { AccessKeyRoster, AccessKeyRosterQuery, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';
import { rosterQuery } from './accessDesk';

type RosterSource = Pick<AdminAccountsService, 'accessKeysRoster'>;

export class AccessDeskController extends ListController<
  AccessKeyRoster,
  AccessKeyRosterQuery
> {
  private readonly accounts: RosterSource;

  constructor(accounts: RosterSource, initial: AccessKeyRosterQuery = {}) {
    super(initial);
    this.accounts = accounts;
  }

  protected fetchPage(query: AccessKeyRosterQuery): Promise<Paginated<AccessKeyRoster>> {
    return this.accounts.accessKeysRoster(rosterQuery(query));
  }
}
