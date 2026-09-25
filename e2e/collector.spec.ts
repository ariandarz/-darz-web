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
  ['/questionnaire', 60],
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

/**
 * The questionnaire, walked end to end.
 *
 * It is the one collector screen with real multi-step state, and three of its
 * rules are invisible from a single page load: the step counter counts the
 * contact step (so eleven, not ten), Continue is gated until a question is
 * answered, and the answers survive the walk to the review. The stub's GET
 * 404s — its documented "never submitted" answer — so this starts at the
 * intro, which is also the path a real new collector takes.
 */
test('the questionnaire runs intro → contact → questions → review → sent', async () => {
  thrown = [];
  await page.goto('/questionnaire');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: /how you collect/i })).toBeVisible();
  await page.getByRole('button', { name: /^Begin/ }).click();

  // Step 0 is the contact step, and it counts: eleven segments, not ten.
  await expect(page.locator('.qstepn')).toHaveText('1 / 11');
  await page.fill('#q-email', 'collector@example.invalid');
  await page.getByRole('button', { name: 'Continue' }).click();

  // A question with no answer cannot be continued past.
  await expect(page.locator('.qstepn')).toHaveText('2 / 11');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page.getByRole('button', { name: 'Abstraction' }).click();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();

  // Walk the rest by always taking the first option. Nine more Continues land
  // on step 10 — the optional free-text one, which has no options to click and
  // whose button reads "Review →" because it is the last visible step.
  for (let i = 0; i < 9; i++) {
    await page.getByRole('button', { name: 'Continue' }).click();
    const opts = page.locator('.qopt');
    if (await opts.count()) await opts.first().click();
  }
  await page.getByRole('button', { name: 'Review →' }).click();

  // The answers made it, under their own question text. `.qttl` is a div in
  // the old markup too, not a heading — hence the class rather than a role.
  await expect(page.locator('.qttl')).toHaveText('Review & send');
  await expect(page.locator('.qsum-card').first()).toContainText('collector@example.invalid');
  await expect(page.locator('.qsum-card').last()).toContainText('Abstraction');

  await page.getByRole('button', { name: 'Confirm & send' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();

  expect(thrown, 'page errors during the questionnaire').toEqual([]);
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
});

/** The Profile card is the only way in, so it is part of the screen. */
test('the profile overview opens the questionnaire', async () => {
  thrown = [];
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.qcta-lab')).toHaveText('Get to know you');
  await page.getByRole('button', { name: /Begin your profile/ }).click();
  await expect(page).toHaveURL(/\/questionnaire$/);
  expect(thrown).toEqual([]);
});

/**
 * Membership — the sheet, its arithmetic, and a redeem.
 *
 * Worth a walk rather than a unit test alone because the two things most
 * likely to break are both integration: the six-month discount has to reach
 * the rendered card, and the plan has to be LABELLED from `GET /api/options/`
 * rather than the old app's basic/premium mapping, which would print "Basic
 * Access" for a VIP (`tiers.ts`). The standing membership is the server's
 * (`GET /api/auth/my-membership/`, G-MEMB-3/6/7): the stub answers an active
 * VIP until 2027-03-12.
 */
test('the membership row and sheet read my-membership, price both terms, and redeem', async () => {
  thrown = [];
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  // app.html:9925-9926 — the plan sub-line and the green pill
  const row = page.getByRole('button', { name: /Membership/ });
  await expect(row).toContainText(/VIP · active until /);
  await expect(row.locator('.mb-pill.on')).toHaveText('ACTIVE');

  await row.click();
  await expect(page.locator('.mb-h')).toHaveText('Your membership');
  await expect(page.locator('.mb-active-lab')).toHaveText('Active membership');
  await expect(page.locator('.mb-active-plan')).toHaveText('VIP');
  await expect(page.locator('.mb-active-plan')).not.toHaveText(/Basic Access/);
  await expect(page.locator('.mb-active-sub')).toContainText('Active until');
  await expect(page.locator('.mb-redeem-t')).toHaveText('Enter a new access code');
  await expect(page.locator('.mb-tier').first()).toContainText('5,000,000 Toman / month');

  await page.getByRole('button', { name: '6 months · save 10%' }).click();
  // 5,000,000 x 6 x 0.9, and the premium tier rounded to a whole million.
  await expect(page.locator('.mb-tier').first()).toContainText('27,000,000 Toman / 6 months');
  await expect(page.locator('.mb-tier').last()).toContainText('49,000,000 Toman / 6 months');

  const reread = page.waitForRequest((r) => r.url().endsWith('/api/auth/my-membership/'));
  await page.fill('.mb-code', 'dz-p-abc123');
  await page.getByRole('button', { name: 'Activate' }).click();
  await reread;
  // `Lib.toast('✓ '+plan+' activated')` (:10355), labelled from the options map
  await expect(page.locator('.toast.show')).toHaveText('✓ VIP activated');

  expect(thrown, 'page errors in the membership sheet').toEqual([]);
});

