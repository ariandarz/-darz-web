/**
 * Phase 13 — every built admin desk renders. **TD-9's breadth half.**
 *
 * `smoke.spec.ts` proves the app boots and *a* desk renders; this proves they
 * all do. That distinction is not academic — walking these 35 routes for the
 * first time found three desks that rendered a **completely blank page**, two
 * of which had shipped to `main`:
 *
 *   - `/admin/accounting` — `.length` on an undefined `currencies`.
 *   - `/admin/projects` — `responsibility_by_member is not iterable`.
 *   - `/admin/accounting/deals/new` — a `<Route>` nested inside another
 *     route's `element`, which also left `/admin/accounting/entries/:id`
 *     unregistered, i.e. Phase 2's ledger-entry detail was unreachable.
 *
 * None of those was visible to 443 logic tests, and none needed real data to
 * find — only something that opens the page. That is the whole argument for
 * this file.
 *
 * **What it claims:** each desk reaches its own heading, renders a real body,
 * and throws nothing, against a backend that answers empty for everything.
 * **What it does not:** anything about behaviour with real rows — that is the
 * local real-backend tier's job (`e2e/README.md`).
 *
 * Serial with one shared page, so the walk signs in once rather than 35 times;
 * a desk is a navigation, not a session.
 */
import { expect, test, type Page } from '@playwright/test';

/** Every route the panel serves that needs no id, with the heading it owns.
 * A heading, not "the page is not blank": a desk that renders someone else's
 * heading is a routing bug, and the blank-page check cannot see it. */
const DESKS: ReadonlyArray<readonly [route: string, heading: string]> = [
  ['/admin', 'Dashboard'],
  ['/admin/requests', 'Requests & Activity'],
  ['/admin/chat', 'Chat'],
  ['/admin/artworks', 'Artworks Database'],
  ['/admin/artworks/new', 'New Artwork'],
  ['/admin/artists', 'Artists'],
  ['/admin/documents', 'Documents'],
  ['/admin/published', 'Market App'],
  ['/admin/auctions', 'Live Auctions'],
  ['/admin/auction-registrations', 'Register to Bid'],
  ['/admin/auction-records', 'Auction Records'],
  ['/admin/auction-records/new', 'New auction record'],
  ['/admin/sources', 'Galleries & Sources'],
  // The nav's OTHER tab on this route. It is the same desk filtered to
  // galleries and it carries its OWN heading and sub-line, which is the
  // fidelity fix of 2026-09-22 — walking only the bare path let both tabs
  // draw the partners desk's copy for as long as they did.
  ['/admin/sources?type=gallery', 'Galleries'],
  ['/admin/exhibition-services', 'Exhibition Services'],
  ['/admin/issue', 'Issue a document'],
  ['/admin/sales', 'Market Sales'],
  ['/admin/collectors', 'Collectors'],
  ['/admin/design', 'App Design'],
  ['/admin/data-health', 'Data Health'],
  ['/admin/import', 'Import artworks'],
  ['/admin/memberships', 'Memberships'],
  ['/admin/team', 'Team'],
  ['/admin/settings', 'Settings'],
  ['/admin/accounting', 'Accounting'],
  // The Accounting desk is FOUR desks on one route, switched by `?view=`
  // (`accountingView()` in `AccountingPage.tsx`). Walking the bare path only
  // ever opened `books`, which is how the Private Deals view kept a live
  // `.length`-on-undefined — §9a's own bug, one desk over — through the first
  // full walk and a release. A query-param view is a desk.
  ['/admin/accounting?view=deals', 'Accounting'],
  ['/admin/accounting?view=duplicates', 'Accounting'],
  ['/admin/accounting?view=settlement', 'Accounting'],
  ['/admin/accounting/deals/new', 'New private deal'],
  ['/admin/projects', 'Projects'],
  ['/admin/projects/list', 'Projects'],
  ['/admin/projects/new', 'New project'],
  ['/admin/projects/pipeline', 'Pipeline'],
  ['/admin/projects/packages', 'Packages'],
  ['/admin/projects/calculator', 'Calculator'],
  ['/admin/projects/partners', 'Partners'],
  ['/admin/projects/reports', 'Reports'],
  ['/admin/club', 'Collector Club'],
  ['/admin/access-requests', 'Access Requests'],
];

/**
 * The `:id` routes. They get no entity from the stub — an unmatched GET is an
 * empty envelope — so what is asserted is narrower than above: the page must
 * not THROW, whatever it was handed. That is the claim worth making, because
 * it is the one these routes kept failing: probing them the first time found
 * three more of the same crash (the artwork editor's image store and selection
 * grants, the auction invite list, a project's linked partner orgs), two of
 * which the new `DeskBoundary` caught rather than blanking. There is no
 * heading to match on because several of these pages legitimately render a
 * loading or error state instead.
 */
const DETAIL_ID = '00000000-0000-4000-8000-00000000beef';
const DETAIL_ROUTES: readonly string[] = [
  '/admin/chat/:id',
  '/admin/artworks/:id',
  '/admin/documents/:id',
  '/admin/auctions/:id',
  '/admin/auction-records/:id',
  '/admin/sources/:id',
  '/admin/issue/:id',
  '/admin/sales/:id',
  '/admin/collectors/:id',
  '/admin/import/:id',
  // reachable only since the nested-<Route> fix — it had never been registered
  '/admin/accounting/entries/:id',
  '/admin/accounting/deals/:id',
  '/admin/projects/:id',
  '/admin/projects/:id/report',
  '/admin/projects/packages/:id',
];

