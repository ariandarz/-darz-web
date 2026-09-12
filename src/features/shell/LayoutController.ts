/**
 * LayoutController — owns the `html.dz-desktop` class, the old app's one
 * responsive switch (`wantDesktop()`, app.html:2936-2945): the desktop layout
 * is the SAME app shown on large screens, chosen by viewport width against
 * `DZ_DESK_BP = 900` (app.html:2924), with a per-device override in
 * `localStorage.darz_layout` (`'mobile'` | `'desktop'`). A phone can never be
 * stranded in the wide layout: `'desktop'` still needs the viewport.
 *
 * The owner-side `theme.appLayout` / `appDesktopMode` gates are not ported —
 * the new backend has no owner theme yet — so this resolves `auto` only.
 *
 * Framework-free like `ThemeController`; `AppShell` starts/stops it.
 */
export const DESKTOP_BREAKPOINT = 900;
const STORAGE_KEY = 'darz_layout';

export type LayoutOverride = 'mobile' | 'desktop' | null;

export class LayoutController {
  private readonly storage: Storage | null;
  private readonly root: HTMLElement | null;
  private readonly listeners = new Set<() => void>();
  private desktop = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly onResize = () => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.apply(), 120); // debounced, like app.html
  };

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
  }

  /** app.html:2936-2945 — the decision, pure. */
  static wantDesktop(viewportWidth: number, override: LayoutOverride): boolean {
    if (override === 'mobile') return false;
    return viewportWidth >= DESKTOP_BREAKPOINT;
  }

  get isDesktop(): boolean {
    return this.desktop;
  }

  override(): LayoutOverride {
    try {
      const v = this.storage?.getItem(STORAGE_KEY);
      return v === 'mobile' || v === 'desktop' ? v : null;
    } catch {
      return null;
    }
  }

  /** The per-device toggle (the old toolbar 🖥/📱, `DZ.toggleLayout`). */
  setOverride(value: LayoutOverride): void {
    try {
      if (value) this.storage?.setItem(STORAGE_KEY, value);
      else this.storage?.removeItem(STORAGE_KEY);
    } catch {
      /* private mode — non-fatal */
    }
    this.apply();
  }

  start(): void {
    this.apply();
    if (typeof window !== 'undefined') window.addEventListener('resize', this.onResize);
  }

  stop(): void {
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onResize);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private apply(): void {
    const vw =
      typeof window !== 'undefined'
        ? window.innerWidth || document.documentElement.clientWidth || 0
        : 0;
    const next = LayoutController.wantDesktop(vw, this.override());
    if (next === this.desktop && this.root?.classList.contains('dz-desktop') === next) return;
    this.desktop = next;
    this.root?.classList.toggle('dz-desktop', next);
    this.listeners.forEach((fn) => fn());
  }
}

export const layoutController = new LayoutController();
