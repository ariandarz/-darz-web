/**
 * V1 Phase 5 — the gallery portal BEYOND the gate.
 *
 * `collector.spec.ts` only ever proved `/portal/:token` draws its gate. The
 * stub now serves a whole portal (`e2e/stub-server.mjs`, the Aria link:
 * token `e2e-portal`, PIN `246810`), so this walks it: in with the PIN, the
 * works with their images, a per-work ask and withdraw sent with the right
 * `kind`, a replacement photo sent as multipart with the PIN as a FORM PART
 * (C-9 — never the query), History reading the server's own updates across a
 * reload, and a pricelist built in the portal.
 *
 * Serial on one page. Only this file drives the Aria link (the desk walk uses
 * its own), so the stub's state is this file's to change.
 */
import { expect, test, type Page, type Request } from '@playwright/test';

const TOKEN = 'e2e-portal';
const PIN = '246810';
const WORK1 = '00000000-0000-4000-8000-000000006a01'; // the assignment row (card ids)
const ART1 = '00000000-0000-4000-8000-000000007a01'; // its artwork
const ART2 = '00000000-0000-4000-8000-000000007a02';

test.describe.configure({ mode: 'serial' });

let page: Page;
let thrown: string[] = [];

async function enter() {
  await page.goto(`/portal/${TOKEN}`);
  for (let i = 0; i < PIN.length; i++)
    await page.getByLabel(`Access code digit ${i + 1}`).fill(PIN[i]);
  await expect(page.getByRole('heading', { name: 'Aria Gallery' })).toBeVisible({
    timeout: 15_000,
  });
}

const isPost = (path: string) => (r: Request) =>
  r.method() === 'POST' && new URL(r.url()).pathname === `/api/gallery/portal/${TOKEN}${path}`;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on('pageerror', (e) => thrown.push(e.message.split('\n')[0]));
});

test.afterAll(async () => {
  await page?.close();
});

test('the PIN opens the portal: works show their images, the header its cover (G-PORT-1/9)', async () => {
  thrown = [];
  await enter();
  // the cover is the first work with an image, captioned with that work
  await expect(page.locator('.top-cover img')).toHaveAttribute('src', /thumb-4\.svg/);
  await expect(page.locator('.top-cover-cap')).toHaveText('Parviz Tanavoli — Heech Lovers');
  // two works carry an image, the third the old no-image state
  await expect(page.locator('.awc-img[style*="thumb-"]')).toHaveCount(2);
  await expect(page.locator('.awc-img .noimg')).toHaveCount(1);
  // the server's own pending price update: the card's Sent pill + the fourth tile
  const pending = page.locator('.kpi', { hasText: 'Pending review' });
  await expect(pending.locator('.n')).toHaveText('1');
  await expect(
    page.locator('.awc', { hasText: 'Mirror Mosaic' }).locator('.pill.pending'),
  ).toContainText('Sent');
  expect(thrown).toEqual([]);
});

test('Ask sends kind=ask for the work, with the PIN in the JSON body (G-PORT-4)', async () => {
  const card = page.locator('.awc', { hasText: 'Heech Lovers' });
  await card.getByRole('button', { name: /Add a price change or note/ }).click();
  await card.getByLabel('Ask Darz about this work').fill('Is the frame included?');
  const [req] = await Promise.all([
    page.waitForRequest(isPost('/updates/')),
    card.locator('.msg-box').getByRole('button', { name: 'Send' }).click(),
  ]);
  const body = req.postDataJSON();
  expect(body).toMatchObject({
    pin: PIN,
    kind: 'ask',
    artwork: ART1,
    payload: { question: 'Is the frame included?', title: 'Heech Lovers' },
  });
  expect(new URL(req.url()).searchParams.get('pin')).toBeNull();
  await expect(page.locator('.toast.show')).toHaveText('Sent to Darz.');
});

test('Remove from portal confirms, then sends kind=withdraw (G-PORT-6)', async () => {
  const card = page.locator('.awc', { hasText: 'Mirror Mosaic' });
  let confirmText = '';
  page.once('dialog', (d) => {
    confirmText = d.message();
    void d.accept();
  });
  const [req] = await Promise.all([
    page.waitForRequest(isPost('/updates/')),
    card.getByRole('button', { name: 'Remove from portal' }).click(),
  ]);
  expect(confirmText).toContain('Darz reviews the request first');
  expect(req.postDataJSON()).toMatchObject({ pin: PIN, kind: 'withdraw', artwork: ART2 });
  await expect(page.locator('.toast.show')).toHaveText('Removal request sent to Darz.');
});