test('a collector with no membership sees the plans and the default row', async () => {
  thrown = [];
  await page.route('**/api/auth/my-membership/', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { tier: null, status: 'invited', active_until: null },
        message: '',
        timestamp: '',
      }),
    }),
  );
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  const row = page.getByRole('button', { name: /Membership/ });
  await expect(row).toContainText('View plans and your access to the private room');
  await expect(row.locator('.mb-pill')).toHaveCount(0);
  await row.click();
  await expect(page.locator('.mb-h')).toHaveText('Choose your access');
  await expect(page.locator('.mb-active')).toHaveCount(0);
  await page.unroute('**/api/auth/my-membership/');
  expect(thrown).toEqual([]);
});

/**
 * Profile › Account — the editable card (`profAccountHTML`, app.html:9765),
 * saved through `PATCH /api/auth/me/` (G-B1). A text field saves when it is
 * left, the language the moment it is picked; each PATCH carries only what
 * changed.
 */
test('profile account edits round-trip through PATCH /auth/me/', async () => {
  thrown = [];
  await page.goto('/profile?tab=account');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.pf-grp').first()).toHaveText('Account details');
  await expect(page.locator('#pf-full_name')).toHaveValue('E2E Collector');
  await expect(page.locator('#pf-city')).toHaveValue('Tehran');
  // the old note is gone: the card is editable now
  await expect(page.getByText('write to Darz in Chat')).toHaveCount(0);

  const cityPatch = page.waitForRequest(
    (r) => r.method() === 'PATCH' && r.url().endsWith('/api/auth/me/'),
  );
  await page.fill('#pf-city', 'Isfahan');
  await page.locator('#pf-city').blur();
  expect((await cityPatch).postDataJSON()).toEqual({ city: 'Isfahan' });
  await expect(page.locator('.toast.show')).toHaveText('Saved');
  await expect(page.locator('#pf-city')).toHaveValue('Isfahan');

  const langPatch = page.waitForRequest(
    (r) => r.method() === 'PATCH' && r.url().endsWith('/api/auth/me/'),
  );
  await page.getByRole('button', { name: 'Preferred communication language' }).click();
  await page.getByRole('option', { name: 'Farsi' }).click();
  expect((await langPatch).postDataJSON()).toEqual({ preferred_language: 'fa' });

  // leaving a field unchanged sends nothing
  let extra = 0;
  const count = (r: { method: () => string }) => r.method() === 'PATCH' && extra++;
  page.on('request', count);
  await page.locator('#pf-full_name').focus();
  await page.locator('#pf-full_name').blur();
  await page.waitForLoadState('networkidle');
  page.off('request', count);
  expect(extra).toBe(0);

  expect(thrown).toEqual([]);
});

test('a rejected profile field shows the server’s message under that field', async () => {
  thrown = [];
  await page.route('**/api/auth/me/', (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input.',
              details: { phone: ['Ensure this field has no more than 50 characters.'] },
            },
            timestamp: '',
          }),
        })
      : route.fallback(),
  );
  await page.goto('/profile?tab=account');
  await page.waitForLoadState('networkidle');
  await page.fill('#pf-phone', '9'.repeat(60));
  await page.locator('#pf-phone').blur();
  await expect(page.locator('#pf-phone')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.dz-field-err')).toHaveText(
    'Ensure this field has no more than 50 characters.',
  );
  await page.unroute('**/api/auth/me/');
  expect(thrown).toEqual([]);
});

/**
 * G-DOC-1 — "Your documents" (`dzDocsSectionHTML`, app.html:7909), from
 * `GET /api/documents/`: collapsed, counted, each row "New" until it is opened
 * on this device (`darz_docs_seen`).
 */
test('your documents list renders from /api/documents/ and marks an opened one seen', async () => {
  thrown = [];
  await page.evaluate(() => localStorage.removeItem('darz_docs_seen'));
  await page.goto('/profile?tab=account');
  await page.waitForLoadState('networkidle');

  const docs = page.locator('details.pf-docs');
  await expect(docs).toBeVisible();
  await expect(docs.locator('summary')).toContainText('Your documents');
  await expect(docs.locator('summary')).toContainText('Invoices, certificates & provenance');
  await expect(docs.locator('.pf-docs-n')).toHaveText('2');
  await expect(docs.locator('.pf-docs-dot')).toHaveCount(1);

  await docs.locator('summary').click();
  const rows = docs.locator('.pf-doc');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('.l')).toHaveText('Invoice');
  await expect(rows.nth(1).locator('.l')).toHaveText('Certificate');
  await expect(rows.nth(0)).toContainText('Parviz Tanavoli — Heech');
  await expect(docs.locator('.pf-doc-new')).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute('href', /inv-0001\.pdf$/);

  const popup = page.waitForEvent('popup');
  await rows.nth(0).click();
  await (await popup).close();
  await expect(rows.nth(0).locator('.pf-doc-view')).toContainText('View');
  await expect(docs.locator('.pf-doc-new')).toHaveCount(1);
  expect(thrown).toEqual([]);
});

