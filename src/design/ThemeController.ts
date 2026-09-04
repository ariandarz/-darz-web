/**
 * ThemeController — owns the *runtime* theme: which `Theme` is active, the
 * `html.dz-bw` class, per-device persistence, and the initial resolve
 * (stored choice → OS `prefers-color-scheme` → Paper).
 *
 * Mirrors app.html's in-app moon toggle: a real dark theme, remembered per
 * device (app.html persists the choice before first paint).
 *
 * Framework-free on purpose — a `useTheme()` hook can wrap it later without
 * changing this class.
 */
import { Theme } from './Theme';
import type { ThemeName } from './tokens';

const STORAGE_KEY = 'dz-theme';
type Listener = (theme: Theme) => void;

export class ThemeController {
  private current: Theme;
  private readonly listeners = new Set<Listener>();
  private readonly storage: Storage | null;
  private readonly root: HTMLElement | null;

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
    this.current = Theme.byName(this.resolveInitial());
  }

  /** Read + apply the stored/OS theme. Call once, as early as possible. */
  start(): Theme {
    this.apply(this.current);
    return this.current;
  }

  get theme(): Theme {
    return this.current;
  }

  is(name: ThemeName): boolean {
    return this.current.name === name;
  }

  set(name: ThemeName, opts: { persist?: boolean } = {}): Theme {
    const next = Theme.byName(name);
    if (next.name !== this.current.name) {
      this.current = next;
      this.apply(next);
      this.listeners.forEach((fn) => fn(next));
    }
    if (opts.persist !== false) this.persist(next.name);
    return next;
  }

  /** Paper ⇄ Black. */
  toggle(): Theme {
    return this.set(this.current.isDark() ? 'light' : 'bw');
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private resolveInitial(): ThemeName {
    const stored = this.storage?.getItem(STORAGE_KEY);
    if (stored === 'bw' || stored === 'light') return stored;
    const prefersDark =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'bw' : 'light';
  }

  private persist(name: ThemeName): void {
    try {
      this.storage?.setItem(STORAGE_KEY, name);
    } catch {
      /* private-mode / disabled storage — non-fatal */
    }
  }

  private apply(theme: Theme): void {
    if (!this.root) return;
    this.root.classList.toggle('dz-bw', theme.htmlClass === 'dz-bw');
    this.root.style.colorScheme = theme.isDark() ? 'dark' : 'light';
  }
}

/** Process-wide singleton for app code; tests construct their own. */
export const themeController = new ThemeController();
