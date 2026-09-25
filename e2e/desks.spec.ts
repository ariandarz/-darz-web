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
  // The Sales group's second tab — the same desk scoped to `source=auction`,
  // with its own heading (V1 Phase 2; the Galleries shape above).
  ['/admin/sales?source=auction', 'Auction Sales'],
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

/** A paginated envelope page, the backend's shape. */
const pageOf = (results: unknown[], n: number, hasNext: boolean, total: number) =>
  ok({
    pagination: {
      page: n,
      per_page: 100,
      total_pages: hasNext ? n + 1 : n,
      total_count: total,
      has_next: hasNext,
      has_previous: n > 1,
    },
    results,
  });

test('the Artists desk pages past the 100-row clamp with nothing dropped (C-5)', async () => {
  thrown = [];
  const artist = (i: number) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    display_name: `Stub Artist ${i}`,
    bio: '',
    works_count: 1,
    version: 1,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  });
  const matches = (u: URL) => u.pathname === '/api/catalog/admin/artists/';
  await page.route(matches, (route) => {
    const n = Number(new URL(route.request().url()).searchParams.get('page') || '1');
    const rows = Array.from({ length: n === 1 ? 100 : 50 }, (_, k) =>
      artist((n - 1) * 100 + k + 1),
    );
    return route.fulfill(pageOf(rows, n, n === 1, 150));
  });
  try {
    await page.goto('/admin/artists');
    // the total is the server's count, not the rows on screen
    await expect(page.getByText('Showing 150 of 150 artists')).toBeVisible();
    await expect(page.getByText('Stub Artist 100', { exact: true })).toBeVisible();
    // and the pager reaches the rest — nothing past 100 is silently cut
    await page.locator('.pager').getByRole('button', { name: '2', exact: true }).click();
    await expect(page.getByText('Stub Artist 150', { exact: true })).toBeVisible();
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});

test('the Sales desk reads the nested row refs (G-SALE-3, C-1)', async () => {
  thrown = [];
  const sale = {
    id: LOCK_ID,
    artwork: { id: '00000000-0000-4000-8000-0000000000a1', title: 'Nested Title' },
    collector: {
      id: '00000000-0000-4000-8000-0000000000c1',
      display_name: 'Nested Collector',
    },
    responsible: { id: '00000000-0000-4000-8000-0000000000e1', name: 'Nested Owner' },
    source_request: null,
    seller_source: '',
    source: 'market',
    lot: null,
    agreed_price: '1000.00',
    currency: 'USD',
    commission_amount: '100.00',
    discount_amount: null,
    fees_tax: null,
    payment_status: 'unpaid',
    delivery_status: 'pending',
    status: 'draft',
    confirmed_at: null,
    follow_up_at: null,
    follow_up_overdue: false,
    version: 1,
    created_at: '2026-09-25T00:00:00Z',
    updated_at: '2026-09-25T00:00:00Z',
  };
  const badRefs: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('[object')) badRefs.push(r.url());
  });
  const matches = (u: URL) => u.pathname.startsWith('/api/sales/admin/sales/');
  await page.route(matches, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/sales/admin/sales/') return route.fulfill(pageOf([sale], 1, false, 1));
    if (path.endsWith(`${LOCK_ID}/`)) return route.fulfill(ok(sale));
    return route.fallback();
  });
  try {
    await page.goto('/admin/sales');
    await expect(page.getByText('Nested Title')).toBeVisible();
    await expect(page.getByText('Nested Collector')).toBeVisible();
    await page.goto(`/admin/sales/${LOCK_ID}`);
    await expect(page.getByText('Nested Owner')).toBeVisible();
    expect(badRefs).toEqual([]);
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});

/**
 * V1 Phase 2 — the Sales desk against the stub's two-sale ledger (one market
 * deal with an overdue follow-up and a note, one auction sale with a lot).
 */
const SALE_MARKET = '00000000-0000-4000-8000-0000000005a1';
const SALE_AUCTION_EVENT = '00000000-0000-4000-8000-00000000ac71';

/** A desk filter's control, found by its visible label. */
const deskFilter = (name: string) =>
  page
    .locator('label.ad-filter')
    .filter({ has: page.locator('.ad-filter-l', { hasText: new RegExp(`^${name}$`) }) });

