/**
 * G-TEAM-1 — the Team desk's Executive Workspace against the stub
 * (`workspacePatterns` in `stub-server.mjs`).
 *
 * What it pins, beyond "the desk renders" (that is `desks.spec.ts`):
 *  - every inline edit carries the row's lock (`expected_version`), and a 409
 *    raises the ConflictBanner, not a plain error;
 *  - the checkbox goes through `toggle/`, `+15m` APPENDS `{minutes: 15}`;
 *  - approving a pricelist is the GALLERY route, and Reject stays disabled;
 *  - the gating: a standard admin gets Team workflow + approvals only, and a
 *    typed owner tab answers with the refusal card.
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

let page: Page;
let thrown: string[] = [];

async function signIn(p: Page, email: string) {
  await p.goto('/admin/login');
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', 'anything');
  await p.locator('form button[type="submit"]').click();
  await p.waitForURL('**/admin');
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on('pageerror', (e) => thrown.push(e.message.split('\n')[0]));
  await signIn(page, 'e2e@example.invalid');
});

test.afterAll(async () => {
  await page?.close();
});

const conflict409 = {
  status: 409,
  contentType: 'application/json',
  body: JSON.stringify({
    success: false,
    error: { code: 'CONFLICT', message: 'This record was modified by someone else.' },
    timestamp: new Date().toISOString(),
  }),
};

test('the owner sees all four tabs and the six My-workspace tiles', async () => {
  thrown = [];
  await page.goto('/admin/team');
  await expect(page.getByRole('heading', { name: 'My workspace' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveText([
    'My workspace',
    // badged with the pending count — other specs (the portal's) add to it
    /^Team\d+$/,
    'Contacts',
    'Logins',
  ]);
  for (const tile of ['Open tasks', 'Follow-ups', 'Overdue', 'Completed', 'Notes', 'Ideas']) {
    await expect(page.locator('.ws-stat-l', { hasText: tile })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Quick add' })).toBeVisible();
  // "no backend" is gone for good
  await expect(page.getByText('has no backend')).toHaveCount(0);
  expect(thrown).toEqual([]);
});

test('an inline title edit is a locked PATCH; the checkbox goes through toggle/', async () => {
  thrown = [];
  await page.goto('/admin/team?tab=me');
  const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/workspace/items/') && r.method() !== 'GET')
      sent.push({ url: r.url(), body: r.postDataJSON() });
  });

  const title = page.getByRole('textbox', { name: 'Title' }).first();
  await expect(title).toHaveValue('Send the autumn invoice batch');
  await title.fill('Send the autumn invoices');
  await title.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Title' }).first()).toHaveValue(
    'Send the autumn invoices',
  );
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].url).toMatch(/\/items\/[^/]+\/$/);
  expect(sent[0].body).toEqual({ title: 'Send the autumn invoices', expected_version: 1 });

  // the second edit on the SAME row carries the version the first one answered
  await page.getByRole('button', { name: 'Mark done' }).first().click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1].url).toMatch(/\/items\/[^/]+\/toggle\/$/);
  expect(sent[1].body).toEqual({ done: true, expected_version: 2 });
  expect(thrown).toEqual([]);
});

test('a stale save shows the conflict banner, and Reload clears it', async () => {
  thrown = [];
  await page.goto('/admin/team?tab=me');
  const url = '**/api/workspace/items/*/';
  await page.route(url, (route) =>
    route.request().method() === 'PATCH' ? route.fulfill(conflict409) : route.fallback(),
  );
  try {
    const note = page.getByRole('textbox', { name: 'Note' }).first();
    await note.fill('someone else got there first');
    await note.press('Enter');
    await expect(
      page.getByText('Someone else saved this item in the meantime — reload to continue.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Reload' }).click();
    await expect(page.getByText('Someone else saved this item in the meantime')).toHaveCount(
      0,
    );
  } finally {
    await page.unroute(url);
  }
  expect(thrown).toEqual([]);
});

test('Team: +15m appends a time log, and the row shows the server total', async () => {
  thrown = [];
  await page.goto('/admin/team?tab=team');
  await expect(
    page.getByRole('heading', { name: 'Team workflow & performance' }),
  ).toBeVisible();
  const row = page.locator('.ws-item', {
    has: page.locator('input[value="Photograph the new consignments"]'),
  });
  await expect(row.locator('.ws-time-n')).toHaveText('45m');
  const [post] = await Promise.all([
    page.waitForRequest((r) => r.url().includes('/log-time/') && r.method() === 'POST'),
    row.getByRole('button', { name: '+15m' }).click(),
  ]);
  expect(post.postDataJSON()).toEqual({ minutes: 15 });
  await expect(row.locator('.ws-time-n')).toHaveText('1h');
  // both tables come from performance/
  await expect(page.getByRole('table', { name: 'Performance by person' })).toContainText(
    'Unassigned',
  );
  await expect(page.getByRole('table', { name: 'Admin behaviour' })).toContainText(
    'E2E Owner',
  );
  expect(thrown).toEqual([]);
});

