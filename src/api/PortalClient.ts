/**
 * PortalClient — the UNAUTHENTICATED request surface for the gallery portal.
 *
 * A sibling of `ApiClient` on the same `HttpClient` base: same envelope
 * unwrapping, same errors, but **no** `Authorization` decoration and no
 * refresh-retry. The portal's whole auth is the token in the path plus the
 * PIN on every request (`apps/gallery/services.py::PortalAuthService`), and a
 * stray collector/team Bearer token from the same browser must never ride
 * along — the backend ignores it, but the surface is defined as no-login and
 * the client says so.
 */
import { HttpClient, type RequestOptions } from './HttpClient';

export class PortalClient extends HttpClient {
  /** Public entry for `GalleryPortalService` — the base verbs are protected. */
  send<T>(method: 'GET' | 'POST' | 'PATCH', path: string, opts: RequestOptions = {}) {
    return this.request<T>(method, path, opts);
  }
}
