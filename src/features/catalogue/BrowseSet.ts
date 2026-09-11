/**
 * BrowseSet — the ordered set of artwork ids the collector is moving through,
 * so the artwork detail's previous / next arrows step within "the set the
 * collector came from" (SCREENS.md §04; app.html `dzNavIds`, v456). The
 * catalogue, an artist page and the saved list each publish their visible ids
 * when they render; the detail reads the set once. Kept in `sessionStorage`
 * so a reload of a deep link inside the set still has its neighbours, and so
 * nothing outlives the tab (never `localStorage` — it is navigation state, not
 * data).
 */
const KEY = 'darz_nav_ids';

export class BrowseSet {
  private readonly storage: Storage | null;

  constructor(storage: Storage | null = safeSession()) {
    this.storage = storage;
  }

  publish(ids: string[]): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* quota / private mode — arrows simply won't show */
    }
  }

  ids(): string[] {
    try {
      const raw = this.storage?.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : [];
    } catch {
      return [];
    }
  }

  /** The neighbours of `id` in the published set (null when `id` is not in it
   * or sits at an edge). */
  neighbours(id: string): { prev: string | null; next: string | null } {
    const ids = this.ids();
    const i = ids.indexOf(id);
    if (i < 0) return { prev: null, next: null };
    return { prev: i > 0 ? ids[i - 1] : null, next: i < ids.length - 1 ? ids[i + 1] : null };
  }
}

function safeSession(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

export const browseSet = new BrowseSet();
