/**
 * Phase 13 E2E — the stub tier's runner. Two webServers: the stub API
 * (e2e/stub-server.mjs) and a production build served by `vite preview`,
 * built against the stub's origin (VITE_API_BASE_URL is a build-time value —
 * see src/api/index.ts::resolveBaseUrl).
 *
 * Locally, the environment's pre-installed Chromium may not match this
 * @playwright/test's pinned revision — point PW_CHROMIUM at it
 * (e.g. /opt/pw-browsers/chromium). CI installs its own.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: process.env.PW_CHROMIUM
      ? { executablePath: process.env.PW_CHROMIUM }
      : undefined,
  },
  webServer: [
    {
      command: 'node e2e/stub-server.mjs',
      port: 8787,
      reuseExistingServer: false,
    },
    {
      command:
        'VITE_API_BASE_URL=http://127.0.0.1:8787/api VITE_FEATURE_SET=full npx vite build --outDir dist-e2e --logLevel error && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
      port: 4173,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