test.describe.configure({ mode: 'serial' });

let page: Page;
/** Page errors seen since the current desk was opened. */
let thrown: string[] = [];

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on('pageerror', (e) => thrown.push(e.message.split('\n')[0]));

  await page.goto('/admin/login');
  await page.fill('input[name="email"]', 'e2e@example.invalid');
  await page.fill('input[name="password"]', 'anything');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL('**/admin');
});

test.afterAll(async () => {
  await page?.close();
});

for (const [route, heading] of DESKS) {
  test(`${route} renders "${heading}"`, async () => {
    thrown = [];
    await page.goto(route);

    // The desk's own heading. `.first()` because a desk may repeat its name in
    // a sub-tab or a section title.
    await expect(
      page.getByRole('heading', { name: heading, exact: true }).first(),
    ).toBeVisible({
      timeout: 15_000,
    });

    // The shell survived too — a desk that throws used to take this with it.
    await expect(page.locator('.ad-tabs')).toBeVisible();

    // The boundary's copy must never appear: it means the desk threw and was
    // caught, which is better than a blank page and still a failure here.
    await expect(page.getByText('This desk could not be drawn')).toHaveCount(0);

    expect(thrown, `page errors on ${route}`).toEqual([]);
  });
}

for (const route of DETAIL_ROUTES) {
  test(`${route} survives an entity it cannot read`, async () => {
    thrown = [];
    await page.goto(route.replace(':id', DETAIL_ID));

    await expect(page.locator('.ad-tabs')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('This desk could not be drawn')).toHaveCount(0);
    expect(thrown, `page errors on ${route}`).toEqual([]);
  });
}

/**
 * G-LOCK-1 — the ledger entry and auction-record PATCHes REQUIRE the lock
 * (`expected_version`; a PATCH without it fails, a stale one is a 409). Both
 * desks were last-write-wins until 2026-09-25. Each walk serves one row, answers
 * its save with the 409 another editor's save would cause, and asserts the lock
 * went out on the wire and the conflict banner — not a generic error — came up.
 */
const LOCK_ID = '00000000-0000-4000-8000-00000000f00d';
const conflict409 = {
  status: 409,
  contentType: 'application/json',
  body: JSON.stringify({
    success: false,
    error: { code: 'CONFLICT', message: 'This record was modified by someone else.' },
    timestamp: new Date().toISOString(),
  }),
};
const ok = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({
    success: true,
    data,
    message: '',
    timestamp: new Date().toISOString(),
  }),
});

test('a stale auction-record save sends its version and shows the conflict banner', async () => {
  thrown = [];
  const sent: unknown[] = [];
  const url = `**/api/auctions/admin/records/${LOCK_ID}/`;
  await page.route(url, (route) => {
    if (route.request().method() === 'PATCH') {
      sent.push(route.request().postDataJSON());
      return route.fulfill(conflict409);
    }
    return route.fulfill(
      ok({ id: LOCK_ID, house: 'Christie’s', lot_title: 'Heech', artist: null, version: 3 }),
    );
  });
  try {
    await page.goto(`/admin/auction-records/${LOCK_ID}`);
    await page.getByRole('button', { name: 'Save record' }).click();
    await expect(
      page.getByText('Someone else saved this record in the meantime'),
    ).toBeVisible();
    expect((sent[0] as { expected_version?: number }).expected_version).toBe(3);
  } finally {
    await page.unroute(url);
  }
  expect(thrown).toEqual([]);
});

test('a stale ledger-entry save sends its version and shows the conflict banner', async () => {
  thrown = [];
  const sent: unknown[] = [];
  const entry = {
    id: LOCK_ID,
    book: 'darz',
    entry_type: 'expense',
    category: 'Rent',
    amount: '1200.00',
    currency: 'USD',
    entry_date: '2026-09-20',
    status: 'pending',
    note: '',
    has_receipt: false,
    is_counted: true,
    attachments: [],
    arian_review: null,
    version: 5,
  };
  const matches = (u: URL) => u.pathname.startsWith('/api/accounting/admin/ledger/');
  await page.route(matches, (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      sent.push(req.postDataJSON());
      return route.fulfill(conflict409);
    }
    if (new URL(req.url()).pathname.endsWith(`${LOCK_ID}/`)) return route.fulfill(ok(entry));
    if (new URL(req.url()).pathname !== '/api/accounting/admin/ledger/')
      return route.fallback();
    return route.fulfill(
      ok({
        pagination: {
          page: 1,
          per_page: 25,
          total_pages: 1,
          total_count: 1,
          has_next: false,
          has_previous: false,
        },
        results: [entry],
      }),
    );
  });
  try {
    await page.goto('/admin/accounting?view=books&book=darz');
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await page.getByRole('button', { name: 'Save entry' }).click();
    await expect(
      page.getByText('Someone else saved this entry in the meantime'),
    ).toBeVisible();
    expect((sent[0] as { expected_version?: number }).expected_version).toBe(5);
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});
