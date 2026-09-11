/**
 * DevicePreferences — the Settings toggles the old app keeps per device in
 * `localStorage` (`getSettings()` / `DZ.toggle`, app.html `settingsView()`):
 * the three notification switches and the app language. Nothing here reaches
 * the server — same as the shipped app, where these are device preferences.
 * Observable so the Settings rows re-render on a flip.
 */
export interface DevicePrefs {
  newArrivals: boolean;
  auctionReminders: boolean;
  offerUpdates: boolean;
  lang: string;
}

const KEY = 'darz_settings';
const DEFAULTS: DevicePrefs = {
  newArrivals: true,
  auctionReminders: true,
  offerUpdates: true,
  lang: 'en',
};
type Listener = (prefs: DevicePrefs) => void;

export class DevicePreferences {
  private current: DevicePrefs;
  private readonly listeners = new Set<Listener>();
  private readonly storage: Storage | null;

  constructor(storage: Storage | null = safeStorage()) {
    this.storage = storage;
    this.current = this.read();
  }

  get prefs(): DevicePrefs {
    return this.current;
  }

  set<K extends keyof DevicePrefs>(key: K, value: DevicePrefs[K]): void {
    this.current = { ...this.current, [key]: value };
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.current));
    } catch {
      /* private mode */
    }
    this.listeners.forEach((fn) => fn(this.current));
  }

  toggle(key: 'newArrivals' | 'auctionReminders' | 'offerUpdates'): void {
    this.set(key, !this.current[key]);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private read(): DevicePrefs {
    try {
      const raw = this.storage?.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object'
        ? { ...DEFAULTS, ...(parsed as Partial<DevicePrefs>) }
        : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export const devicePreferences = new DevicePreferences();
