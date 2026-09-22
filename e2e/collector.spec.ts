/**
 * Phase 13 — every collector route renders. The other half of TD-9's breadth.
 *
 * `desks.spec.ts` walks the panel; this walks the app collectors actually use,
 * which had never been walked either — `smoke.spec.ts` opened the gate and
 * stopped there. Doing it found `/auctions/lots/:id` rendering a **white
 * screen** on `Cannot read properties of undefined (reading 'images')`.
 *
 * That one mattered more than the three the panel walk found, for a reason
 * worth writing down: **there was no error boundary under these routes.** The
 * admin had `DeskBoundary`, so a desk that threw degraded to a message with
 * the navbar intact; a collector route that threw was still a blank page, and
 * this file was the only thing standing between a bad response shape and a
 * customer seeing nothing at all.
 *
 * **`ScreenBoundary` closed that on 2026-09-22** (owner's instruction), and
 * the last test below is what keeps it closed: a route that throws on render,
 * which exists only in this build (`VITE_E2E_BOOM`), asserting that the
 * header, the chroma line and the nav survive it. This file is still the
 * breadth check — a screen caught by the boundary is a screen that did not
 * render, and every test above it still demands a real body.
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

    // Nothing above should ever be CAUGHT rather than rendered — that reads as
    // a pass on the character count and is a screen that failed.
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
  });
}

/**
 * The boundary itself. Before it, this was a white page: no wordmark, no
 * chroma line, no nav, and no way back except retyping a URL.
 *
 * The copy is not invented for this app — `app.html:9821` is the old app's own
 * catch around a thrown render, and "Something went wrong" is its heading
 * verbatim. See `ScreenBoundary.tsx` for what was adapted and why.
 */
test('a screen that throws keeps the shell, and says so in the old app’s words', async () => {
  thrown = [];
  await page.goto('/_boom');
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('Something went wrong')).toBeVisible();
  // the three things a white page loses
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('.chroma')).toHaveCount(1);
  await expect(page.locator('nav#nav')).toBeVisible();
});

test('leaving a broken screen clears it — the boundary is keyed on the path', async () => {
  await page.goto('/_boom');
  await expect(page.getByText('Something went wrong')).toBeVisible();

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
});
