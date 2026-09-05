/**
 * SavedController — the collector's saved works.
 *
 * **The server is the source of truth, never `localStorage`.** Owner decision
 * (2026-09-04, `docs/TASKLIST.md`): offline = NO. The old app kept a local
 * `saved`/`deleted` pair plus a `darz_save_edit` marker and reconciled them by
 * hand — that was its main bug class, and it is deliberately not ported. This
 * controller holds the saved set **in memory for the tab's lifetime only**;
 * every reload re-reads `GET /api/crm/saved/`, which is why the saved state is
 * still correct after a refresh.
 *
 * One controller serves both consumers, so they can never disagree:
 *   - `SaveButton` on a card / the artwork detail asks `isSaved(id)`;
 *   - `SavedItemsPage` renders `items` directly.
 *
 * Snapshot + observer plumbing is inherited from `Observable` (shared with
 * `ListController`); this class owns only the saved-set state machine.
 *
 * API shape it wraps (see `docs/PHASE_6_API_GAPS.md` for what's missing):
 *   GET    /api/crm/saved/                 → paginated `SavedArtwork[]`
 *   POST   /api/crm/saved/  {artwork}      → idempotent; re-saving restores a
 *                                            soft-deleted row
 *   DELETE /api/crm/saved/{artwork_id}/    → soft-delete, 204; 404 if none
 */
import { HttpError } from '../../api/errors';
import type { CrmService } from '../../api/services';
import type { SavedArtwork } from '../../api/types';
import { Observable } from '../shared/Observable';

/** `per_page` for the initial full read. 100 is the API's documented ceiling. */
const PAGE_SIZE = 100;
/** Safety stop for the page walk — 20 × 100 works. A collector past this has a
 * saved list far beyond anything the old app showed; see gap G-P6-1, which
 * asks for `is_saved` on the artwork payload so this walk isn't needed at all. */
const MAX_PAGES = 20;

export type SavedStatus = 'idle' | 'loading' | 'ready' | 'error';
export type SaveOp = 'save' | 'unsave';

export interface SavedActionResult {
  artworkId: string;
  op: SaveOp;
  /** monotonic, so a repeat of the same action still re-triggers the toast */
  at: number;
}

export interface SavedActionFailure extends SavedActionResult {
  message: string;
}

export interface SavedSnapshot {
  /** state of the one full read of the saved set */
  status: SavedStatus;
  /** the collector's saved rows, newest-first as the API returns them */
  items: SavedArtwork[];
  /** artwork ids in `items` — the `isSaved()` index */
  ids: ReadonlySet<string>;
  /** artwork ids with a save/unsave call in flight (the duplicate-action guard) */
  pending: ReadonlySet<string>;
  /** failure of the initial/refresh read */
  error: string | null;
  /** failure of the last save/unsave */
  actionError: SavedActionFailure | null;
  /** success of the last save/unsave — drives the confirmation toast */
  lastAction: SavedActionResult | null;
}

const EMPTY: SavedSnapshot = {
  status: 'idle',
  items: [],
  ids: new Set(),
  pending: new Set(),
  error: null,
  actionError: null,
  lastAction: null,
};

export class SavedController extends Observable<SavedSnapshot> {
  private readonly crm: CrmService;
  /** in-flight full read, shared by concurrent `ensureLoaded()` callers */
  private loading: Promise<void> | null = null;
  /** bumped by reload()/reset() — a response from an older token is dropped */
  private token = 0;

  constructor(crm: CrmService) {
    super(EMPTY);
    this.crm = crm;
  }

  // --- reads ---------------------------------------------------------------

  isSaved(artworkId: string): boolean {
    return this.getSnapshot().ids.has(artworkId);
  }

  /** True while this artwork's own save/unsave is in flight. */
  isPending(artworkId: string): boolean {
    return this.getSnapshot().pending.has(artworkId);
  }

  /** Read the saved set once per session. Repeat calls while a read is in
   * flight share that promise instead of firing a second one. */
  ensureLoaded(): Promise<void> {
    if (this.getSnapshot().status === 'ready') return Promise.resolve();
    return this.reload();
  }

  /** Re-read from the server — used by the Saved page's "Try again". */
  reload(): Promise<void> {
    if (this.loading) return this.loading;
    const mine = ++this.token;
    this.patch({ status: 'loading', error: null });

    this.loading = this.fetchAll()
      .then((items) => {
        if (mine !== this.token) return;
        this.patch({ items, ids: idsOf(items), status: 'ready', error: null });
      })
      .catch((err: unknown) => {
        if (mine !== this.token) return;
        this.patch({ status: 'error', error: messageOf(err) });
      })
      .finally(() => {
        this.loading = null;
      });

    return this.loading;
  }

