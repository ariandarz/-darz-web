/**
 * Resource services — one class per backend resource group, all extending
 * `ResourceService`. The base owns the `ApiClient` handle + `basePath` and the
 * verb helpers; subclasses are a thin, typed list of the endpoints they wrap.
 *
 * This is the layer feature code (Phase 4+) talks to — never `fetch`, never a
 * raw path. Mirrors the backend's app split (`catalog`, `crm`,
 * `recommendations`, `core`), the way `CLAUDE.md` asks component boundaries to
 * mirror the old app's real modules.
 */
import type { ApiClient } from './ApiClient';
import type { AuthSession, Me } from './AuthSession';
import type { RequestOptions } from './HttpClient';
import type {
  AdminRequest,
  AdminRequestQuery,
  Artist,
  ArtistQuery,
  Artwork,
  CatalogueQuery,
  CollectorActivity,
  CollectorRequest,
  CollectorRequestQuery,
  Paginated,
  PublishedRecommendation,
  RequestDetail,
  RequestKind,
  SavedArtwork,
} from './types';

export abstract class ResourceService {
  protected readonly client: ApiClient;
  protected readonly basePath: string;

  constructor(client: ApiClient, basePath: string) {
    this.client = client;
    this.basePath = basePath;
  }

  protected list<T>(path: string, query?: RequestOptions['query']) {
    return this.client.send<Paginated<T>>('GET', this.basePath + path, { query });
  }
  protected retrieve<T>(path: string, query?: RequestOptions['query']) {
    return this.client.send<T>('GET', this.basePath + path, { query });
  }
  protected create<T>(path: string, body?: unknown) {
    return this.client.send<T>('POST', this.basePath + path, { body });
  }
  protected remove(path: string) {
    return this.client.send<void>('DELETE', this.basePath + path);
  }
}

/** `/api/catalog/` — the collector catalogue (read-only for V1). */
export class CatalogService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/catalog');
  }

  artworks(query: CatalogueQuery = {}) {
    return this.list<Artwork>('/artworks/', query as RequestOptions['query']);
  }
  artwork(id: string) {
    return this.retrieve<Artwork>(`/artworks/${id}/`);
  }
  artists(query: ArtistQuery = {}) {
    return this.list<Artist>('/artists/', query as RequestOptions['query']);
  }
  artist(id: string) {
    return this.retrieve<Artist>(`/artists/${id}/`);
  }
}

/** `/api/crm/` — the collector's own requests, activity log, and saved works. */
export class CrmService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/crm');
  }

  /** The collector's own requests. `kind`/`status` are server-side filters. */
  requests(query: CollectorRequestQuery = {}) {
    return this.list<CollectorRequest>('/requests/', query as RequestOptions['query']);
  }
  createRequest(body: { kind: RequestKind; artwork?: string; detail?: RequestDetail }) {
    return this.create<CollectorRequest>('/requests/', body);
  }

  /** Admin: the unified feed of every request across every kind
   * (`GET /api/crm/admin/requests/`, filterable by kind/status/assignee). */
  adminRequests(query: AdminRequestQuery = {}) {
    return this.list<AdminRequest>('/admin/requests/', query as RequestOptions['query']);
  }
  /** Admin: move one request to another status (`POST .../transition/`). */
  transitionRequest(id: string, toStatus: string, note = '') {
    return this.create<AdminRequest>(`/admin/requests/${id}/transition/`, {
      to_status: toStatus,
      note,
    });
  }
  logActivity(body: { kind: string; artwork?: string; metadata?: Record<string, unknown> }) {
    return this.create<CollectorActivity>('/activity/', body);
  }
  saved(query: { per_page?: number; page?: number } = {}) {
    return this.list<SavedArtwork>('/saved/', query);
  }
  save(artworkId: string) {
    return this.create<SavedArtwork>('/saved/', { artwork: artworkId });
  }
  unsave(artworkId: string) {
    return this.remove(`/saved/${artworkId}/`);
  }
}

/** `/api/recommendations/` — the admin-curated "Selected for you" batches. */
export class RecommendationService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/recommendations');
  }

  published(query: { per_page?: number; page?: number } = {}) {
    return this.list<PublishedRecommendation>('/published/', query);
  }
  dismiss(id: string) {
    return this.create<PublishedRecommendation>(`/published/${id}/dismiss/`);
  }
}

export type OptionsMap = Record<string, Array<{ value: string; label: string }>>;

/** `GET /api/options/` — every choice field as `{value, label}`. Cached for
 * the tab's lifetime (it's static metadata; never hardcode a label lookup). */
export class OptionsService extends ResourceService {
  private cache: Promise<OptionsMap> | null = null;

  constructor(client: ApiClient) {
    super(client, '');
  }

  all(): Promise<OptionsMap> {
    this.cache ??= this.retrieve<OptionsMap>('/options/');
    return this.cache;
  }
  reload(): Promise<OptionsMap> {
    this.cache = this.retrieve<OptionsMap>('/options/');
    return this.cache;
  }
}

/** Auth — delegates the token lifecycle to `AuthSession`, adds the one
 * authenticated auth endpoint that isn't part of it (`membership/redeem/`). */
export class AuthService extends ResourceService {
  private readonly session: AuthSession;

  constructor(client: ApiClient, session: AuthSession) {
    super(client, '/auth');
    this.session = session;
  }

  loginTeam(email: string, password: string): Promise<Me> {
    return this.session.loginTeam(email, password);
  }
  loginCollector(accessKey: string): Promise<Me> {
    return this.session.loginCollector(accessKey);
  }
  logout(): Promise<void> {
    return this.session.logout();
  }
  me(): Promise<Me> {
    return this.session.loadMe();
  }
  redeemMembership(code: string) {
    return this.create<{ plan: string; tier: string; redeemed_at: string }>(
      '/membership/redeem/',
      { code },
    );
  }
}
