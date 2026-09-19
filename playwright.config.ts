/**
 * Phase 13 E2E — the stub tier's runner.
 *
 * The app is BUILT FIRST (`npm run e2e:build` — the `e2e` script chains it),
 * against the stub's origin (VITE_API_BASE_URL is a build-time value — see
 * src/api/index.ts::resolveBaseUrl). The two webServers then only SERVE:
 * the stub API and `vite preview` over the finished build. The first CI run
 * had the build inside the webServer command — the port opened before the
 * chain was truly ready and the tests hit a dead server; serving-only
 * webServers with a URL health check (a real 200, not a TCP connect) and
 * piped output make the failure mode impossible and visible.
 *
 * Locally, the environment's pre-installed Chromium may not match this
 * @playwright/test's pinned revision — point PW_CHROMIUM at it
 * (e.g. /opt/pw-browsers/chromium). CI installs its own.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // CI-only retries: four runner executions produced one green and three reds
  // at three DIFFERENT assertions on the same sign-in walk — while the third
  // test, exercising the same path in a fresh context, passed each time.
  // Locally (cold, CI=true) the suite is stable. That shape is runner flake,
  // not an app race; each retry records a full trace into test-results/,
  // which the workflow uploads on failure — so any recurrence documents
  // itself instead of needing another guess.
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: 'on-first-retry',
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: process.env.PW_CHROMIUM
      ? { executablePath: process.env.PW_CHROMIUM }
      : undefined,
  },
  webServer: [
    {
      command: 'node e2e/stub-server.mjs',
      url: 'http://127.0.0.1:8787/api/app-theme/',
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // --host 127.0.0.1: on newer Node the bare preview binds localhost as
      // ::1 only, and the ipv4 health URL + Chromium then get refused (the
      // second CI failure's exact shape — both servers printed ready, the
      // 127.0.0.1 checks never went green)
      command: 'npx vite preview --outDir dist-e2e --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173/',
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
