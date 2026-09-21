/**
 * Phase 13 — every collector route renders. The other half of TD-9's breadth.
 *
 * `desks.spec.ts` walks the panel; this walks the app collectors actually use,
 * which had never been walked either — `smoke.spec.ts` opened the gate and
 * stopped there. Doing it found `/auctions/lots/:id` rendering a **white
 * screen** on `Cannot read properties of undefined (reading 'images')`.
 *
 * That one matters more than the three the panel walk found, for a reason
 * worth writing down: **there is no error boundary under these routes.** The
 * admin got `DeskBoundary`, so a desk that throws now degrades to a message
 * with the navbar intact. A collector route that throws is still a blank page.
 * Until that changes, this file is the only thing standing between a bad
 * response shape and a customer seeing nothing at all.
 *
 * Same contract as the desk walk: signed in once, each route must render a
 * real body and throw nothing, against a backend that answers empty for
 * everything. `VITE_FEATURE_SET=full` in `e2e:build` is what makes the hidden
 * v0.1 routes (auctions, records) reachable here.
 */
import { expect, test, type Page } from '@playwright/test';

const ID = '00000000-0000-4000-8000-00000000beef';

/** Route, and the least it must show. A character count rather than a heading:
 * several of these legitimately render a short empty or error state against an
 * empty backend, and asserting a heading would only assert the stub. */
const ROUTES: ReadonlyArray<readonly [route: string, minChars: number]> = [
  ['/', 60],
  ['/artists', 60],
  [`/artists/${ID}`, 60],
  [`/artwork/${ID}`, 60],
  ['/saved', 60],
  ['/records', 60],
  [`/records/${ID}`, 60],
  [`/records/artist/${ID}`, 60],
  ['/chat', 60],
  [`/chat/${ID}`, 60],
  ['/profile', 60],
  ['/settings', 60],
  ['/auctions', 60],
  ['/auctions/notifications', 60],
  [`/auctions/${ID}`, 60],
  // the white screen this file was written for
  [`/auctions/lots/${ID}`, 60],
  ['/portal/sometoken', 60],
  ['/_design', 60],
];

test.describe.configure({ mode: 'serial' });

let page: Page;
let thrown: string[] = [];

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on('pageerror', (e) => thrown.push(e.message.split('\n')[0]));

  await page.goto('/login');
  // The gate opens on its landing state; the form is behind "Enter the Room".
  await page.getByRole('button', { name: 'Enter the Room' }).first().click();
  await page.waitForSelector('input[name="firstName"]');
  await page.fill('input[name="firstName"]', 'E2E');
  await page.fill('input[name="accessKey"]', 'KEY123');
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL('**/', { timeout: 20_000 });
});

test.afterAll(async () => {
  await page?.close();
});

for (const [route, minChars] of ROUTES) {
  test(`${route.replace(ID, ':id')} renders`, async () => {
    thrown = [];
    await page.goto(route);
    await page.waitForLoadState('networkidle');

    const body = (await page.locator('body').innerText()).trim();
    expect(body.length, `${route} rendered a blank page`).toBeGreaterThan(minChars);
    expect(thrown, `page errors on ${route}`).toEqual([]);
  });
}
