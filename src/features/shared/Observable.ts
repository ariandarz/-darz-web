/**
 * Observable<S> — the store base every framework-free controller in this app
 * shares: one immutable snapshot, a listener set, and a `patch()` that swaps
 * the snapshot for a NEW object and notifies. That is exactly the
 * `getSnapshot()` / `subscribe()` contract `useSyncExternalStore` wants, and
 * the one `AuthSession` and `ThemeController` already expose by hand.
 *
 * Extracted in Phase 6: `ListController` (paginated list screens) and
 * `SavedController` (the saved-artworks registry) both need the same plumbing,
 * and a second class re-implementing the first one's listener/snapshot logic is
 * a bug, not a shortcut (CLAUDE.md, "Domain/logic layer — OOP with
 * inheritance"). Subclasses own their state machine; this owns notification.
 */
export type Unsubscribe = () => void;

export abstract class Observable<S extends object> {
  private snapshot: S;
  private readonly listeners = new Set<() => void>();

  protected constructor(initial: S) {
    this.snapshot = initial;
  }

  /** Stable between changes — safe to hand straight to `useSyncExternalStore`. */
  getSnapshot(): S {
    return this.snapshot;
  }

  subscribe(fn: () => void): Unsubscribe {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Merge a partial state, then notify. Always allocates a new snapshot so
   * subscribers see the change by identity. */
  protected patch(part: Partial<S>): void {
    this.snapshot = { ...this.snapshot, ...part };
    this.listeners.forEach((fn) => fn());
  }

  /** Replace the whole snapshot (used by `reset()`-style transitions). */
  protected replace(next: S): void {
    this.snapshot = next;
    this.listeners.forEach((fn) => fn());
  }
}
