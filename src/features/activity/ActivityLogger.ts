/**
 * ActivityLogger — the collector's own behavioural log
 * (`POST /api/crm/activity/`, `apps/crm/views.py:105`).
 *
 * The old app kept two stores: `app.actions` (the requests the collector
 * filed, which are `Request` rows here) and `app.activity` — a short
 * human-readable log of what they did (`Lib.logActivity`, app.html:2804).
 * This is that second one, over the backend's closed set of four kinds
 * (`ChoiceRegistry['crm.activity_kind']`): **view · save · search · login**.
 *
 * Rules, all of them deliberate:
 *   - **fire-and-forget.** Nothing on screen waits for this call and nothing
 *     on screen fails because of it. A rejection is swallowed: a lost
 *     behavioural row is not worth an error in front of a collector.
 *   - **`view` once per artwork per session.** The old app fired it once per
 *     work too (`dzLogCuratedView`, :9155, via `localStorage`); in-memory
 *     here, because offline is out (owner decision 2026-09-04) and a fresh
 *     session logging a fresh view is the honest reading.
 *   - **`search` only when the term settles**, and never the same term twice
 *     in a row — the toolbar debounces, this drops what the debounce lets
 *     through on a re-render.
 *
 * Two deliberate differences from the old app, both owner decisions
 * (D5a / D5b, 2026-09-17):
 *   - it logs a **view of any work**, where the old app logged only works in
 *     the collector's curated set — no curated set exists yet (backend Phase
 *     24), and the backend's recommendation profile consumes these rows;
 *   - it logs **search**, which the old app never did (`grep type:'search'`
 *     over `app.html` finds nothing) although the backend has always had the
 *     kind.
 */
import type { CrmService } from '../../api/services';

/** `apps/crm/models.py:24-33` — the closed set the backend accepts. */
export type ActivityKind = 'view' | 'save' | 'search' | 'login';

/** Only what this logger needs, so a test does not build a whole service. */
export interface ActivitySink {
  logActivity: CrmService['logActivity'];
}

export class ActivityLogger {
  private readonly crm: ActivitySink;
  /** artworks already logged as viewed in this session */
  private readonly viewed = new Set<string>();
  /** the last term logged, so a re-render cannot log it again */
  private lastSearch: string | null = null;

  constructor(crm: ActivitySink) {
    this.crm = crm;
  }

  /** app.html:2347 — "Signed in · Collector NNN". */
  login(): void {
    this.send('login');
  }

  /** app.html:2806 — a save only; unsaving is not an event the old app kept. */
  save(artworkId: string): void {
    this.send('save', artworkId);
  }

  /** The artwork detail was opened — once per work per session. */
  view(artworkId: string): void {
    if (!artworkId || this.viewed.has(artworkId)) return;
    this.viewed.add(artworkId);
    this.send('view', artworkId);
  }

  /** A settled, non-empty catalogue search. */
  search(term: string): void {
    const q = term.trim();
    if (!q || q === this.lastSearch) return;
    this.lastSearch = q;
    this.send('search', undefined, { q });
  }

  /** Drop the per-session memory — on logout, or when a different collector
   * signs into the same tab, so one collector's views never suppress
   * another's. */
  reset(): void {
    this.viewed.clear();
    this.lastSearch = null;
  }

  private send(
    kind: ActivityKind,
    artwork?: string,
    metadata?: Record<string, unknown>,
  ): void {
    // the try/catch is not redundant with the `.catch`: a synchronous throw
    // from the client (a bad base URL, a missing session) happens BEFORE a
    // promise exists, and would otherwise escape into whatever the collector
    // was doing — a save, a search, signing in.
    try {
      void Promise.resolve(
        this.crm.logActivity({
          kind,
          ...(artwork ? { artwork } : {}),
          ...(metadata ? { metadata } : {}),
        }),
      ).catch(() => {
        /* behavioural telemetry: never surfaced, never retried, never blocking */
      });
    } catch {
      /* same rule, for a throw that never became a promise */
    }
  }
}
