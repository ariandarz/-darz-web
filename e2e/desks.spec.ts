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
  ['/admin/exhibition-catalogue', 'Service checklist'],
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
  // V1 Phase 8 — the owner Access desk (G-KEY-1)
  ['/admin/access', 'Access Management'],
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

/**
 * V1 Phase 5 — the Sources desk, Source detail, the exhibition menu and
 * compose, against the stub's gallery links. The desk drives the Golestan
 * link only (`portal.spec.ts` owns Aria), so a re-issue here cannot lock the
 * portal walk out.
 */
const STUB = 'http://127.0.0.1:8787';
const GL_DESK = '00000000-0000-4000-8000-000000005a02';
const GEX_ID = '00000000-0000-4000-8000-000000005e01';

test('Sources: the partner search is server-side (G-PORT-15)', async () => {
  thrown = [];
  const links = watchQueries('/api/gallery/admin/links/');
  await links.start();
  try {
    await page.goto('/admin/sources');
    await expect(page.getByText('Aria Gallery')).toBeVisible();
    await page.getByLabel('Find a partner').fill('leila');
    await expect.poll(() => links.last()?.get('search')).toBe('leila');
    await expect(page.getByText('Golestan Gallery')).toBeVisible();
    await expect(page.getByText('Aria Gallery')).toHaveCount(0);
  } finally {
    await links.stop();
  }
  expect(thrown).toEqual([]);
});

test('Source Updates: an ask shows its question, an image says it arrived, a withdraw says it unassigns', async () => {
  thrown = [];
  await page.goto('/admin/sources?view=updates');
  // the portal walk may add Aria's own rows in parallel — read Golestan's
  const golestan = page.locator('.ad-updrow').filter({ hasText: 'Golestan Gallery' });
  const ask = golestan.filter({ hasText: 'Ask about a work' });
  await expect(ask).toContainText('Is the frame included?');
  await expect(ask.getByRole('button', { name: 'Mark handled' })).toBeVisible();
  await expect(
    golestan.filter({ hasText: 'Image submitted — open via Darz storage' }),
  ).toHaveCount(1);
  const withdraw = golestan.filter({ hasText: 'Withdraw a work' });
  await withdraw.getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('.ad-confirm-m')).toContainText(
    'The work is removed from the partner’s portal',
  );
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'POST' && /\/approve\/$/.test(r.url())),
    page.locator('.ad-confirm-ok').click(),
  ]);
  expect(new URL(req.url()).pathname).toContain('/api/gallery/admin/updates/');
  await expect(withdraw).toHaveCount(0);
  expect(thrown).toEqual([]);
});

test('Source detail: Regenerate shows a new pair once; the old one stops, the status stays (G-PORT-13)', async () => {
  thrown = [];
  await page.goto(`/admin/sources/${GL_DESK}`);
  await expect(page.getByRole('heading', { name: 'Golestan Gallery' })).toBeVisible();
  await page.getByRole('button', { name: 'Regenerate' }).click();
  // the old passport's confirm, plus what the backend leaves alone
  await expect(page.locator('.ad-confirm-m')).toContainText(
    'Replace the current link with a new secure link? The old link stops working immediately.',
  );
  await expect(page.locator('.ad-confirm-m')).toContainText('The portal stays disabled');
  await page.getByRole('button', { name: 'Replace link' }).click();
  const secret = page.locator('.ad-secret-v');
  await expect(secret.first()).toContainText('/portal/e2e-reissued-');
  const url = (await secret.first().innerText()).trim();
  const token = url.split('/portal/')[1];
  const pin = (await secret.nth(1).innerText()).trim();
  expect(pin).toMatch(/^\d{6}$/);
  // the old credentials no longer resolve; the new ones do, and the link
  // is still disabled (re-issue is credentials only)
  const old = await page.request.get(`${STUB}/api/gallery/portal/e2e-desk/?pin=135790`);
  expect(old.status()).toBe(404);
  const now = await page.request.get(`${STUB}/api/gallery/portal/${token}/?pin=${pin}`);
  expect(now.status()).toBe(401);
  expect((await now.json()).error.message).toContain('no longer active');
  await expect(page.locator('.ad-invite-text')).toHaveValue(new RegExp(token));
  expect(thrown).toEqual([]);
});