test('a replacement photo goes as multipart with the PIN as a form part (G-PORT-1, C-9)', async () => {
  const card = page.locator('.awc', { hasText: 'Heech Lovers' });
  // the dropzone's own input (old `rimg_<id>`), fed a small PNG
  await page.locator(`#rimg_${WORK1}`).setInputFiles({
    name: 'new-photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
  await expect(card.locator('.rimg-badge')).toHaveText('New photo');
  await expect(card.getByRole('button', { name: 'Send update' })).toBeVisible();
  const [req] = await Promise.all([
    page.waitForRequest(isPost(`/artworks/${ART1}/image/`)),
    card.getByRole('button', { name: 'Send update' }).click(),
  ]);
  expect(req.headers()['content-type']).toMatch(/^multipart\/form-data/);
  expect(new URL(req.url()).searchParams.get('pin')).toBeNull();
  // Chromium does not expose a multipart body with a file to `postData()`,
  // so the stub reports what the form it received carried
  const seen = await page.request.get('http://127.0.0.1:8787/__stub/portal/last-image/');
  expect((await seen.json()).data).toEqual({ pin: PIN, queryPin: null, file: true });
  await expect(page.locator('.toast.show')).toHaveText('Update sent to Darz.');
});

test('History lists the server’s own updates, and they survive a reload (G-PORT-2)', async () => {
  // a reload drops the tab's state entirely — what shows now is the server's
  await page.reload();
  await enter();
  // the three sends above + the seeded pending price
  await expect(page.locator('.kpi', { hasText: 'Pending review' }).locator('.n')).toHaveText(
    '4',
  );
  await page.locator('.portnav').getByRole('button', { name: 'History' }).click();
  await expect(page.locator('.exh-h', { hasText: 'History' })).toBeVisible();
  const items = page.locator('.hs-item');
  await expect(items).toHaveCount(5);
  // newest first: the photo, the withdraw, the ask
  await expect(items.nth(0).locator('.hs-k')).toHaveText('Image');
  await expect(items.nth(1).locator('.hs-k')).toHaveText('Withdraw a work');
  await expect(items.nth(2).locator('.hs-n')).toHaveText('“Is the frame included?”');
  // the seeded approved row carries Darz's note in its drawer
  const approved = items.filter({ hasText: 'Approved' });
  await approved.locator('.hs-row').click();
  await expect(approved.locator('.hs-draw')).toContainText('“Thanks — noted.”');
  await expect(approved.locator('.hs-next')).toContainText('stands in the Darz catalogue');
});

test('Pricelists show their server status; one built in the portal lands as Submitted (P3a/P3b)', async () => {
  await page.locator('.portnav').getByRole('button', { name: 'Pricelists' }).click();
  const upload = page.locator('.pl-card', { hasText: 'aria-autumn.pdf' });
  await expect(upload.locator('.pl-status')).toHaveText('Accepted');
  await expect(upload.getByRole('link', { name: 'Open file ↗' })).toHaveAttribute(
    'href',
    /\/files\/pricelist\.pdf$/,
  );

  await page.getByRole('button', { name: 'Build a pricelist with the Darz template' }).click();
  // an empty builder is the old refusal, and sends nothing
  await page.getByRole('button', { name: 'Submit pricelist' }).click();
  await expect(page.locator('.toast.show')).toHaveText('Add at least one work.');

  await page.getByLabel('Work', { exact: true }).selectOption(ART1);
  await page.getByLabel('Price', { exact: true }).fill('12000');
  await page.getByLabel('Availability', { exact: true }).selectOption('available');
  await page.getByRole('button', { name: '+ Add row' }).click();
  await page.locator('#bt_1').fill('Untitled, 1974');
  const [req] = await Promise.all([
    page.waitForRequest(isPost('/pricelists/build/')),
    page.getByRole('button', { name: 'Submit pricelist' }).click(),
  ]);
  expect(req.postDataJSON()).toMatchObject({
    pin: PIN,
    lines: [
      { artwork: ART1, price: '12000', availability: 'available' },
      { artwork: null, work_title: 'Untitled, 1974', price: null },
    ],
  });
  await expect(page.locator('.toast.show')).toHaveText('Pricelist sent to Darz.');
  const built = page.locator('.pl-card', { hasText: 'Pricelist (built in portal)' });
  await expect(built.locator('.pl-status')).toHaveText('Submitted');
  await expect(built.locator('.pl-meta')).toContainText('2 works');
  expect(thrown).toEqual([]);
});
