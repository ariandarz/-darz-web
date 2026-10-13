/**
 * V1 Phase 5 — the gallery portal BEYOND the gate.
 *
 * `collector.spec.ts` only ever proved `/portal/:token` draws its gate. The
 * stub now serves a whole portal (`e2e/stub-server.mjs`, the Aria link:
 * token `e2e-portal`, PIN `246810`), so this walks it: in with the PIN, the
 * works with their images, a per-work ask and withdraw sent with the right
 * `kind`, a replacement photo sent as multipart with the PIN as a FORM PART
 * (C-9 — never the query), History reading the server's own updates across a
 * reload, and a pricelist built in the portal. Then the post-V1 G-PORT
 * surfaces (backend 2026-10-01): the per-work actions / minimum-offer proposal
 * (G-PORT-8), the Introduce tab (G-PORT-5) and the drawn signature (G-PORT-7).
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
const ART3 = '00000000-0000-4000-8000-000000007a03';
const PEX = '00000000-0000-4000-8000-000000005e11'; // the published show (G-PORT-7)
const DOC_INVOICE = '00000000-0000-4000-8000-00000000de12';

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

test('What collectors can do: Save posts the block to …/actions/ — none ticked is viewing (G-PORT-8)', async () => {
  thrown = [];
  await page.locator('.portnav').getByRole('button', { name: 'Your works' }).click();
  const card = page.locator('.awc', { hasText: 'Heech Lovers' });
  await card.getByRole('button', { name: /Add a price change or note/ }).click();
  const block = card.locator('.offblk');
  // the old "Private …" line again, and the work's own currency, fixed
  await expect(block.locator('.offlock')).toContainText(
    'A lower offer is automatically declined with a note to offer more.',
  );
  await expect(block.getByLabel('Offer currency')).toBeDisabled();
  await expect(block.getByLabel('Minimum offer')).toHaveAttribute('placeholder', 'e.g. 10,000');
  // untouched, the grid is the backend's default-open "all four"
  const boxes = block.locator('.offact input');
  await expect(boxes).toHaveCount(4);
  for (let i = 0; i < 4; i++) await boxes.nth(i).uncheck();
  await block.getByLabel('Minimum offer').fill('9,500');
  const [req] = await Promise.all([
    page.waitForRequest(isPost(`/artworks/${ART1}/actions/`)),
    block.getByRole('button', { name: 'Save' }).click(),
  ]);
  // [] would mean ALL FOUR once applied — an empty grid sends viewing only
  expect(req.postDataJSON()).toEqual({
    pin: PIN,
    allowed_actions: ['viewing'],
    offer_floor: '9500',
  });
  expect(new URL(req.url()).searchParams.get('pin')).toBeNull();
  await expect(page.locator('.toast.show')).toHaveText('Offer settings sent to Darz for review.');
  // after the re-read the block prefills from the pending proposal
  await expect(card.locator('.pill.pending')).toContainText('Sent');
  await expect(block.getByLabel('Request a viewing')).toBeChecked();
  await expect(block.getByLabel('Buy')).not.toBeChecked();
  await expect(block.getByLabel('Minimum offer')).toHaveValue('9,500');
  expect(thrown).toEqual([]);
});

test('a ticked box rides Send update to its own endpoint — no stray update (G-PORT-8)', async () => {
  const card = page.locator('.awc', { hasText: 'Behjat Sadr' });
  await card.getByRole('button', { name: /Add a price change or note/ }).click();
  await card.locator('.offblk').getByLabel('Make an offer').uncheck();
  const posts: string[] = [];
  const onReq = (r: Request) => {
    if (r.method() === 'POST') posts.push(new URL(r.url()).pathname);
  };
  page.on('request', onReq);
  try {
    const [req] = await Promise.all([
      page.waitForRequest(isPost(`/artworks/${ART3}/actions/`)),
      card.getByRole('button', { name: 'Send update' }).click(),
    ]);
    expect(req.postDataJSON()).toEqual({
      pin: PIN,
      allowed_actions: ['purchase', 'hold', 'viewing'],
    });
    await expect(page.locator('.toast.show')).toHaveText('Update sent to Darz.');
  } finally {
    page.off('request', onReq);
  }
  // only the offer block was touched, so no availability update went with it
  expect(posts.filter((p) => p.endsWith('/updates/'))).toEqual([]);
});

test('Introduce: a lead needs a name, goes to …/referrals/, and tops the list (G-PORT-5)', async () => {
  thrown = [];
  await page.locator('.portnav').getByRole('button', { name: 'Introduce' }).click();
  // the seeded introduction, with the status the desk gave it
  const seeded = page.locator('.pl-card', { hasText: 'Maryam Rahimi' });
  await expect(seeded.locator('.pl-status')).toHaveText('Reviewed');

  await page.getByRole('button', { name: 'Send to Darz' }).click();
  await expect(page.locator('.toast.show')).toHaveText(
    'Please enter the name of the person you are introducing.',
  );

  await page.getByLabel('Introducing').selectOption('gallery');
  await page.getByLabel('Name *').fill('Negin Farahani');
  await page.getByLabel('Organisation').fill('Farahani Projects');
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('button', { name: 'Send to Darz' }).click();
  // a field the server refuses says why
  await expect(page.locator('.toast.show')).toHaveText('Enter a valid email address.');

  await page.getByLabel('Email').fill('negin@farahani.invalid');
  const [req] = await Promise.all([
    page.waitForRequest(isPost('/referrals/')),
    page.getByRole('button', { name: 'Send to Darz' }).click(),
  ]);
  expect(req.postDataJSON()).toMatchObject({
    pin: PIN,
    referred_kind: 'gallery',
    referred_name: 'Negin Farahani',
    referred_org: 'Farahani Projects',
    referred_email: 'negin@farahani.invalid',
  });
  await expect(page.locator('.toast.show')).toHaveText('Sent to Darz.');
  const first = page.locator('.pl-card').first();
  await expect(first.locator('.pl-name')).toHaveText('Negin Farahani');
  await expect(first.locator('.pl-meta').first()).toContainText('Gallery · Farahani Projects');
  await expect(first.locator('.pl-status')).toHaveText('New');
  // the form cleared for the next one; a referral is not a pending update
  await expect(page.getByLabel('Name *')).toHaveValue('');
  expect(thrown).toEqual([]);
});

test('Exhibitions: an invoice is signed on the pad — typed name + drawn PNG — and the row shows the mark (G-PORT-7)', async () => {
  thrown = [];
  await page.locator('.portnav').getByRole('button', { name: 'Exhibitions' }).click();
  await page.locator('.exh-showcard', { hasText: 'Spring Salon' }).click();
  const invoice = page.locator('.doc-row', { hasText: 'Spring Salon — Invoice' });
  await expect(invoice.locator('.doc-state')).toHaveText('Awaiting your signature.');

  // a proposal opens the pad with the old confirm dialog's words; Cancel sends nothing
  const proposal = page.locator('.doc-row', { hasText: 'Spring Salon — Proposal' });
  await proposal.getByRole('button', { name: 'Confirm & request invoice' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm this proposal' })).toContainText(
    'Ref DARZ-PRO-2026-0007. Darz will prepare the invoice and send it here for you to sign.',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await invoice.getByRole('button', { name: 'Sign & confirm' }).click();
  const pad = page.getByRole('dialog', { name: 'Sign the invoice' });
  await expect(pad.locator('.sp-sub')).toContainText('Ref DARZ-INV-2026-0007.');
  // the old refusals, in order: draw first, then the name
  await pad.getByRole('button', { name: 'Sign & confirm invoice' }).click();
  await expect(page.locator('.toast.show')).toHaveText('Please sign in the box first.');
  const box = (await pad.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 120);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(box.x + 30 + i * 22, box.y + 120 - Math.sin(i / 2) * 40);
  await page.mouse.up();
  await pad.getByRole('button', { name: 'Sign & confirm invoice' }).click();
  await expect(page.locator('.toast.show')).toHaveText('Add the name of the person signing.');
  await pad.getByLabel('Name of the person signing').fill('Sara Ahmadi');
  const [req] = await Promise.all([
    page.waitForRequest(isPost(`/exhibitions/${PEX}/documents/${DOC_INVOICE}/sign/`)),
    pad.getByRole('button', { name: 'Sign & confirm invoice' }).click(),
  ]);
  const body = req.postDataJSON();
  expect(body).toMatchObject({ pin: PIN, signer_name: 'Sara Ahmadi' });
  expect(body.signature_image).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);
  await expect(page.locator('.toast.show')).toHaveText(
    'Signed — thank you. Darz has been notified.',
  );
  await expect(pad).toHaveCount(0);
  await expect(invoice.locator('.doc-state')).toHaveText('Signed — nothing more needed.');
  await expect(invoice.locator('img.doc-sig')).toHaveAttribute('src', /^data:image\/png;base64,/);
  // the signer is remembered as "Your name" (old :2054) — it was empty
  await expect(page.locator('#gp-staff')).toHaveValue('Sara Ahmadi');
  const seen = await page.request.get('http://127.0.0.1:8787/__stub/portal/last-sign/');
  expect((await seen.json()).data).toMatchObject({
    signer_name: 'Sara Ahmadi',
    image: 'data:image/png;base64,',
  });
  expect(thrown).toEqual([]);
});