test('Source detail: pricelists open their file, show built lines, and a status change re-reads the list (P3a, C-21)', async () => {
  thrown = [];
  const lists = watchQueries(`/api/gallery/admin/links/${GL_DESK}/pricelists/`);
  await lists.start();
  try {
    await page.goto(`/admin/sources/${GL_DESK}`);
    const upload = page.locator('.ad-plrow', { hasText: 'golestan-2026.pdf' });
    await expect(upload.getByRole('link', { name: 'Open file' })).toHaveAttribute(
      'href',
      /\/files\/pricelist\.pdf$/,
    );
    await expect(upload.locator('.ad-stpill')).toHaveText('Accepted');
    const built = page.locator('.ad-plrow', { hasText: 'Built in portal — 2 works' });
    await expect(built.locator('.ad-pllines')).toContainText('Untitled, 1974');
    await expect(built.locator('.ad-pllines')).toContainText('52,000.00 USD');
    // the soft cap is advisory: a line, nothing disabled
    await expect(page.getByText(/over the soft cap of 1/)).toBeVisible();

    const before = lists.seen.length;
    const [req] = await Promise.all([
      page.waitForRequest((r) => r.method() === 'POST' && /\/status\/$/.test(r.url())),
      built.getByRole('button', { name: 'Mark accepted' }).click(),
    ]);
    expect(req.postDataJSON()).toEqual({ status: 'accepted' });
    await expect.poll(() => lists.seen.length).toBeGreaterThan(before);
    await expect(built.locator('.ad-stpill')).toHaveText('Accepted');
    // accepting one superseded the other — only the re-read can show that
    await expect(upload.locator('.ad-stpill')).toHaveText('Superseded');
  } finally {
    await lists.stop();
  }
  expect(thrown).toEqual([]);
});

test('Service checklist: add, edit with the lock, a stale save is a 409, and the portal menu follows (G-PORT-12b)', async () => {
  thrown = [];
  await page.goto('/admin/exhibition-catalogue');
  await expect(page.getByRole('heading', { name: 'Service checklist' })).toBeVisible();
  await expect(page.locator('.ad-gxe-row')).toHaveCount(4);

  // add — the key follows the title until typed
  await page.getByRole('button', { name: '+ Add service' }).click();
  const form = page.locator('.ad-form');
  await form.getByLabel('Service').fill('Opening Reel');
  await expect(form.getByLabel('Key · fixed once saved')).toHaveValue('opening_reel');
  await form.getByLabel(/^Price/).fill('3000000');
  const [created] = await Promise.all([
    page.waitForRequest(
      (r) => r.method() === 'POST' && /exhibition-catalogue\/$/.test(r.url()),
    ),
    form.getByRole('button', { name: 'Add service' }).click(),
  ]);
  expect(created.postDataJSON()).toMatchObject({
    key: 'opening_reel',
    title: 'Opening Reel',
    default_price: '3000000',
    is_active: true,
  });
  await expect(page.locator('.ad-gxe-row')).toHaveCount(5);

  // edit — the PATCH carries expected_version, never the key
  const first = page.locator('.ad-gxe-row').first();
  await first.getByLabel('Price').fill('750000');
  const [patched] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'PATCH'),
    first.getByRole('button', { name: 'Save' }).click(),
  ]);
  expect(patched.postDataJSON()).toMatchObject({
    default_price: '750000',
    expected_version: 1,
  });
  expect(patched.postDataJSON()).not.toHaveProperty('key');
  await expect(page.locator('.dz-toast.show')).toHaveText('Saved ✓');

  // stale — another admin saved row 2 in the meantime
  await page.request.post(
    `${STUB}/__stub/exhibition-catalogue/00000000-0000-4000-8000-00000000ec02/touch/`,
  );
  const second = page.locator('.ad-gxe-row').nth(1);
  await second.getByLabel('Service').fill('Video Documentation (edited)');
  await second.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByText('Someone else saved this service in the meantime — reload to continue.'),
  ).toBeVisible();

  // the portal reads the same table: the new service is on its menu
  const menu = await page.request.get(
    `${STUB}/api/gallery/portal/e2e-portal/exhibitions/catalogue/?pin=246810`,
  );
  const services = (await menu.json()).data.services as Array<{ key: string }>;
  expect(services.map((x) => x.key)).toContain('opening_reel');
  expect(thrown).toEqual([]);
});

