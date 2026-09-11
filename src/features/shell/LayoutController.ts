/**
 * LayoutController — owns the *runtime* layout: mobile (the 430px frame with a
 * bottom nav) or desktop (`html.dz-desktop`: top nav, gutter-aligned pages,
 * wide grid). Faithful port of app.html's `wantDesktop()` + `applyTheme()`
 * (SCREENS.md §15, COMPONENTS.md § Shell / Navigation):
 *
 *   - `auto` picks by viewport width (≥ 900px → desktop) and a debounced
 *     `resize` listener re-evaluates, notifying only when the layout flips;
 *   - a per-device override (`localStorage.darz_layout` = 'mobile' | 'desktop',
 *     the toolbar's 🖥/📱 toggle) wins over the automatic choice.
 *
 * Same shape as `design/ThemeController`: framework-free, observable, one
 * singleton, a thin hook (`useLayout`) for React.
 */
export type LayoutName = 'mobile' | 'desktop';

const STORAGE_KEY = 'darz_layout';
const DESKTOP_MIN = 900; // tokens.json layout.breakpoints.desktop

type Listener = (layout: LayoutName) => void;

export class LayoutController {
  private current: LayoutName;
  private readonly listeners = new Set<Listener>();
  private readonly storage: Storage | null;
  private readonly root: HTMLElement | null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: { storage?: Storage | null; root?: HTMLElement | null } = {}) {
    this.storage =
      opts.storage !== undefined
        ? opts.storage
        : typeof localStorage !== 'undefined'
          ? localStorage
          : null;
    this.root =
      opts.root !== undefined
        ? opts.root
        : typeof document !== 'undefined'
          ? document.documentElement
          : null;
    this.current = this.resolve();
  }

  /** Apply the resolved layout and start watching the viewport. */
  start(): LayoutName {
    this.apply(this.current);
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onResize);
    }
    return this.current;
  }

  stop(): void {
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onResize);
  }

  get layout(): LayoutName {
    return this.current;
  }

  isDesktop(): boolean {
    return this.current === 'desktop';
  }

  /** The device override, if the collector set one with the toolbar toggle. */
  get override(): LayoutName | null {
    const v = this.storage?.getItem(STORAGE_KEY);
    return v === 'mobile' || v === 'desktop' ? v : null;
  }

  /** app.html `DZ.toggleLayout`: flip and remember for this device. */
  toggle(): LayoutName {
    const next: LayoutName = this.current === 'desktop' ? 'mobile' : 'desktop';
    try {
      this.storage?.setItem(STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable (private mode) — the flip still applies */
    }
    this.set(next);
    return next;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(next: LayoutName): void {
    if (next === this.current) return;
    this.current = next;
    this.apply(next);
    this.listeners.forEach((fn) => fn(next));
  }

  private resolve(): LayoutName {
    const forced = this.override;
    if (forced) return forced;
    const wide = typeof window !== 'undefined' && window.innerWidth >= DESKTOP_MIN;
    return wide ? 'desktop' : 'mobile';
  }

  private apply(layout: LayoutName): void {
    this.root?.classList.toggle('dz-desktop', layout === 'desktop');
  }

  private readonly onResize = (): void => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    // app.html debounces the re-evaluation so a drag-resize doesn't thrash.
    this.resizeTimer = setTimeout(() => this.set(this.resolve()), 120);
  };
}

export const layoutController = new LayoutController();