test('Market Sales: tiles read the summary, and each filter reaches the list query', async () => {
  thrown = [];
  // The list reads only — the strip's own walk (per_page=100) is left out.
  const seen: URLSearchParams[] = [];
  const matches = (u: URL) => u.pathname === '/api/sales/admin/sales/';
  await page.route(matches, (route) => {
    const sp = new URL(route.request().url()).searchParams;
    if (sp.get('per_page') !== '100') seen.push(sp);
    return route.fallback();
  });
  const last = () => seen[seen.length - 1];
  try {
    await page.goto('/admin/sales');
    await expect(page.getByText('Heech')).toBeVisible();
    await expect(page.getByText('Poet and Bird')).toBeVisible();
    // summary: 1 confirmed + 1 draft open; the market deal's follow-up is overdue
    const tile = (l: string) =>
      page.locator('.ad-tile').filter({ hasText: l }).locator('.ad-tile-v');
    await expect(tile('Open deals')).toHaveText('2');
    await expect(tile('Need attention')).toHaveText('1');
    await expect(tile('Payment pending')).toHaveText('1');
    await expect(page.getByText('Follow-up 2026-09-20 · due')).toBeVisible();

    await deskFilter('Stage').locator('select').selectOption('confirmed');
    await expect.poll(() => last()?.get('status')).toBe('confirmed');
    await deskFilter('Payment').locator('select').selectOption('partial');
    await expect.poll(() => last()?.get('payment_status')).toBe('partial');
    await deskFilter('Delivery').locator('select').selectOption('in_transit');
    await expect.poll(() => last()?.get('delivery_status')).toBe('in_transit');
    // Source values come from the summary's `by_source`; labels fall back to raw (C-14)
    await deskFilter('Source').locator('select').selectOption('auction');
    await expect.poll(() => last()?.get('source')).toBe('auction');
    await deskFilter('Sort').locator('select').selectOption('-price');
    await expect.poll(() => last()?.get('ordering')).toBe('-price');
    await deskFilter('Search').locator('input').fill('Heech');
    await expect.poll(() => last()?.get('search')).toBe('Heech');
    // every earlier filter is still on the request
    expect(last()?.get('status')).toBe('confirmed');
    await expect(page.getByText('No market deals match these filters.')).toBeVisible();
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});

test('a deal’s follow-up and notes round-trip without a reload (G-SALE-5)', async () => {
  thrown = [];
  const posts: Array<{ path: string; body: unknown }> = [];
  const matches = (u: URL) => u.pathname.startsWith(`/api/sales/admin/sales/${SALE_MARKET}/`);
  await page.route(matches, (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      posts.push({ path: new URL(req.url()).pathname, body: req.postDataJSON() });
    }
    return route.fallback();
  });
  try {
    await page.goto(`/admin/sales/${SALE_MARKET}`);
    await expect(
      page.getByRole('heading', { name: 'Follow-up with the collector' }),
    ).toBeVisible();
    // the stub's date is in the past on an open deal: the server's overdue flag
    await expect(page.getByText('— due')).toBeVisible();
    await expect(page.getByText('Asked for the invoice by Friday.')).toBeVisible();
    // the Source row, its label the raw value while options has none (C-14)
    await expect(
      page
        .locator('.ad-recrow')
        .filter({ has: page.locator('.ad-reck', { hasText: /^Source$/ }) }),
    ).toContainText('market');

    const inAWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    await page.getByRole('button', { name: '1 week' }).click();
    await expect(page.getByText(`Follow-up set for ${inAWeek}`)).toBeVisible();
    await expect(page.getByText('— due')).toHaveCount(0);
    expect(posts.at(-1)).toEqual({
      path: `/api/sales/admin/sales/${SALE_MARKET}/follow-up/`,
      body: { follow_up_at: inAWeek },
    });

    await page.getByLabel('Add a note').fill('Called — wants a viewing.');
    await page.getByRole('button', { name: 'Add note' }).click();
    await expect(page.getByText('Called — wants a viewing.')).toBeVisible();
    await expect(page.getByText('Note added')).toBeVisible();
    expect(posts.at(-1)).toEqual({
      path: `/api/sales/admin/sales/${SALE_MARKET}/notes/`,
      body: { body: 'Called — wants a viewing.' },
    });
    // newest first, above the stub's older note
    await expect(page.locator('.ad-salenote').first()).toContainText(
      'Called — wants a viewing.',
    );

    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByText('No follow-up set.')).toBeVisible();
    expect(posts.at(-1)?.body).toEqual({ follow_up_at: null });
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});