test('Compose: the menu is the exhibition catalogue, and each line sends its quantity (G-PORT-16)', async () => {
  thrown = [];
  await page.goto(`/admin/sources/${GL_DESK}/exhibitions/${GEX_ID}`);
  await expect(page.getByRole('heading', { name: 'Autumn Group Show' })).toBeVisible();
  // seeded from the gallery's ticks, priced from the catalogue
  const line = page.locator('.ad-exhline').first();
  await expect(line.getByLabel('Service title')).toHaveValue('Exhibition Photo Coverage');
  await expect(line.getByLabel('Price')).toHaveValue('750,000');
  await expect(line.getByLabel('Quantity')).toHaveValue('1');
  await line.getByLabel('Quantity').fill('3');
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'POST' && /\/compose\/$/.test(r.url())),
    page.getByRole('button', { name: 'Save package' }).click(),
  ]);
  const body = req.postDataJSON() as {
    lines: Array<{ service_key: string; quantity: number }>;
  };
  expect(body.lines[0]).toMatchObject({ service_key: 'exhibition_photo', quantity: 3 });
  expect(body.lines[1]).toMatchObject({ service_key: 'darz_listing', quantity: 1 });
  // the server's lines are the truth after a save — and they keep the 3
  await expect(page.locator('.ad-exhline').first().getByLabel('Quantity')).toHaveValue('3');
  expect(thrown).toEqual([]);
});

test('Exhibition Services: descriptions come from the API and save back (G-PROJ-8)', async () => {
  thrown = [];
  await page.goto('/admin/exhibition-services');
  // a search opens every group that matches
  await page.getByLabel('Find a service').fill('interview');
  await expect(
    page.getByText('An editorial interview with the artist, in Farsi and English.'),
  ).toBeVisible();
  await page.getByLabel('Find a service').fill('Darz Listing');
  const row = page.locator('.dzx-row', { hasText: 'Darz Listing' });
  await row.getByRole('button', { name: 'Edit' }).click();
  const editor = page.locator('.dzx-row.is-editing');
  await editor
    .getByLabel('Service description')
    .fill('Listed for the Darz collector network.');
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'PATCH' && /service-catalog/.test(r.url())),
    editor.getByRole('button', { name: 'Save' }).click(),
  ]);
  expect(req.postDataJSON()).toMatchObject({
    description: 'Listed for the Darz collector network.',
    expected_version: 1,
  });
  expect(thrown).toEqual([]);
});

/**
 * V1 Phase 6 — documents (G-DOC-1 share, G-DOC-2 History, owner_lock) and the
 * admin thread (D19 attach, G-CHAT-2 archive). Fixtures: `phase6Patterns` in
 * the stub.
 */
const DOC_LOCKED = '00000000-0000-4000-8000-0000000d0601';
const DOC_SHARE = '00000000-0000-4000-8000-0000000d0602';
const DOC_ATTACH = '00000000-0000-4000-8000-0000000d0603';
const LEILA = '00000000-0000-4000-8000-0000000c0001';

test('Document detail: the History section lists the trail with a flat actor (G-DOC-2)', async () => {
  thrown = [];
  await page.goto(`/admin/documents/${DOC_SHARE}`);
  const history = page.getByRole('region', { name: 'History' });
  await expect(history.getByRole('heading', { name: 'History' })).toBeVisible();
  const rows = history.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Transition');
  await expect(rows.nth(0)).toContainText('draft → confirmed');
  await expect(rows.nth(0)).toContainText('Arian Darz');
  // no actor → the Settings log's own fallback
  await expect(rows.nth(2)).toContainText('system');
  expect(thrown).toEqual([]);
});

