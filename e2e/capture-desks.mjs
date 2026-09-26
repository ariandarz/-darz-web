/**
 * Phase 6's fidelity pass, made repeatable.
 *
 * `docs/ADMIN_SCREENS.md` says which capture each desk is compared against;
 * `../DarzStudio/design/admin-panel/` holds the captures. What was missing was
 * the other half of the pair — a picture of THIS panel, taken the same way.
 * Until 2026-09-22 that meant driving a browser by hand, which is why the
 * audit's DoD ("every desk compared side by side with its capture") sat open
 * for 27 desks.
 *
 * This shoots them all in one run, at the reference harness's own settings:
 *
 *   desktop 1440x900, deviceScaleFactor 1, dark
 *   (`design/admin-panel/capture-admin-screens.mjs:55`, and its README on why
 *   dark is the shipped default — `forceDarkAdmin` defaults ON and removes the
 *   toggle, so charcoal is what an admin actually saw).
 *
 * It runs against the E2E stub, not a real backend, which is a deliberate
 * limitation and the only reason it can run at all: the sole local team
 * login's password is recorded nowhere. So every desk here is in its EMPTY
 * state while the reference is seeded. What that supports is the comparison
 * that actually matters for a port — the inventory: headings, subtitles,
 * sub-tabs, filters, toolbar actions, column headers, empty copy. What it
 * cannot show is a populated row, a chart with bars in it, or anything whose
 * shape depends on data. Those stay the real-backend tier's job (`README.md`).
 *
 * Usage (both servers must already be up — see README):
 *
 *   node e2e/stub-server.mjs &
 *   npx vite preview --outDir dist-e2e --host 127.0.0.1 --port 4173 &
 *   node e2e/capture-desks.mjs                 # all of them
 *   ONLY=31-accounting node e2e/capture-desks.mjs   # just one
 *
 * Output: `dist-desk-shots/<capture-id>.png`, named so it sits next to
 * `screenshots/desktop/dark/<capture-id>.jpg` in a file browser. The directory
 * is build output and is gitignored — the captures are the committed artefact,
 * these are the thing you hold up against them.
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const OUT = new URL('../dist-desk-shots/', import.meta.url).pathname;

/**
 * Every built desk, with the capture id `docs/ADMIN_SCREENS.md` pairs it with.
 * `null` means that file's "nine rows with no capture" — shot anyway, because
 * a picture of a desk with no reference is still how you check it against the
 * source it does have.
 */
const DESKS = [
  ['/admin', '01-dashboard'],
  ['/admin/chat', '17-chat'],
  ['/admin/artworks', '02-artworks-database'],
  ['/admin/import', '18-import'],
  ['/admin/artists', '03-artists'],
  ['/admin/sources?type=gallery', '04-galleries'],
  ['/admin/sources', '05-sources-partners'],
  ['/admin/exhibition-services', null],
  ['/admin/issue', null],
  ['/admin/published', '06-market-published'],
  ['/admin/design', '07-app-design'],
  ['/admin/documents?kind=proposal', '43-documents-proposals'],
  ['/admin/documents?kind=invoice', '44-documents-invoices'],
  ['/admin/documents', '45-documents-library'],
  ['/admin/auctions', '09-auctions'],
  ['/admin/auction-records', '10-auction-records'],
  ['/admin/auction-registrations', '46-auction-registrations'],
  ['/admin/collectors', '11-collectors'],
  ['/admin/requests', '13-requests'],
  ['/admin/club', '14-collector-club'],
  ['/admin/sales', '15-market-sales'],
  ['/admin/projects', '35-projects-dashboard'],
  ['/admin/projects/list', '36-projects-list'],
  ['/admin/projects/pipeline', '37-projects-pipeline'],
  ['/admin/projects/packages', '38-projects-packages'],
  ['/admin/projects/calculator', '39-projects-calculator'],
  ['/admin/projects/partners', '40-projects-partners'],
  ['/admin/projects/reports', '41-projects-reports'],
  ['/admin/data-health', '19-data-health'],
  ['/admin/access', '22-access'],
  ['/admin/team', '23-team'],
  ['/admin/accounting', '31-accounting'],
  ['/admin/settings', '25-settings'],
  ['/admin/memberships', '28-memberships'],
  ['/admin/access-requests', '29-access-requests'],
];

/** The routes with no capture id still need a file name. */
const fallbackName = (route) => route.replace(/^\/admin\/?/, '') || 'root';

const only = process.env.ONLY;

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
});
const page = await context.newPage();

const thrown = [];
page.on('pageerror', (e) => thrown.push(e.message.split('\n')[0]));

await mkdir(OUT, { recursive: true });

// One sign-in for the whole walk — a desk is a navigation, not a session
// (the same reason `desks.spec.ts` runs serial with a shared page).
await page.goto(`${BASE}/admin/login`);
await page.fill('input[name="email"]', 'e2e@example.invalid');
await page.fill('input[name="password"]', 'anything');
await page.locator('form button[type="submit"]').click();
await page.waitForURL('**/admin');

for (const [route, capture] of DESKS) {
  const name = capture ?? fallbackName(route);
  if (only && only !== name) continue;

  thrown.length = 0;
  await page.goto(`${BASE}${route}`);
  // The shell is the signal the route resolved; the timeout then covers the
  // desk's own first fetch settling into a list or an empty state.
  await page.locator('.ad-tabs').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);

  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log(
    `${name.padEnd(28)} ${route}${thrown.length ? `  THREW: ${thrown.join(' | ')}` : ''}`,
  );
}

await browser.close();