test('Auction Sales lists source=auction sales and links each to its lot', async () => {
  thrown = [];
  const sources: Array<string | null> = [];
  const matches = (u: URL) => u.pathname === '/api/sales/admin/sales/';
  await page.route(matches, (route) => {
    sources.push(new URL(route.request().url()).searchParams.get('source'));
    return route.fallback();
  });
  try {
    // reached from the Market tab's sub-row, as a person would
    await page.goto('/admin/sales');
    await expect(page.getByText('Heech')).toBeVisible();
    sources.length = 0;
    await page.locator('.ad-subtab', { hasText: 'Auction Sales' }).click();
    await expect(
      page.getByRole('heading', { name: 'Auction Sales', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Poet and Bird')).toBeVisible();
    await expect(page.getByText('Heech')).toHaveCount(0);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((s) => s === 'auction')).toBe(true);
    await expect(page.getByText('1 total.', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Lot 4' }).click();
    await page.waitForURL(`**/admin/auctions/${SALE_AUCTION_EVENT}`);
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});

/**
 * V1 Phase 3 — the auctions desks against the stub's three auctions (a
 * scheduled one with two lots and a poster, a live one, an archived one), two
 * registrations and three records.
 */
const AUC_SCHEDULED = '00000000-0000-4000-8000-00000000ac01';
const AUC_LIVE = '00000000-0000-4000-8000-00000000ac02';
const auctionPath = (id: string) => `/api/auctions/admin/auctions/${id}/`;

test('an auction edit sends only the change and its version (G-AUC-1)', async () => {
  thrown = [];
  const sent: unknown[] = [];
  const matches = (u: URL) => u.pathname === auctionPath(AUC_SCHEDULED);
  await page.route(matches, (route) => {
    if (route.request().method() === 'PATCH') sent.push(route.request().postDataJSON());
    return route.fallback();
  });
  try {
    await page.goto(`/admin/auctions/${AUC_SCHEDULED}`);
    await expect(page.getByRole('heading', { name: 'Auction details' })).toBeVisible();
    // the terms open on the Darz default (the auction's own terms are blank)
    await expect(page.getByLabel('Auction terms & conditions')).toHaveValue(
      /^Conditions of Sale/,
    );

    // C-18: a reversed window never reaches the server
    await page.getByLabel('End', { exact: true }).fill('2026-01-01T10:00');
    await page.getByRole('button', { name: 'Save auction' }).click();
    await expect(page.getByText('The end must be after the start.')).toBeVisible();
    expect(sent).toHaveLength(0);

    await page.reload();
    await page.getByLabel('Title', { exact: true }).fill('Spring Evening Sale');
    await page.getByRole('button', { name: 'Save auction' }).click();
    await expect(page.getByRole('button', { name: '✓ Saved' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Spring Evening Sale', exact: true }),
    ).toBeVisible();
    expect(sent).toEqual([{ expected_version: 4, title: 'Spring Evening Sale' }]);
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});

test('a stale auction save gets the stub’s 409 and the conflict banner', async () => {
  thrown = [];
  const matches = (u: URL) => u.pathname === auctionPath(AUC_SCHEDULED);
  // The page reads version 3; the stub's row is at 4 — another editor's save.
  const row = (
    (await (
      await page.request.get(`http://127.0.0.1:8787${auctionPath(AUC_SCHEDULED)}`)
    ).json()) as { data: { version: number } }
  ).data;
  await page.route(matches, (route) =>
    route.request().method() === 'GET'
      ? route.fulfill(ok({ ...row, version: 3 }))
      : route.fallback(),
  );
  try {
    await page.goto(`/admin/auctions/${AUC_SCHEDULED}`);
    // by role: a <label> wrapping a <textarea> takes the textarea's text into
    // its own, so getByLabel's exact match cannot see this one
    await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Changed.');
    await page.getByRole('button', { name: 'Save auction' }).click();
    await expect(
      page.getByText('Someone else saved this auction in the meantime'),
    ).toBeVisible();
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});

test('a live auction’s form is read-only with the server’s reason', async () => {
  thrown = [];
  await page.goto(`/admin/auctions/${AUC_LIVE}`);
  await expect(
    page.getByText('Only a draft or scheduled auction can be edited.'),
  ).toBeVisible();
  await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save auction' })).toHaveCount(0);
  expect(thrown).toEqual([]);
});

test('a scheduled lot edits with its lock; low above high is refused (G-AUC-2)', async () => {
  thrown = [];
  const sent: unknown[] = [];
  const matches = (u: URL) => u.pathname.startsWith('/api/auctions/admin/lots/');
  await page.route(matches, (route) => {
    if (route.request().method() === 'PATCH') sent.push(route.request().postDataJSON());
    return route.fallback();
  });
  try {
    await page.goto(`/admin/auctions/${AUC_SCHEDULED}`);
    await expect(page.getByText('Parviz Tanavoli — Heech')).toBeVisible();
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await expect(page.getByText('Edit lot 1 · USD')).toBeVisible();

    await page.getByLabel('Low estimate').fill('13000');
    await page.getByRole('button', { name: 'Save lot' }).click();
    await expect(
      page.getByText('The low estimate cannot be above the high estimate.'),
    ).toBeVisible();
    expect(sent).toHaveLength(0);

    await page.getByLabel('Low estimate').fill('10,000');
    await page.getByRole('button', { name: 'Save lot' }).click();
    await expect(page.getByText('Edit lot 1 · USD')).toHaveCount(0);
    expect(sent).toEqual([{ expected_version: 2, low_estimate: '10000' }]);
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});

test('the poster uploads as multipart and removes (cover-image)', async () => {
  thrown = [];
  const calls: string[] = [];
  const matches = (u: URL) => u.pathname.endsWith('/cover-image/');
  await page.route(matches, (route) => {
    const req = route.request();
    calls.push(`${req.method()} ${req.headers()['content-type']?.split(';')[0] ?? ''}`);
    return route.fallback();
  });
  try {
    await page.goto(`/admin/auctions/${AUC_SCHEDULED}`);
    await expect(page.getByText('Uploaded poster — used as the cover')).toBeVisible();
    await page.getByRole('button', { name: 'Remove uploaded poster' }).click();
    await expect(page.getByText('Uploaded poster — used as the cover')).toHaveCount(0);
    await page.getByLabel('Poster file').setInputFiles({
      name: 'poster.png',
      mimeType: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    await expect(page.getByText('Uploaded poster — used as the cover')).toBeVisible();
    expect(calls).toEqual(['DELETE ', 'POST multipart/form-data']);
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});

test('Live Auctions hides archived; the toggle lists them; Archive posts the flag', async () => {
  thrown = [];
  const lists: Array<string | null> = [];
  const archives: unknown[] = [];
  const matches = (u: URL) => u.pathname.startsWith('/api/auctions/admin/auctions/');
  await page.route(matches, (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.pathname === '/api/auctions/admin/auctions/')
      lists.push(u.searchParams.get('archived'));
    if (u.pathname.endsWith('/archive/')) archives.push(req.postDataJSON());
    return route.fallback();
  });
  try {
    await page.goto('/admin/auctions');
    await expect(page.getByText('Spring Evening Auction')).toBeVisible();
    await expect(page.getByText('Summer Online Auction')).toBeVisible();
    await expect(page.getByText('Winter Archive Sale')).toHaveCount(0);
    // the poster as a row thumbnail
    await expect(page.locator('img.ad-auccover')).toHaveCount(1);

    await page.getByLabel('Show archived').check();
    await expect(page.getByText('Winter Archive Sale')).toBeVisible();
    await expect(page.getByText('Spring Evening Auction')).toHaveCount(0);
    expect(lists).toEqual([null, 'true']);

    await page.getByRole('button', { name: '↩ Restore' }).click();
    await expect(page.getByText('Restored to Live & upcoming')).toBeVisible();

    await page.getByLabel('Show archived').uncheck();
    await expect(page.getByText('Spring Evening Auction')).toBeVisible();
    await page.getByRole('button', { name: 'Archive', exact: true }).first().click();
    await page.getByRole('button', { name: 'Archive', exact: true }).last().click();
    await expect(page.getByText('Archived — moved to the archived list')).toBeVisible();
    expect(archives).toEqual([{ archived: false }, { archived: true }]);
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});

test('Register to Bid: ↺ Reset on a rejected row posts the reset (G-AUC-3)', async () => {
  thrown = [];
  const posts: string[] = [];
  const matches = (u: URL) => u.pathname.startsWith('/api/auctions/admin/registrations/');
  await page.route(matches, (route) => {
    if (route.request().method() === 'POST')
      posts.push(new URL(route.request().url()).pathname);
    return route.fallback();
  });
  try {
    await page.goto('/admin/auction-registrations');
    await expect(page.getByText('Sara Ahmadi')).toBeVisible();
    await expect(page.getByRole('button', { name: '↺ Reset' })).toHaveCount(0);
    await deskFilter('Status').locator('select').selectOption('rejected');
    await expect(page.getByText('Reza Karimi')).toBeVisible();
    // the auction title resolves from the walked list
    await expect(page.getByRole('cell', { name: 'Spring Evening Auction' })).toBeVisible();
    await page.getByRole('button', { name: '↺ Reset' }).click();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByText('Registration reset')).toBeVisible();
    expect(posts).toEqual([
      '/api/auctions/admin/registrations/00000000-0000-4000-8000-0000000019a2/reset/',
    ]);
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});

test('Auction Records: the house select sends ?house= (G-REC-1)', async () => {
  thrown = [];
  const houses: Array<string | null> = [];
  const matches = (u: URL) => u.pathname === '/api/auctions/admin/records/';
  await page.route(matches, (route) => {
    const sp = new URL(route.request().url()).searchParams;
    if (sp.get('per_page') !== '100') houses.push(sp.get('house'));
    return route.fallback();
  });
  try {
    await page.goto('/admin/auction-records');
    await expect(page.getByText('Heech and Chair')).toBeVisible();
    const select = deskFilter('House').locator('select');
    // a stored house the standard list lacks arrives from the walk
    await expect(select.locator('option', { hasText: 'Artcurial' })).toHaveCount(1);
    await expect(select.locator('option').first()).toHaveText('All auction houses');
    await select.selectOption('Artcurial');
    await expect.poll(() => houses.at(-1)).toBe('Artcurial');
    await expect(page.getByText('Kiss')).toBeVisible();
    await expect(page.getByText('Heech and Chair')).toHaveCount(0);
  } finally {
    await page.unroute(matches);
  }
  expect(thrown).toEqual([]);
});

/**
 * V1 Phase 4 — the catalogue and collectors desks against the stub's rows:
 * three admin artworks (thumb + artist_name; one refused by the publish gate),
 * three artists, three collectors with the G-COL-2 rollups, one Club selection.
 */
const ADM_INCOMPLETE = '00000000-0000-4000-8000-00000000a203';

/** Record the query of every request to one path (the page's own reads). */
function watchQueries(path: string) {
  const seen: URLSearchParams[] = [];
  const matches = (u: URL) => u.pathname === path;
  const handler = (route: import('@playwright/test').Route) => {
    seen.push(new URL(route.request().url()).searchParams);
    return route.fallback();
  };
  return {
    seen,
    last: () => seen[seen.length - 1],
    start: () => page.route(matches, handler),
    stop: () => page.unroute(matches, handler),
  };
}

test('Database: rows lead with thumb + artist, and each Phase-5b filter reaches list and facets', async () => {
  thrown = [];
  const list = watchQueries('/api/catalog/admin/artworks/');
  const facets = watchQueries('/api/catalog/admin/artworks/facets/');
  await list.start();
  await facets.start();
  try {
    await page.goto('/admin/artworks');
    await expect(page.getByText('Heech in a Cage')).toBeVisible();
    // G-CAT-1: the row's own artist name and thumbnail, no roster lookup
    await expect(
      page.locator('.ad-cellmain', { hasText: 'Monir Farmanfarmaian' }),
    ).toBeVisible();
    await expect(page.locator('img.ad-th')).toHaveCount(2);
    await expect(page.locator('span.ad-th')).toHaveCount(1); // the work with no image

    await page.locator('.ad-morefilters summary').click();
    await deskFilter('Gallery Portal').locator('select').selectOption('true');
    await expect.poll(() => list.last()?.get('gallery_portal')).toBe('true');
    await expect(page.getByText('Untitled Study')).toBeVisible();
    await expect(page.getByText('Heech in a Cage')).toHaveCount(0);
    await deskFilter('Gallery Portal').locator('select').selectOption('');

    await deskFilter('Images').locator('select').selectOption('dup');
    await expect.poll(() => list.last()?.get('duplicate_images')).toBe('true');
    expect(list.last()?.get('has_images')).toBeNull();
    await expect(
      page.locator('.ad-fchip-l', { hasText: 'Duplicates (same image)' }),
    ).toBeVisible();
    await deskFilter('Details').locator('select').selectOption('false');
    await expect.poll(() => list.last()?.get('complete')).toBe('false');
    await deskFilter('Size').locator('select').selectOption('large');
    await expect.poll(() => list.last()?.get('size')).toBe('large');
    // facets ride the same query
    await expect.poll(() => facets.last()?.get('size')).toBe('large');
    expect(facets.last()?.get('duplicate_images')).toBe('true');
    expect(facets.last()?.get('complete')).toBe('false');
    await expect(page.getByText('No artworks match these filters.')).toBeVisible();

    // source_type and created_after arrive by link, as chips
    await page.goto(
      '/admin/artworks?source_type=dealer&created_after=2026-01-01T00:00:00.000Z',
    );
    await expect(page.getByText('Mirror Study')).toBeVisible();
    await expect.poll(() => list.last()?.get('source_type')).toBe('dealer');
    expect(list.last()?.get('created_after')).toBe('2026-01-01T00:00:00.000Z');
    await expect(
      page.locator('.ad-fchip-l', { hasText: 'Source type: dealer' }),
    ).toBeVisible();
    await expect(
      page.locator('.ad-fchip-l', { hasText: 'Added since 1 Jan 2026' }),
    ).toBeVisible();
  } finally {
    await list.stop();
    await facets.stop();
  }
  expect(thrown).toEqual([]);
});

test('the publish gate’s refusal lists exactly the missing items (G-CAT-8)', async () => {
  thrown = [];
  await page.goto('/admin/artworks');
  const row = page.locator('tr').filter({ hasText: 'Untitled Study' });
  await row.getByRole('button', { name: /APP/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('This artwork isn’t ready for the Market App yet.');
  await expect(dialog).toContainText('Please complete: image, size.');
  await expect(page.getByRole('alert')).toHaveCount(0); // not the flattened message
  await dialog.getByRole('button', { name: 'Complete it now' }).click();
  await page.waitForURL(`**/admin/artworks/${ADM_INCOMPLETE}`);
  await expect(page.getByRole('heading', { name: 'Edit Artwork' })).toBeVisible();

  // the editor's toggle refuses the same way
  await page.locator('.ad-reachrow').getByRole('button', { name: /APP/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Please complete: image, size.');
  await page.getByRole('dialog').getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(thrown).toEqual([]);
});

test('Published lists every published work through the admin list, private ones too', async () => {
  thrown = [];
  const list = watchQueries('/api/catalog/admin/artworks/');
  await list.start();
  try {
    await page.goto('/admin/published');
    await expect(page.getByText('Mirror Study')).toBeVisible(); // visibility: selected
    await expect(page.getByText('Heech in a Cage')).toBeVisible();
    await expect(page.getByText('Untitled Study')).toHaveCount(0);
    expect(list.seen.some((q) => q.get('published') === 'true')).toBe(true);
    await expect(
      page
        .locator('.ad-tile')
        .filter({ hasText: 'Live for collectors' })
        .locator('.ad-tile-v'),
    ).toHaveText('2');
  } finally {
    await list.stop();
  }
  expect(thrown).toEqual([]);
});

test('Artists: server search, the old sorts, and the works count', async () => {
  thrown = [];
  const list = watchQueries('/api/catalog/admin/artists/');
  await list.start();
  try {
    await page.goto('/admin/artists');
    await expect(page.getByText('Showing 3 of 3 artists')).toBeVisible();
    // the old default, "Sort: Most works"
    expect(list.seen.some((q) => q.get('ordering') === 'works')).toBe(true);
    const tanavoli = page.locator('tr').filter({ hasText: 'Parviz Tanavoli' });
    await expect(tanavoli.locator('td').nth(1)).toHaveText('30');
    await deskFilter('Search').locator('input').fill('Behjat');
    await expect.poll(() => list.last()?.get('search')).toBe('Behjat');
    await expect(page.getByText('Showing 1 of 3 artists')).toBeVisible();
    await deskFilter('Sort').locator('select').selectOption('name');
    await expect.poll(() => list.last()?.get('ordering')).toBe('name');
    expect(list.last()?.get('search')).toBe('Behjat');
  } finally {
    await list.stop();
  }
  expect(thrown).toEqual([]);
});

test('Collectors: the strip equals the summary; the old sorts reach ?ordering=', async () => {
  thrown = [];
  const list = watchQueries('/api/auth/admin/collectors/');
  await list.start();
  try {
    await page.goto('/admin/collectors');
    const tile = (l: string) =>
      page
        .locator('.ad-tile')
        .filter({ has: page.locator('.ad-tile-l', { hasText: new RegExp(`^${l}$`) }) })
        .locator('.ad-tile-v');
    await expect(tile('Collectors')).toHaveText('3');
    await expect(tile('VIP')).toHaveText('1');
    await expect(tile('Active 30d')).toHaveText('2');
    await expect(tile('Engaged')).toHaveText('2');
    // opens on the old default, Recently active
    await expect.poll(() => list.seen[0]?.get('ordering')).toBe('-activity');
    await expect(page.getByText('No activity yet')).toBeVisible();
    await deskFilter('Sort').locator('select').selectOption('-purchases');
    await expect.poll(() => list.last()?.get('ordering')).toBe('-purchases');
    await expect(page.locator('tbody tr').first()).toContainText('Dariush Kamali');
    await expect(page.locator('tbody tr').first()).toContainText('3');
  } finally {
    await list.stop();
  }
  expect(thrown).toEqual([]);
});

test('Club: the card cover is the first work’s thumb (G-CLUB-1)', async () => {
  thrown = [];
  await page.goto('/admin/club');
  const top = page.locator('.ad-clubtop').first();
  await expect(top).toContainText('Autumn private view');
  await expect(top).toHaveAttribute('style', /thumb-2\.svg/);
  expect(thrown).toEqual([]);
});

test('Data Health: the nine boxes read their counts, and Recently Added opens the Database', async () => {
  thrown = [];
  await page.goto('/admin/data-health');
  const box = (t: string) =>
    page.locator('.ad-ovbox').filter({ hasText: t }).locator('.ad-ovbox-num');
  await expect(box('Market App Artworks')).toHaveText('2');
  await expect(box('Gallery-Sourced')).toHaveText('1');
  await expect(box('Dealer-Sourced')).toHaveText('1');
  await expect(box('Artist-Sourced')).toHaveText('0');
  await expect(box('Deleted (permanent)')).toHaveText('7');
  await expect(box('Recently Added')).toHaveText('1');
  await expect(box('Archived / Unavailable')).toHaveText('1');
  await page.locator('a.ad-ovbox').filter({ hasText: 'Recently Added' }).click();
  await page.waitForURL(/\/admin\/artworks\?created_after=/);
  await expect(page.getByText('Heech in a Cage')).toBeVisible();
  await expect(page.getByText('Mirror Study')).toHaveCount(0);
  expect(thrown).toEqual([]);
});

test('Dashboard: a catalogue tile opens the Database filtered to its status', async () => {
  thrown = [];
  const list = watchQueries('/api/catalog/admin/artworks/');
  await list.start();
  try {
    await page.goto('/admin');
    await page.locator('a.ad-tile').filter({ hasText: 'Sold' }).click();
    await page.waitForURL('**/admin/artworks?availability_status=sold');
    await expect.poll(() => list.last()?.get('availability_status')).toBe('sold');
    await expect(page.getByText('Untitled Study')).toBeVisible();
    await expect(page.getByText('Heech in a Cage')).toHaveCount(0);
  } finally {
    await list.stop();
  }
  expect(thrown).toEqual([]);
});