test('Document detail: share with the collector, then stop sharing (G-DOC-1)', async () => {
  thrown = [];
  await page.goto(`/admin/documents/${DOC_SHARE}`);
  const share = page.getByRole('region', { name: 'Share with collector' });
  await expect(share.locator('.ad-stpill')).toHaveText('Not shared');
  // the document's own collector is picked already
  await expect(share.locator('.ad-pickchip')).toContainText('Leila Ahmadi');
  const [post] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'POST' && /\/share\/$/.test(r.url())),
    share.getByRole('button', { name: 'Share with collector' }).click(),
  ]);
  expect(post.postDataJSON()).toEqual({ collector: LEILA });
  await expect(share.locator('.ad-stpill')).toHaveText('Sharing');
  await expect(share).toContainText('with Leila Ahmadi');
  const [del] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'DELETE' && /\/share\/$/.test(r.url())),
    share.getByRole('button', { name: 'Stop sharing' }).click(),
  ]);
  expect(del.url()).toContain(`/documents/admin/documents/${DOC_SHARE}/share/`);
  await expect(share.locator('.ad-stpill')).toHaveText('Not shared');
  expect(thrown).toEqual([]);
});

test('Document detail: the owner is not held by owner_lock', async () => {
  thrown = [];
  await page.goto(`/admin/documents/${DOC_LOCKED}`);
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Archive' })).toBeEnabled();
  await expect(page.locator('.ad-lockline')).toHaveCount(0);
  expect(thrown).toEqual([]);
});

test('a standard admin sees an owner-locked document’s actions disabled, with the reason', async ({
  browser,
}) => {
  const std = await browser.newPage();
  const errors: string[] = [];
  std.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  try {
    await std.goto('/admin/login');
    await std.fill('input[name="email"]', 'standard@example.invalid');
    await std.fill('input[name="password"]', 'anything');
    await std.locator('form button[type="submit"]').click();
    await std.waitForURL('**/admin');
    await std.goto(`/admin/documents/${DOC_LOCKED}`);
    await expect(std.locator('.ad-lockline')).toHaveText(
      'Owner-locked — only the owner can edit, upload, confirm, sign or archive this document.',
    );
    for (const name of ['Save draft', 'Archive', 'Confirm — lock this document']) {
      await expect(std.getByRole('button', { name })).toBeDisabled();
    }
    await expect(std.locator('input[type="file"]')).toBeDisabled();
    await expect(std.getByLabel('Title')).toBeDisabled();
    // delete stays the owner's alone (G-DEL-1)
    await expect(std.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    // share is not owner-guarded server-side, so it stays live
    await expect(
      std
        .getByRole('region', { name: 'Share with collector' })
        .getByRole('button', { name: 'Share with collector' }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await std.close();
  }
});

test('Chat: attach a document — the POST carries document_refs and the chip renders (D19)', async () => {
  thrown = [];
  await page.goto('/admin/chat');
  await page.getByRole('link', { name: /Leila Ahmadi/ }).click();
  await expect(page.locator('.ad-thread-name')).toHaveText('Leila Ahmadi');
  // an earlier attach already reads as a chip, opening the document
  await expect(
    page.locator('.ad-docchip', { hasText: 'Certificate — Mirror Study' }),
  ).toHaveAttribute('href', `/admin/documents/${DOC_SHARE}`);

  await page.getByRole('button', { name: 'Attach document' }).click();
  const list = page.locator('.ad-attach-list');
  // Leila's certificate, then the two unissued invoices (newest first)
  await expect(list.getByRole('button')).toHaveCount(3);
  await expect(list.getByRole('button').first()).toContainText('Certificate — Mirror Study');
  // never another collector's document, never a non-shareable kind
  await expect(list).not.toContainText('someone else');
  await expect(list).not.toContainText('Proposal');
  await list.getByRole('button', { name: /Invoice — Mirror Study/ }).click();
  await expect(page.getByLabel('Attached document')).toContainText('Invoice — Mirror Study');

  await page.getByPlaceholder('Write a message to Leila Ahmadi…').fill('Your invoice.');
  const [post] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'POST' && /\/messages\/$/.test(r.url())),
    page.getByRole('button', { name: 'Send' }).click(),
  ]);
  expect(post.postDataJSON()).toEqual({
    body: 'Your invoice.',
    artwork_refs: [],
    document_refs: [DOC_ATTACH],
  });
  const sent = page.locator('.ad-bub', { hasText: 'Your invoice.' });
  await expect(sent.locator('.ad-docchip')).toContainText('Invoice — Mirror Study');
  await expect(page.getByLabel('Attached document')).toHaveCount(0);
  expect(thrown).toEqual([]);
});

