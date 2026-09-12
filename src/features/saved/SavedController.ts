/**
 * SavedController — the collector's save/unsave actions and the local
 * "did I just change this" overlay for them.
 *
 * **The server is the source of truth, never `localStorage`.** Owner decision
 * (2026-09-04, `docs/TASKLIST.md`): offline = NO.
 *
 * Rewritten for `docs/PHASE_6_API_GAPS.md` G-P6-1: `ArtworkCollectorSerializer`
 * now carries `is_saved`/`saved_at` directly, computed server-side in the same
 * request that fetches the artwork — so this controller no longer walks every
 * page of `GET /api/crm/saved/` into memory just to answer "is this saved?"
 * (the old design's own comment predicted exactly this: "the registry could
 * shrink to just the writes"). `isSaved(artwork)` now reads `artwork.is_saved`
 * by default and only consults its own state for an artwork this tab has
 * itself just saved/unsaved — a small **override map**, not a full index.
 *
 * The dedicated Saved page (`/saved`) no longer needs an eager full-list read
 * either: it is a normal paginated list now, `SavedListController`, built on
 * the shared `ListController` base like the catalogue and artist lists.
 *
 * One controller still serves every `SaveButton` on screen, so a card, the
 * detail page, and the Saved page can never show different answers for a
 * write made *this session* — the override map is shared state, not per-
 * component. What it does NOT do any more is tell you the saved state of an
 * artwork it has never been told about; for that, trust `artwork.is_saved`.
 *
 * API shape it wraps:
 *   POST   /api/crm/saved/  {artwork}      → idempotent; `created` says
 *                                            whether this was new/restored
 *                                            vs. already-saved (G-P6-3)
 *   DELETE /api/crm/saved/{artwork_id}/    → soft-delete, 204; 404 if none
 */
import { HttpError } from '../../api/errors';
import type { CrmService } from '../../api/services';
import { Observable } from '../shared/Observable';

export type SaveOp = 'save' | 'unsave';

export interface SavedActionResult {
  artworkId: string;
  op: SaveOp;
  /** whether the server actually created/restored a row (G-P6-3) — false for
   * a save that was already in effect, or an unsave that was already a no-op */
  created: boolean;
  /** monotonic, so a repeat of the same action still re-triggers the toast */
  at: number;
}

export interface SavedActionFailure extends SavedActionResult {
  message: string;
}

export interface SavedSnapshot {
  /** this tab's own writes this session: artworkId -> is it saved now.
   * Consulted only as an override on top of the server-provided
   * `artwork.is_saved` — never the sole source of truth. */
  overrides: ReadonlyMap<string, boolean>;
  /** artwork ids with a save/unsave call in flight (the duplicate-action guard) */
  pending: ReadonlySet<string>;
  /** failure of the last save/unsave */
  actionError: SavedActionFailure | null;
  /** success of the last save/unsave — drives the confirmation toast */
  lastAction: SavedActionResult | null;
}

const EMPTY: SavedSnapshot = {
  overrides: new Map(),
  pending: new Set(),
  actionError: null,
  lastAction: null,
};

export class SavedController extends Observable<SavedSnapshot> {
  private readonly crm: CrmService;

  constructor(crm: CrmService) {
    super(EMPTY);
    this.crm = crm;
  }

  // --- reads ---------------------------------------------------------------

  /** This tab's override if it has one, else the artwork's own `is_saved`
   * (already computed server-side — see `ArtworkCollectorSerializer`). */
  isSaved(artwork: { id: string; is_saved?: boolean }): boolean {
    const { overrides } = this.getSnapshot();
    return overrides.has(artwork.id)
      ? (overrides.get(artwork.id) ?? false)
      : (artwork.is_saved ?? false);
  }

  /** True while this artwork's own save/unsave is in flight. */
  isPending(artworkId: string): boolean {
    return this.getSnapshot().pending.has(artworkId);
  }

  /** Drop everything (logout, or a different collector signing in). */
  reset(): void {
    this.replace(EMPTY);
  }

  // --- writes --------------------------------------------------------------

  /** Save this artwork. No-op if a call for it is already in flight. */
  async save(artworkId: string): Promise<void> {
    if (!this.begin(artworkId)) return;
    try {
      const row = await this.crm.save(artworkId);
      this.setOverride(artworkId, true);
      this.patch({ lastAction: result(artworkId, 'save', row.created) });
    } catch (err: unknown) {
      this.patch({ actionError: failure(artworkId, 'save', false, messageOf(err)) });
    } finally {
      this.end(artworkId);
    }
  }

  /** Unsave this artwork. No-op if a call for it is already in flight. */
  async unsave(artworkId: string): Promise<void> {
    if (!this.begin(artworkId)) return;
    try {
      await this.crm.unsave(artworkId);
      this.setOverride(artworkId, false);
      this.patch({ lastAction: result(artworkId, 'unsave', true) });
    } catch (err: unknown) {
      // 404 = there is no saved row for this artwork. The caller's intent
      // ("it should not be saved") already holds, so treat it as done rather
      // than showing an error for a state the collector already has.
      if (err instanceof HttpError && err.status === 404) {
        this.setOverride(artworkId, false);
        this.patch({ lastAction: result(artworkId, 'unsave', false) });
      } else {
        this.patch({ actionError: failure(artworkId, 'unsave', false, messageOf(err)) });
      }
    } finally {
      this.end(artworkId);
    }
  }

  /** Flip the current state. The button's single entry point. */
  toggle(artwork: { id: string; is_saved?: boolean }): Promise<void> {
    return this.isSaved(artwork) ? this.unsave(artwork.id) : this.save(artwork.id);
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

  private setOverride(artworkId: string, saved: boolean): void {
    const next = new Map(this.getSnapshot().overrides);
    next.set(artworkId, saved);
    this.patch({ overrides: next });
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
}

// --- helpers ---------------------------------------------------------------

function result(artworkId: string, op: SaveOp, created: boolean): SavedActionResult {
  return { artworkId, op, created, at: Date.now() };
}

function failure(
  artworkId: string,
  op: SaveOp,
  created: boolean,
  message: string,
): SavedActionFailure {
  return { ...result(artworkId, op, created), message };
}

/** Calm and factual — never a stack trace (VOICE_AND_COPY.md). */
function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong.';
}
