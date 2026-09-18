/**
 * The API layer's public surface.
 *
 * `DarzApi` wires one `AuthSession` + one `ApiClient` + the resource services
 * into a single object. Feature code takes a `DarzApi` (via `useApi()`), never
 * constructs a service or touches `fetch`.
 */
import { ApiClient } from './ApiClient';
import { AuthSession } from './AuthSession';
import {
  AdminAccountsService,
  AuctionService,
  CatalogAdminService,
  SalesAdminService,
  DocumentsAdminService,
  AuthService,
  CatalogService,
  CrmService,
  DashboardService,
  OptionsService,
  ThemeService,
  RecommendationService,
} from './services';

/** The API base URL comes from the environment only — no hardcoded fallback.
 * Set `VITE_API_BASE_URL` in `.env` (or `.env.local`); see `.env.example`. */
export function resolveBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (typeof fromEnv !== 'string' || fromEnv.trim() === '') {
    throw new Error(
      'VITE_API_BASE_URL is not set. Copy .env.example to .env.local (or use the committed .env).',
    );
  }
  return fromEnv.trim();
}

/** WebSocket origin for the auction live-lot socket (Phase 8), e.g.
 * `ws://localhost:8000` — NO `/api` suffix, NO trailing slash. From the
 * environment only, same rule as `resolveBaseUrl()`: no hardcoded fallback,
 * no deriving it from the HTTP base in code. Set `VITE_API_WS_URL` in `.env`
 * (or `.env.local`); see `.env.example`. */
export function resolveWsUrl(): string {
  const fromEnv = import.meta.env.VITE_API_WS_URL;
  if (typeof fromEnv !== 'string' || fromEnv.trim() === '') {
    throw new Error(
      'VITE_API_WS_URL is not set. Copy .env.example to .env.local (or use the committed .env).',
    );
  }
  return fromEnv.trim().replace(/\/+$/, '');
}

export class DarzApi {
  readonly session: AuthSession;
  readonly client: ApiClient;
  readonly auth: AuthService;
  readonly catalog: CatalogService;
  readonly crm: CrmService;
  readonly auctions: AuctionService;
  readonly recommendations: RecommendationService;
  readonly adminAccounts: AdminAccountsService;
  readonly dashboard: DashboardService;
  readonly options: OptionsService;
  readonly theme: ThemeService;
  readonly catalogAdmin: CatalogAdminService;
  readonly salesAdmin: SalesAdminService;
  readonly documentsAdmin: DocumentsAdminService;

  constructor(baseUrl: string = resolveBaseUrl(), storage?: Storage | null) {
    this.session = new AuthSession(baseUrl, storage);
    this.client = new ApiClient(baseUrl, this.session);
    this.auth = new AuthService(this.client, this.session);
    this.catalog = new CatalogService(this.client);
    this.crm = new CrmService(this.client);
    this.auctions = new AuctionService(this.client);
    this.recommendations = new RecommendationService(this.client);
    this.adminAccounts = new AdminAccountsService(this.client);
    this.dashboard = new DashboardService(this.client);
    this.options = new OptionsService(this.client);
    this.theme = new ThemeService(this.client);
    this.catalogAdmin = new CatalogAdminService(this.client);
    this.salesAdmin = new SalesAdminService(this.client);
    this.documentsAdmin = new DocumentsAdminService(this.client);
  }
}

/** Process-wide instance for app code; tests build their own with a fake
 * base URL + in-memory storage. */
export const api = new DarzApi();

export { ApiClient } from './ApiClient';
export { AuthSession } from './AuthSession';
export type { Me, Principal } from './AuthSession';
export {
  ResourceService,
  AuctionService,
  AuthService,
  CatalogService,
  CrmService,
  RecommendationService,
  OptionsService,
} from './services';
export type { OptionsMap } from './services';
export {
  ApiError,
  NetworkError,
  HttpError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
} from './errors';
export type * from './types';
