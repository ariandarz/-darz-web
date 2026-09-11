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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The package version, inlined by `vite.config.ts` (`define`) for the build
 * stamp at the foot of Settings. */
declare const __APP_VERSION__: string;