test('Chat: archive hides a message; Include archived shows it marked; restore brings it back (G-CHAT-2)', async () => {
  thrown = [];
  await page.goto('/admin/chat');
  await page.getByRole('link', { name: /Leila Ahmadi/ }).click();
  const oldNote = page.locator('.ad-bub', { hasText: 'An old note' });
  const thanks = page.locator('.ad-bub', { hasText: 'Thank you.' });
  await expect(thanks).toBeVisible();
  // archived by default → hidden
  await expect(oldNote).toHaveCount(0);

  const [arch] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'POST' && /\/archive\/$/.test(r.url())),
    thanks.getByRole('button', { name: 'Archive' }).click(),
  ]);
  expect(arch.postDataJSON()).toEqual({ archived: true });
  await expect(thanks).toHaveCount(0);

  const [read] = await Promise.all([
    page.waitForRequest((r) => /include_archived=true/.test(r.url())),
    page.getByLabel('Include archived').check(),
  ]);
  expect(read.url()).toContain('include_archived=true');
  await expect(oldNote).toContainText('· archived');
  await expect(thanks).toContainText('· archived');

  const [restore] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'POST' && /\/archive\/$/.test(r.url())),
    thanks.getByRole('button', { name: 'Restore' }).click(),
  ]);
  expect(restore.postDataJSON()).toEqual({ archived: false });
  await expect(thanks).not.toContainText('· archived');

  await page.getByLabel('Include archived').uncheck();
  await expect(thanks).toBeVisible();
  await expect(oldNote).toHaveCount(0);
  expect(thrown).toEqual([]);
});

/**
 * V1 Phase 7 — the Projects suite over the served API: the dashboard reads the
 * server's Delayed / Awaiting counts (G-PROJ-3), a card opens the list on the
 * server's `?quick=` (G-PROJ-1), the record's Status select and the FX block
 * PATCH with the lock (G-PROJ-2/9), the totals panel reads `…/totals/`
 * (C-22), a board move seeds `stages` before it moves (G-PROJ-3), and a stale
 * save is the conflict banner. Fixtures: `phase7Patterns` in the stub — stateful,
 * so these run in this order.
 */
const P7_FX = '00000000-0000-4000-8000-000000007001';
const P7_PLAIN = '00000000-0000-4000-8000-000000007002';

test('Projects dashboard: Delayed and Awaiting approval read the server counts', async () => {
  thrown = [];
  await page.goto('/admin/projects');
  const card = (k: string) =>
    page.locator('.dzp-att', { has: page.getByText(k, { exact: true }) });
  await expect(card('Delayed').locator('.n')).toHaveText('1');
  await expect(card('Awaiting approval').locator('.n')).toHaveText('1');
  await expect(card('Active projects').locator('.n')).toHaveText('2');
  await expect(page.getByText('stay at 0', { exact: false })).toHaveCount(0);
  expect(thrown).toEqual([]);
});

test('Projects list: a quick card reaches the list as ?quick= (G-PROJ-1)', async () => {
  thrown = [];
  await page.goto('/admin/projects');
  const [req] = await Promise.all([
    page.waitForRequest(
      (r) => /\/projects\/admin\/projects\/\?/.test(r.url()) && /quick=/.test(r.url()),
    ),
    page.locator('.dzp-att', { hasText: 'Awaiting approval' }).click(),
  ]);
  const q = new URL(req.url()).searchParams;
  expect(q.get('quick')).toBe('awaiting_approval');
  expect(q.get('archived')).toBe('False');
  await expect(page.locator('.dzp-row', { hasText: '13 Vanak' })).toBeVisible();
  await expect(page.locator('.dzp-row', { hasText: 'Kargah' })).toHaveCount(0);
  await expect(page.locator('.dzp-chip', { hasText: 'Awaiting approval' })).toBeVisible();
  // only the Projects sub-tab is lit — not also Dashboard, whose path is a prefix
  await expect(page.locator('.ad-subtab.on', { hasText: 'Dashboard' })).toHaveCount(0);

  const [delayed] = await Promise.all([
    page.waitForRequest((r) => /quick=delayed/.test(r.url())),
    page.goto('/admin/projects/list?quick=delayed'),
  ]);
  expect(delayed.url()).toContain('quick=delayed');
  await expect(page.locator('.dzp-row', { hasText: 'Kargah' })).toBeVisible();
  await expect(page.locator('.dzp-row', { hasText: '13 Vanak' })).toHaveCount(0);
  expect(thrown).toEqual([]);
});

