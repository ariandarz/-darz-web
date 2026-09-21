/**
 * Phase 13 — the stub-tier smoke (CI-runnable, no backend).
 *
 * What this tier is for: the app BOOTS (providers, theme fetch, session
 * resume), the collector gate renders its shipped anatomy, the team sign-in
 * reaches the panel, the panel's shell and a desk render. It catches broken
 * routing, a provider that throws on boot, and a desk that cannot survive an
 * empty backend — nothing more. Behaviour against real data is the local
 * real-backend tier (`e2e/README.md`), which is exactly the per-step
 * verification scripts this suite grew from.
 */
import { expect, test } from '@playwright/test';

// On a CI failure the job logs must carry the diagnosis themselves (this
// environment cannot fetch CI artifacts): collect every console message and
// page error from the start of each test, and print them — with the final
// URL and a body-text snippet — when the test did not pass.
const captured: string[] = [];
test.beforeEach(({ page }) => {
  captured.length = 0;
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      captured.push(`[console.${m.type()}] ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => captured.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) =>
    captured.push(`[requestfailed] ${r.method()} ${r.url()} — ${r.failure()?.errorText}`),
  );
});
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  console.log(`--- diagnosis: ${testInfo.title} ---`);
  console.log('final URL:', page.url());
  for (const line of captured) console.log(line);
  const body = await page
    .locator('body')
    .innerText()
    .catch(() => '(body unreadable)');
  console.log('body text:', JSON.stringify(body.slice(0, 600)));
  console.log('--- end diagnosis ---');
});

test('the collector gate boots and shows its shipped anatomy', async ({ page }) => {
  await page.goto('/login');
  // the gate's own copy (LoginPage — ported from the design package)
  await expect(page.getByRole('button', { name: 'Enter the Room' }).first()).toBeVisible();
});

test('a team session signs in and lands on the Dashboard', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('input[name="email"]', 'e2e@example.invalid');
  await page.fill('input[name="password"]', 'anything');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL('**/admin');
  // the desk renders the canned summary
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  // the shell's two-tier nav is up (group tabs present). The generous
  // timeout is deliberate: one CI run found the Dashboard heading before
  // the nav — the runner is slow enough to catch the shell mid-paint.
  await expect(page.locator('.ad-tabs')).toBeVisible({ timeout: 15000 });
});

test('a desk renders its empty state against an empty backend', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('input[name="email"]', 'e2e@example.invalid');
  await page.fill('input[name="password"]', 'anything');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL('**/admin');
  await page.goto('/admin/artworks');
  await expect(page.getByRole('heading', { name: 'Artworks Database' })).toBeVisible();
  await expect(page.getByText('No artworks match these filters.')).toBeVisible();
  // and the owner-only desk gate does not crash a typed URL
  await page.goto('/admin/team');
  await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
});
