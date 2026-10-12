/**
 * The Team desk's list controllers (G-TEAM-1).
 *
 * The old desk held each list whole in memory and drew every row, tile and
 * chip count from it (`myLoad()` / `ttLoad()` / `ctLoad()`, `:19226-19251`).
 * These lists are personal-desk sized, so the port reads them whole too —
 * every page, through the one walker (`walkPages`) — and keeps the
 * `ListController` state machine (status, error, stale-response guard) for it.
 *
 * What `WorkspaceListController` adds over the base is the one thing an
 * inline-edit desk needs and a read-only list does not: a write's answer is
 * applied to its row at once (`put`), so the row's `version` is current before
 * the next edit is made. Without that, changing a title and then a select on
 * the same row would send the second PATCH with the first one's version and
 * 409 against yourself. A reload that was already in flight when a write
 * landed cannot roll that row back either: rows are merged by `version`, and
 * the newer one wins.
 */
import { MAX_PER_PAGE, walkPages } from '../../../api/paging';
import type { WorkspaceService } from '../../../api/services';
import type {
  ContactQuery,
  PageQuery,
  Paginated,
  PricelistApproval,
  TeamTask,
  TeamTaskQuery,
  WorkspaceContact,
  WorkspaceItem,
  WorkspaceItemQuery,
} from '../../../api/types';
import { ListController } from '../../shared/ListController';

/** A list read whole — every page, through `walkPages` — and held as one
 * "page", so the desk can count, filter and order it the way the old one did
 * its in-memory store. */
export abstract class WholeListController<
  T,
  Q extends { page?: number; per_page?: number },
> extends ListController<T, Q> {
  /** Subclass hook: one page of the list for this query. */
  protected abstract fetchOne(query: Q): Promise<Paginated<T>>;

  /** Subclass hook: settle the fetched rows against what is on screen. */
  protected settle(fetched: T[]): T[] {
    return fetched;
  }

  protected async fetchPage(query: Q): Promise<Paginated<T>> {
    const fetched = await walkPages((page) =>
      this.fetchOne({ ...query, page, per_page: MAX_PER_PAGE }),
    );
    const results = this.settle(fetched);
    return {
      results,
      pagination: {
        page: 1,
        per_page: results.length,
        total_pages: 1,
        total_count: results.length,
        has_next: false,
        has_previous: false,
      },
    };
  }
}

interface Versioned {
  id: string;
  version: number;
}

/** A whole list the desk edits in place (see the file header). */
export abstract class WorkspaceListController<
  T extends Versioned,
  Q extends { page?: number; per_page?: number },
> extends WholeListController<T, Q> {
  /** Merged by version with what is on screen — the newer row wins. */
  protected override settle(fetched: T[]): T[] {
    const local = new Map(this.getSnapshot().results.map((r) => [r.id, r]));
    return fetched.map((r) => {
      const mine = local.get(r.id);
      return mine && mine.version > r.version ? mine : r;
    });
  }

  /** Apply a write's answer: replace the row (never with an older version),
   * or put a new one first, as the old desk's `unshift` did. */
  put(row: T): void {
    const rows = this.getSnapshot().results;
    const at = rows.findIndex((r) => r.id === row.id);
    if (at < 0) {
      this.patch({ results: [row, ...rows] });
      return;
    }
    if (rows[at].version > row.version) return;
    const next = rows.slice();
    next[at] = row;
    this.patch({ results: next });
  }

  /** A row the server deleted. */
  drop(id: string): void {
    this.patch({ results: this.getSnapshot().results.filter((r) => r.id !== id) });
  }
}

/** My workspace — `GET /workspace/items/` (owner-only). */
export class WorkspaceItemsController extends WorkspaceListController<
  WorkspaceItem,
  WorkspaceItemQuery
> {
  private readonly workspace: WorkspaceService;
  constructor(workspace: WorkspaceService) {
    super({});
    this.workspace = workspace;
  }
  protected fetchOne(query: WorkspaceItemQuery) {
    return this.workspace.items(query);
  }
}

/** Team workflow — `GET /workspace/team-tasks/` (admin). Newest first; the
 * desk then puts done tasks last, the old order (`:19323`). */
export class TeamTasksController extends WorkspaceListController<TeamTask, TeamTaskQuery> {
  private readonly workspace: WorkspaceService;
  constructor(workspace: WorkspaceService) {
    super({ ordering: '-created' });
    this.workspace = workspace;
  }
  protected fetchOne(query: TeamTaskQuery) {
    return this.workspace.teamTasks(query);
  }
}

/** Contacts — `GET /workspace/contacts/` (owner-only). Served in the desk's
 * order (high→med→low, then soonest follow-up), so a write that can move a
 * card (priority, next follow-up, a new contact) reloads rather than
 * re-sorting here. */
export class ContactsController extends WorkspaceListController<
  WorkspaceContact,
  ContactQuery
> {
  private readonly workspace: WorkspaceService;
  constructor(workspace: WorkspaceService) {
    super({});
    this.workspace = workspace;
  }
  protected fetchOne(query: ContactQuery) {
    return this.workspace.contacts(query);
  }
}

/** The pricelist-approvals inbox — `GET /workspace/pricelist-approvals/`
 * (W4, admin-visible, read-only): every `submitted` gallery pricelist across
 * all portal links, read whole like the old `paLoad()` (`:19230`) because the
 * Team tab's badge counts all of it. Acting on a row is the gallery's own
 * `POST /gallery/admin/pricelists/{id}/status/`, then a re-read — the row
 * leaves the inbox once it is no longer `submitted`. */
export class ApprovalsController extends WholeListController<PricelistApproval, PageQuery> {
  private readonly workspace: WorkspaceService;
  constructor(workspace: WorkspaceService) {
    super({});
    this.workspace = workspace;
  }
  protected fetchOne(query: PageQuery) {
    return this.workspace.pricelistApprovals(query);
  }
}