test('Project record: the Status select saves status with the lock (G-PROJ-2)', async () => {
  thrown = [];
  await page.goto(`/admin/projects/${P7_PLAIN}`);
  const status = page.getByRole('combobox', { name: 'Status', exact: true });
  await expect(status).toHaveValue('Qualified');
  await status.selectOption('Negotiation');
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'PATCH' && r.url().includes(P7_PLAIN)),
    page.getByRole('button', { name: 'Save', exact: true }).click(),
  ]);
  expect(req.postDataJSON()).toMatchObject({ status: 'Negotiation', expected_version: 1 });
  await expect(page.getByText('Project saved')).toBeVisible();
  await expect(status).toHaveValue('Negotiation');
  await expect(page.getByText('derived from the stage')).toHaveCount(0);
  expect(thrown).toEqual([]);
});

test('Project record: FX saves with the lock and the totals panel shows the converted total (G-PROJ-9)', async () => {
  thrown = [];
  await page.goto(`/admin/projects/${P7_PLAIN}`);
  await page.locator('summary', { hasText: 'Money' }).click();
  const money = page.locator('details', {
    has: page.locator('summary', { hasText: 'Money' }),
  });
  // before: no rate — per-currency rows only, and the old deal bar's hint
  await expect(money.locator('.dzp-mrow', { hasText: 'TMN' })).toContainText(
    'Client 12,000,000 TMN',
  );
  await expect(money.getByText('Enter an exchange rate above')).toBeVisible();

  await money.getByRole('combobox', { name: 'Deal currency' }).selectOption('USD');
  await money.getByLabel('Exchange rate').fill('600,000');
  await money.getByRole('combobox', { name: 'Convert to' }).selectOption('TMN');
  await money.getByLabel('Rate date').fill('2026-09-25');
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'PATCH' && r.url().includes(P7_PLAIN)),
    page.getByRole('button', { name: 'Save', exact: true }).click(),
  ]);
  expect(req.postDataJSON()).toMatchObject({
    deal_currency: 'USD',
    deal_fx_target_currency: 'TMN',
    deal_fx_rate: '600000',
    deal_fx_rate_date: '2026-09-25',
    expected_version: 2,
  });
  await expect(money.getByText('Converted total')).toBeVisible();
  // 12,000,000 TMN + 250 USD × 600,000 (fee) — computed by the server, shown as served
  const converted = money.locator('.dzp-mrow', { hasText: 'Fee 150,000,000 TMN' });
  await expect(converted).toContainText('Client 12,000,000 TMN');
  await expect(money.getByText('1 USD = 600,000 TMN (2026-09-25)')).toBeVisible();
  expect(thrown).toEqual([]);
});

test('Project record: the backend’s "unknown" bucket reads "No currency" (C-22)', async () => {
  thrown = [];
  await page.goto('/admin/projects/00000000-0000-4000-8000-000000007003');
  await page.locator('summary', { hasText: 'Money' }).click();
  const row = page.locator('.dzp-mrow', { hasText: 'No currency' });
  await expect(row).toContainText('Due 75.50');
  await expect(row).not.toContainText('unknown');
  await expect(page.locator('.dzp-mrow', { hasText: 'USD' })).toContainText('Client 900 USD');
  expect(thrown).toEqual([]);
});

test('Project record: totals list the currencies a rate cannot convert', async () => {
  thrown = [];
  await page.goto(`/admin/projects/${P7_FX}`);
  await page.locator('summary', { hasText: 'Money' }).click();
  await expect(page.getByText('Not converted: EUR')).toBeVisible();
  await expect(page.locator('.dzp-mrow', { hasText: 'USD' }).first()).toContainText(
    'Cost 1,000.10 USD',
  );
  expect(thrown).toEqual([]);
});