  /** Drop everything (logout, or a different collector signing in). */
  reset(): void {
    this.token += 1;
    this.loading = null;
    this.replace(EMPTY);
  }

  // --- writes --------------------------------------------------------------

  /** Save this artwork. No-op if a call for it is already in flight. */
  async save(artworkId: string): Promise<void> {
    if (!this.begin(artworkId)) return;
    try {
      const row = await this.crm.save(artworkId);
      // POST is idempotent server-side, so re-saving returns the existing row;
      // filter first so it can never appear twice in the list.
      const items = [row, ...this.getSnapshot().items.filter((i) => rowId(i) !== artworkId)];
      this.patch({ items, ids: idsOf(items), lastAction: result(artworkId, 'save') });
    } catch (err: unknown) {
      this.patch({ actionError: failure(artworkId, 'save', messageOf(err)) });
    } finally {
      this.end(artworkId);
    }
  }

  /** Unsave this artwork. No-op if a call for it is already in flight. */
  async unsave(artworkId: string): Promise<void> {
    if (!this.begin(artworkId)) return;
    try {
      await this.crm.unsave(artworkId);
      this.dropLocally(artworkId, 'unsave');
    } catch (err: unknown) {
      // 404 = there is no saved row for this artwork. The caller's intent
      // ("it should not be saved") already holds, so treat it as done rather
      // than showing an error for a state the collector already has.
      if (err instanceof HttpError && err.status === 404) {
        this.dropLocally(artworkId, 'unsave');
      } else {
        this.patch({ actionError: failure(artworkId, 'unsave', messageOf(err)) });
      }
    } finally {
      this.end(artworkId);
    }
  }

  /** Flip the current state. The button's single entry point. */
  toggle(artworkId: string): Promise<void> {
    return this.isSaved(artworkId) ? this.unsave(artworkId) : this.save(artworkId);
  }

  /** Dismiss the confirmation toast. */
  clearLastAction(): void {
    if (this.getSnapshot().lastAction) this.patch({ lastAction: null });
  }

  /** Dismiss the inline error. */
  clearActionError(): void {
    if (this.getSnapshot().actionError) this.patch({ actionError: null });
  }

  // --- internals -----------------------------------------------------------

  /** Walk every page of the saved list. `GET /api/crm/saved/` documents no
   * query params (gap G-P6-2), but `page`/`per_page` are served by the global
   * `CustomPagination` — the same undocumented-but-real params Phase 4's
   * catalogue already relies on. */
  private async fetchAll(): Promise<SavedArtwork[]> {
    const out: SavedArtwork[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const data = await this.crm.saved({ page, per_page: PAGE_SIZE });
      out.push(...data.results);
      if (!data.pagination?.has_next) break;
    }
    return out;
  }

  /** Claim the in-flight slot for this artwork. `false` = a call is already
   * running for it, so the caller must do nothing (the duplicate-action guard
   * behind "prevent duplicate actions while a request is pending"). */
  private begin(artworkId: string): boolean {
    const { pending } = this.getSnapshot();
    if (pending.has(artworkId)) return false;
    const next = new Set(pending);
    next.add(artworkId);
    this.patch({ pending: next, actionError: null });
    return true;
  }

  private end(artworkId: string): void {
    const next = new Set(this.getSnapshot().pending);
    next.delete(artworkId);
    this.patch({ pending: next });
  }

  private dropLocally(artworkId: string, op: SaveOp): void {
    const items = this.getSnapshot().items.filter((i) => rowId(i) !== artworkId);
    this.patch({ items, ids: idsOf(items), lastAction: result(artworkId, op) });
  }
}

// --- helpers ---------------------------------------------------------------

/** The artwork id a saved row points at. `artwork` is embedded by
 * `SavedArtworkSerializer`; guarded because `Artwork.artist`-style nullability
 * has bitten this codebase before (see `api/types.ts`). */
function rowId(row: SavedArtwork): string | null {
  return row.artwork?.id ?? null;
}

function idsOf(items: SavedArtwork[]): ReadonlySet<string> {
  const set = new Set<string>();
  items.forEach((row) => {
    const id = rowId(row);
    if (id) set.add(id);
  });
  return set;
}

function result(artworkId: string, op: SaveOp): SavedActionResult {
  return { artworkId, op, at: Date.now() };
}

function failure(artworkId: string, op: SaveOp, message: string): SavedActionFailure {
  return { ...result(artworkId, op), message };
}

/** Calm and factual — never a stack trace (VOICE_AND_COPY.md). */
function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong.';
}
