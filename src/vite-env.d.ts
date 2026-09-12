/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the darzmarket-api, including `/api`. Required — set in
   * `.env` / `.env.local` (see `.env.example`); `resolveBaseUrl()` throws if
   * it is missing. */
  readonly VITE_API_BASE_URL: string;

  /** WebSocket origin for the auction live-lot socket (Phase 8), e.g.
   * `ws://localhost:8000` — no `/api`, no trailing slash. Required — set in
   * `.env` / `.env.local` (see `.env.example`); `resolveWsUrl()` throws if it
   * is missing. */
  readonly VITE_API_WS_URL: string;

  /** Which feature set the build runs — `v0.1` (default when unset) or
   * `full`. See `src/features/shell/features.ts` and `.env.example`. */
  readonly VITE_FEATURE_SET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
