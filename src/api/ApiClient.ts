/**
 * ApiClient — the authenticated request surface the resource services sit on.
 *
 * `extends HttpClient` for the transport; `composes AuthSession` for identity.
 * Adds two things over the base:
 *   1. `decorate()` — puts `Authorization: Bearer <access>` on every request.
 *   2. `onResponse()` — on a 401, refresh the access token once and retry the
 *      same request; if the refresh fails the original `UnauthorizedError`
 *      surfaces and the session is already cleared.
 *
 * The base verbs are `protected`; `send()` is the public entry the service
 * layer calls.
 */
import { HttpClient, type RequestOptions } from './HttpClient';
import type { AuthSession } from './AuthSession';

export class ApiClient extends HttpClient {
  readonly session: AuthSession;

  constructor(baseUrl: string, session: AuthSession) {
    super(baseUrl);
    this.session = session;
  }

  /** Public, authenticated request — used by `ResourceService` subclasses. */
  send<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    opts: RequestOptions = {},
  ) {
    return this.request<T>(method, path, opts);
  }

  protected override async decorate(_method: string, _path: string, headers: Headers) {
    const token = this.session.currentAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  protected override async onResponse(response: Response, attempt: number): Promise<boolean> {
    if (response.status !== 401 || attempt > 0) return false;
    if (!this.session.isAuthenticated) return false;
    try {
      await this.session.refresh();
      return true; // retry once, now with the new access token
    } catch {
      return false; // refresh failed — let the 401 propagate (session cleared)
    }
  }
}