test('Pipeline: a move seeds the stage sub-state, then moves with the new version (G-PROJ-3)', async () => {
  thrown = [];
  await page.goto('/admin/projects/pipeline');
  const card = page.locator('.dzp-kcard', { hasText: 'Kargah documentation' });
  const patch = page.waitForRequest(
    (r) => r.method() === 'PATCH' && r.url().includes(P7_PLAIN),
  );
  const move = page.waitForRequest((r) => r.method() === 'POST' && /\/stage\/$/.test(r.url()));
  await card.getByRole('button', { name: 'Fwd ›' }).click();
  const body = (await patch).postDataJSON() as {
    stages: Record<string, Record<string, unknown>>;
    expected_version: number;
  };
  expect(body.expected_version).toBe(3);
  // the target is dated and gets the Proposal template's checklist (:13709)
  expect(body.stages.proposal.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(
    (body.stages.proposal.checklist as Array<{ text: string }>).map((c) => c.text),
  ).toEqual(['Confirm scope with the client', 'Draft deliverables & counts']);
  // every earlier stage is stamped done (:13711); the existing brief entry keeps its due
  expect(body.stages.lead.doneTs).toBeGreaterThan(0);
  expect(body.stages.brief).toMatchObject({ due: '2026-09-01' });
  expect(body.stages.brief.doneTs).toBeGreaterThan(0);
  expect((await move).postDataJSON()).toEqual({ stage: 'proposal', expected_version: 4 });
  await expect(page.getByText('Stage → Proposal')).toBeVisible();
  await expect(page.getByText('A move records the new stage only')).toHaveCount(0);
  expect(thrown).toEqual([]);
});

test('Project record: a stale save gets the 409 and the conflict banner', async () => {
  thrown = [];
  await page.goto(`/admin/projects/${P7_FX}`);
  await expect(page.getByLabel('Project name')).toHaveValue('13 Vanak · media partnership');
  // another editor saves first — the stub's version moves on
  const other = await page.request.patch(
    `http://127.0.0.1:8787/api/projects/admin/projects/${P7_FX}/`,
    { data: { report: 'Edited elsewhere', expected_version: 3 } },
  );
  expect(other.status()).toBe(200);
  await page.getByLabel('Project name').fill('13 Vanak · renamed');
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.method() === 'PATCH' && r.url().includes(P7_FX)),
    page.getByRole('button', { name: 'Save', exact: true }).click(),
  ]);
  expect(req.postDataJSON()).toMatchObject({ expected_version: 3 });
  await expect(
    page.getByText('Someone else saved this project in the meantime'),
  ).toBeVisible();
  expect(thrown).toEqual([]);
});

/* ── V1 Phase 8: the owner Access desk (G-KEY-1) ───────────────────────────
   The stub serves four keys (`ACCESS_KEYS`): Leila's lapses in 3 days, one of
   Dariush's is locked, Sara's is stored `active` but past expiry (C-17), and
   Dariush's other is permanent. Serial, and the extend walk mutates the stub,
   so the reads come first. */
const accessTable = () => page.getByRole('table', { name: 'Access keys' });
const accessRow = (name: string) => accessTable().locator('tbody tr', { hasText: name });

test('Access: the tiles equal the summary; a lapsed stored-active key reads Expired (C-17)', async () => {
  thrown = [];
  const summaryRead = page.waitForResponse((r) =>
    r.url().endsWith('/api/auth/admin/access-keys/summary/'),
  );
  await page.goto('/admin/access');
  const summary = ((await (await summaryRead).json()) as { data: Record<string, number> })
    .data;
  const tile = (l: string) =>
    page
      .locator('.ad-tile')
      .filter({ has: page.locator('.ad-tile-l', { hasText: new RegExp(`^${l}$`) }) })
      .locator('.ad-tile-v');
  await expect(tile('Total Collectors')).toHaveText(String(summary.total_collectors));
  await expect(tile('Active Collectors')).toHaveText(String(summary.active_collectors));
  await expect(tile('Expiring ≤ 7d')).toHaveText(String(summary.expiring_soon));
  await expect(tile('Logins today')).toHaveText(String(summary.logins_today));

  // Sara's key: stored `active`, `is_expired: true` — the desk must say Expired
  await expect(accessRow('Sara Nouri').locator('.ad-stpill')).toHaveText('Expired');
  await expect(accessRow('Sara Nouri').getByRole('button', { name: 'Revoke' })).toBeVisible();
  // the revoked key: Locked, and nothing to extend
  const locked = accessTable().locator('tbody tr', {
    has: page.locator('.ad-stpill', { hasText: 'Locked' }),
  });
  await expect(locked).toHaveCount(1);
  await expect(locked.getByRole('button')).toHaveCount(0);
  // the name opens the collector
  await expect(
    accessRow('Leila Ahmadi').getByRole('link', { name: 'Leila Ahmadi' }),
  ).toHaveAttribute('href', '/admin/collectors/00000000-0000-4000-8000-0000000c0001');
  // the review banner: the lapsed key and the lapsing one
  const banner = page.getByRole('region', { name: 'Keys needing a decision' });
  await expect(banner).toContainText('2 keys need a decision — extend or let expire');
  await expect(banner).toContainText('Sara Nouri');
  await expect(banner).toContainText('Expires in 2 days'); // 3 days less the seconds since boot
  expect(thrown).toEqual([]);
});