test('no documents, no section — the old app hid it', async () => {
  thrown = [];
  await page.route(/\/api\/documents\/(\?.*)?$/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          pagination: {
            page: 1,
            per_page: 100,
            total_pages: 1,
            total_count: 0,
            has_next: false,
            has_previous: false,
          },
          results: [],
        },
        message: '',
        timestamp: '',
      }),
    }),
  );
  await page.goto('/profile?tab=account');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#pf-full_name')).toBeVisible();
  await expect(page.locator('details.pf-docs')).toHaveCount(0);
  await page.unroute(/\/api\/documents\/(\?.*)?$/);
  expect(thrown).toEqual([]);
});

test('settings: edit profile leads to the editable card; terms resolve to the published document', async () => {
  thrown = [];
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  // the stub publishes `legal_terms` only; privacy keeps its fallback
  await expect(page.getByRole('link', { name: /Terms & Conditions/ })).toHaveAttribute(
    'href',
    /legal_terms\.pdf$/,
  );
  await expect(page.getByRole('link', { name: /Privacy Policy/ })).toHaveAttribute(
    'href',
    'https://darzmarket.art/privacy',
  );
  await page.getByRole('link', { name: /Edit profile/ }).click();
  await expect(page).toHaveURL(/\/profile\?tab=account$/);
  await expect(page.locator('#pf-full_name')).toBeVisible();
  expect(thrown).toEqual([]);
});

/** G-P24-1 — the chip carries the selection's name. */
test('the curated chip shows the selection name', async () => {
  thrown = [];
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.dz-curchip .dz-curl')).toHaveText('Autumn Selection');
  await expect(page.locator('.dz-curchip .dz-curn')).toHaveText('1');
  expect(thrown).toEqual([]);
});

/** Q-6 — no "Make an offer" on a work without a currency. */
test('make an offer is hidden on a work with no currency', async () => {
  thrown = [];
  await page.goto('/artwork/00000000-0000-4000-8000-00000000a101');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: 'Make an offer' })).toBeVisible();

  await page.goto('/artwork/00000000-0000-4000-8000-00000000a104');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: '48h hold' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make an offer' })).toHaveCount(0);
  expect(thrown).toEqual([]);
});

/**
 * i18n ships OFF. This is the regression test for that, not for translation.
 *
 * The engine is a faithful port of the old app's, and the old app ships
 * English-only (`showLangSetting: 'Hidden'`, `theme.i18n: {}`, and its own
 * comment at app.html:9944). The risk in having an engine at all is that it
 * quietly turns itself on — through a stale `?lang=`, a remembered device
 * choice, or a default that drifts. All three are covered here.
 */
test('the app is English-only until the owner enables a language', async () => {
  thrown = [];
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(await page.getAttribute('html', 'lang')).toBe('en');
  expect(await page.getAttribute('html', 'dir')).toBe('ltr');
  await expect(page.locator('#nav .lb').first()).toHaveText('Market');

  // A link asking for a language the owner never enabled is ignored — it must
  // not strand someone in a language that was withdrawn.
  await page.goto('/?lang=fa');
  await page.waitForLoadState('networkidle');
  expect(await page.getAttribute('html', 'lang')).toBe('en');
  await expect(page.locator('#nav .lb').first()).toHaveText('Market');

  // Nor may a remembered choice resurrect one.
  await page.evaluate(() => localStorage.setItem('darz_lang', 'ar'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(await page.getAttribute('html', 'lang')).toBe('en');
  expect(await page.getAttribute('html', 'dir')).toBe('ltr');
  await page.evaluate(() => localStorage.removeItem('darz_lang'));

  expect(thrown).toEqual([]);
});

/**
 * G-P5-2 — a request row carries its work nested (`{id, title, artist, image}`),
 * so the Chat list names each inquiry without a second catalogue read. Before
 * the adoption, every row resolved a bare uuid through `ArtworkCache`.
 */
test('chat names each inquiry from the row itself, with no catalogue read', async () => {
  thrown = [];
  const catalogueReads: string[] = [];
  const onRequest = (req: { url: () => string }) => {
    if (req.url().includes('/api/catalog/')) catalogueReads.push(req.url());
  };
  page.on('request', onRequest);
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');
  page.off('request', onRequest);

  await expect(page.locator('.actli-t').first()).toHaveText('Parviz Tanavoli — Heech');
  expect(catalogueReads, 'catalogue reads from the chat list').toEqual([]);
  expect(thrown).toEqual([]);
});

/** G-P5-3 — a cold deep link to a thread reads that one request
 * (`GET /api/crm/requests/{id}/`) instead of waiting on the whole list. */
test('a deep link to a thread reads its own request and renders it', async () => {
  thrown = [];
  const OFFER = '00000000-0000-4000-8000-00000000c102';
  const direct = page.waitForRequest((r) => r.url().endsWith(`/api/crm/requests/${OFFER}/`));
  await page.goto(`/chat/${OFFER}`);
  await direct;
  await expect(page.getByRole('heading', { name: 'Offer made' })).toBeVisible();
  await expect(page.locator('.actsh-artt')).toHaveText('Parviz Tanavoli — Poet and Bird');
  expect(thrown).toEqual([]);
});
