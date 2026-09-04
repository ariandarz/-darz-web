/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the darzmarket-api, including `/api`. Required — set in
   * `.env` / `.env.local` (see `.env.example`); `resolveBaseUrl()` throws if
   * it is missing. */
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