test('Access: the Expiring ≤ 7d chip and the status filter reach the roster query', async () => {
  thrown = [];
  const list = watchQueries('/api/auth/admin/access-keys/');
  await list.start();
  // the banner's own two reads ride the same path at per_page=100 — the desk's
  // list reads are the others
  const desk = () => list.seen.filter((q) => q.get('per_page') !== '100');
  try {
    await page.goto('/admin/access');
    await expect(accessTable().locator('tbody tr')).toHaveCount(4);
    await page.getByLabel('Expiring ≤ 7d').check();
    await expect.poll(() => desk().at(-1)?.get('expiring_soon')).toBe('true');
    await expect(accessTable().locator('tbody tr')).toHaveCount(1);
    await expect(accessRow('Leila Ahmadi')).toBeVisible();
    await page.getByLabel('Expiring ≤ 7d').uncheck();
    await expect.poll(() => desk().at(-1)?.get('expiring_soon')).toBeNull();

    await deskFilter('Status').locator('select').selectOption('expired');
    await expect.poll(() => desk().at(-1)?.get('status')).toBe('expired');
    await expect(accessTable().locator('tbody tr')).toHaveCount(1);
    await expect(accessRow('Sara Nouri')).toBeVisible();
    await deskFilter('Status').locator('select').selectOption('');
  } finally {
    await list.stop();
  }
  expect(thrown).toEqual([]);
});

test('Access: +1 week posts the extend and the row re-reads with the new expiry', async () => {
  thrown = [];
  await page.goto('/admin/access');
  const period = accessRow('Leila Ahmadi').locator('td').nth(3);
  await expect(period).not.toHaveText('');
  const before = await period.textContent();
  const [post] = await Promise.all([
    page.waitForRequest(
      (r) => r.method() === 'POST' && /\/access-keys\/[^/]+\/extend\/$/.test(r.url()),
    ),
    accessRow('Leila Ahmadi').getByRole('button', { name: '+1 week' }).click(),
  ]);
  expect(post.postDataJSON()).toEqual({ extend: '1w' });
  expect(post.url()).toContain('/access-keys/00000000-0000-4000-8000-0000000acc01/extend/');
  await expect(period).not.toHaveText(before ?? '');
  await expect(page.locator('.dz-toast')).toContainText(
    'Leila Ahmadi extended by 1 week — until',
  );
  expect(thrown).toEqual([]);
});

test('Access: a standard admin gets the owner-only refusal card (Q-1)', async ({
  browser,
}) => {
  const std = await browser.newPage();
  const errors: string[] = [];
  std.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  try {
    await std.goto('/admin/login');
    await std.fill('input[name="email"]', 'standard@example.invalid');
    await std.fill('input[name="password"]', 'anything');
    await std.locator('form button[type="submit"]').click();
    await std.waitForURL('**/admin');
    await std.goto('/admin/access');
    await expect(std.getByRole('heading', { name: 'Access', exact: true })).toBeVisible();
    await expect(
      std.getByText('This area is private to the owner’s login only.'),
    ).toBeVisible();
    await expect(std.getByRole('table', { name: 'Access keys' })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await std.close();
  }
});
