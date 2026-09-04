/**
 * AuthSession — owns the JWT pair and the login/refresh/logout/me lifecycle.
 *
 * Storage (owner decision 2026-09-04): the **access** token lives in memory
 * only (a private field) so an XSS payload can't lift it from storage; the
 * **refresh** token is persisted in `localStorage` (`dz-refresh`) so a reload
 * silently re-establishes the session. Online-only — nothing else is cached.
 *
 * Same shape as `design/ThemeController`: framework-free, observable via
 * `subscribe()`, exposed to React through a thin hook.
 *
 * Extends `HttpClient` because it *is* an HTTP-speaking thing (the auth
 * transport); `ApiClient` composes one of these for the resource services.
 */
import { HttpClient } from './HttpClient';
import type { components } from './schema';

const REFRESH_KEY = 'dz-refresh';

type TokenPair = { access: string; refresh: string };
export type Me = components['schemas']['Me'];
export type Principal = Me['principal'];

/** Immutable view for React — a new object only when something changed, so
 * `useSyncExternalStore` can use it directly as the snapshot. */
export interface SessionSnapshot {
  isAuthenticated: boolean;
  principal: Principal | null;
  me: Me | null;
}

type Listener = (session: AuthSession) => void;

export class AuthSession extends HttpClient {
  private access: string | null = null;
  private refreshToken: string | null = null;
  private user: Me | null = null;
  private refreshing: Promise<void> | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly storage: Storage | null;
  private snapshot: SessionSnapshot;

  constructor(baseUrl: string, storage: Storage | null = safeLocalStorage()) {
    super(baseUrl);
    this.storage = storage;
    this.refreshToken = this.readStored();
    this.snapshot = this.buildSnapshot();
  }

  /** Stable between changes — safe as a `useSyncExternalStore` snapshot. */
  getSnapshot(): SessionSnapshot {
    return this.snapshot;
  }

  private buildSnapshot(): SessionSnapshot {
    return {
      isAuthenticated: this.access !== null || this.refreshToken !== null,
      principal: this.user?.principal ?? null,
      me: this.user,
    };
  }

  // --- state ---------------------------------------------------------------

  get accessToken(): string | null {
    return this.access;
  }
  get isAuthenticated(): boolean {
    return this.access !== null || this.refreshToken !== null;
  }
  get principal(): Principal | null {
    return this.user?.principal ?? null;
  }
  get me(): Me | null {
    return this.user;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // --- lifecycle ---------------------------------------------------------

  async loginTeam(email: string, password: string): Promise<Me> {
    return this.completeLogin(
      await this.post<TokenPair>('/auth/team/login/', { body: { email, password } }),
    );
  }

  async loginCollector(accessKey: string): Promise<Me> {
    return this.completeLogin(
      await this.post<TokenPair>('/auth/collector/login/', {
        body: { access_key: accessKey },
      }),
    );
  }

  /** Exchange the stored refresh token for a fresh pair. Concurrent callers
   * share the one in-flight request. Throws if there is nothing to refresh
   * with or the token is rejected — the caller then treats the session as
   * over. */
  async refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    const token = this.refreshToken;
    if (!token) throw new Error('No refresh token.');

    this.refreshing = (async () => {
      try {
        const pair = await this.post<TokenPair>('/auth/token/refresh/', {
          body: { refresh: token },
        });
        this.access = pair.access;
        this.setStored(pair.refresh);
        this.emit();
      } catch (err) {
        this.clear();
        throw err;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /** Best-effort server-side blacklist, then drop all local state. */
  async logout(): Promise<void> {
    const token = this.refreshToken;
    if (token) {
      try {
        await this.post('/auth/logout/', { body: { refresh: token } });
      } catch {
        /* logging out anyway — the client state is what matters */
      }
    }
    this.clear();
  }

  /** Load `/auth/me/` into `this.user` (needs a live access token). */
  async loadMe(): Promise<Me> {
    const me = await this.get<Me>('/auth/me/');
    this.user = me;
    this.emit();
    return me;
  }

  /** Call once on app start: if a refresh token survived a reload, mint an
   * access token and hydrate `me`. Silent on failure (just stays logged out). */
  async resume(): Promise<Me | null> {
    if (!this.refreshToken) return null;
    try {
      await this.refresh();
      return await this.loadMe();
    } catch {
      return null;
    }
  }

  // --- internals -------------------------------------------------------

  /** ApiClient asks for this to build the Authorization header. */
  currentAccessToken(): string | null {
    return this.access;
  }

  protected override async decorate(_method: string, path: string, headers: Headers) {
    // Attach the bearer for /auth/me/ (the only authenticated call this class
    // makes itself). login/refresh/logout are AllowAny — a stray header is
    // ignored server-side, but skip it to keep requests clean.
    if (this.access && path.startsWith('/auth/me')) {
      headers.set('Authorization', `Bearer ${this.access}`);
    }
    return headers;
  }

  private async completeLogin(pair: TokenPair): Promise<Me> {
    this.access = pair.access;
    this.setStored(pair.refresh);
    this.emit();
    return this.loadMe();
  }

  private clear(): void {
    this.access = null;
    this.user = null;
    this.setStored(null);
    this.emit();
  }

  private emit(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((fn) => fn(this));
  }

  private readStored(): string | null {
    try {
      return this.storage?.getItem(REFRESH_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private setStored(token: string | null): void {
    this.refreshToken = token;
    try {
      if (token) this.storage?.setItem(REFRESH_KEY, token);
      else this.storage?.removeItem(REFRESH_KEY);
    } catch {
      /* private-mode / disabled storage — non-fatal, session just won't survive reload */
    }
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