test('Approve goes through the gallery status route; Reject is disabled with its reason', async () => {
  thrown = [];
  await page.goto('/admin/team?tab=team');
  const box = page.locator('.ws-pa');
  await expect(box).toContainText(/\d+ waiting/);
  // the stub's own submitted list; the portal spec may have sent another
  const row = box.locator('.ws-pa-row', { hasText: 'From Golestan' });
  await expect(row).toBeVisible();
  const reject = row.getByRole('button', { name: 'Reject' });
  await expect(reject).toBeDisabled();
  await expect(reject).toHaveAttribute('title', /no “rejected” state/);

  // answered here so the shared stub's pricelist stays `submitted` for others
  const url = '**/api/gallery/admin/pricelists/*/status/';
  const sent: unknown[] = [];
  await page.route(url, (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {}, message: '', timestamp: '' }),
    });
  });
  try {
    await row.getByRole('button', { name: 'Approve' }).click();
    await expect(page.locator('.dz-toast')).toContainText(
      'Pricelist approved — they can print now',
    );
    expect(sent).toEqual([{ status: 'accepted' }]);
  } finally {
    await page.unroute(url);
  }
  expect(thrown).toEqual([]);
});

test('Contacts: served order, the optional collector link, and adding one', async () => {
  thrown = [];
  await page.goto('/admin/team?tab=contacts');
  await expect(page.getByRole('heading', { name: 'Contacts & follow-ups' })).toBeVisible();
  const names = page.getByRole('textbox', { name: 'Name', exact: true });
  await expect(names.first()).toHaveValue('Leila Karimi'); // high priority first
  const link = page.getByRole('link', { name: 'Leila K.' });
  await expect(link).toHaveAttribute(
    'href',
    '/admin/collectors/00000000-0000-4000-8000-0000000000c1',
  );
  // a contact without a link shows no link line
  await expect(page.locator('.ws-c-link')).toHaveCount(1);

  await page.getByRole('textbox', { name: 'New contact name' }).fill('Omid Tehrani');
  await page.getByRole('textbox', { name: 'New contact company' }).fill('Auction house');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(names).toHaveCount(4);
  await expect(page.locator('.ws-stat-n').first()).toHaveText('4');
  expect(thrown).toEqual([]);
});

test('Quick add saves an idea into My workspace', async () => {
  thrown = [];
  await page.goto('/admin/team?tab=me');
  await page.getByRole('button', { name: 'Quick add' }).click();
  const panel = page.getByRole('dialog', { name: 'Quick add' });
  await panel.getByRole('button', { name: 'Idea' }).click();
  await panel.getByRole('textbox', { name: 'Title' }).fill('Ask Leila about the salon');
  await panel.getByRole('button', { name: 'Add idea' }).click();
  await expect(page.locator('.dz-toast')).toContainText('Added to your workspace');
  await expect(
    page
      .getByRole('textbox', { name: 'Title' })
      .and(page.locator('[value="Ask Leila about the salon"]')),
  ).toHaveCount(1);
  expect(thrown).toEqual([]);
});

test('a standard admin gets Team workflow + approvals only', async ({ browser }) => {
  const std = await browser.newPage();
  const errors: string[] = [];
  std.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  try {
    await signIn(std, 'standard@example.invalid');
    // reachable from the nav: the gold Owner group with Team alone in it
    await std.getByRole('link', { name: 'Owner' }).click();
    await expect(std).toHaveURL(/\/admin\/team$/);
    await expect(
      std.getByRole('heading', { name: 'Team workflow & performance' }),
    ).toBeVisible();
    await expect(std.getByRole('tab')).toHaveText([/^Team\d+$/]);
    await expect(std.locator('.ws-pa')).toContainText('Pricelist approvals');
    await expect(std.getByRole('button', { name: 'Quick add' })).toHaveCount(0);

    // a typed owner tab: the old refusal card, and no owner-only read made
    const ownerReads: string[] = [];
    std.on('request', (r) => {
      if (/\/api\/workspace\/(items|contacts)\//.test(r.url())) ownerReads.push(r.url());
    });
    for (const [tab, heading] of [
      ['me', 'My workspace'],
      ['contacts', 'Contacts & follow-ups'],
      ['logins', 'Team logins'],
    ]) {
      await std.goto(`/admin/team?tab=${tab}`);
      await expect(std.getByRole('heading', { name: heading })).toBeVisible();
      await expect(
        std.getByText('This area is private to the owner’s login only.'),
      ).toBeVisible();
    }
    expect(ownerReads).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await std.close();
  }
});
