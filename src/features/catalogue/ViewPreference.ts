/**
 * ViewPreference — the catalogue's grid ⇄ single-view choice, a per-device
 * preference like app.html's `darz_viewm` (SCREENS.md §03: "A per-device
 * preference"). Framework-free and observable, the same shape as
 * `ThemeController` / `LayoutController`.
 */
export type ViewMode = 'grid' | 'solo';

const STORAGE_KEY = 'darz_viewm';
type Listener = (mode: ViewMode) => void;

export class ViewPreference {
  private current: ViewMode;
  private readonly listeners = new Set<Listener>();
  private readonly storage: Storage | null;

  constructor(storage: Storage | null = safeStorage()) {
    this.storage = storage;
    const stored = this.storage?.getItem(STORAGE_KEY);
    this.current = stored === 'solo' ? 'solo' : 'grid';
  }

  get mode(): ViewMode {
    return this.current;
  }

  set(mode: ViewMode): void {
    if (mode === this.current) return;
    this.current = mode;
    try {
      this.storage?.setItem(STORAGE_KEY, mode);
    } catch {
      /* private mode — the choice still applies for this session */
    }
    this.listeners.forEach((fn) => fn(mode));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export const viewPreference = new ViewPreference();
