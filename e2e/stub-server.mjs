/**
 * The E2E stub API — Phase 13's CI tier. A plain node server speaking the
 * backend's one envelope ({success, data, message, timestamp} — see
 * CLAUDE.md "API access") for exactly the routes the smoke spec walks:
 * boot (app-theme), team sign-in (login/refresh/me), options, the Dashboard
 * summary — and a catch-all EMPTY paginated list so any desk renders its
 * empty state rather than crashing. No state, no realism: the real-backend
 * behaviour is the local tier's job (`e2e/README.md`).
 */
import http from 'node:http';

const PORT = Number(process.env.STUB_PORT || 8787);

const envelope = (data) => ({
  success: true,
  data,
  message: '',
  timestamp: new Date().toISOString(),
});

const paginatedEmpty = envelope({
  pagination: {
    page: 1,
    per_page: 25,
    total_pages: 1,
    total_count: 0,
    has_next: false,
    has_previous: false,
  },
  results: [],
});

const ME_COLLECTOR = {
  principal: 'collector',
  id: '00000000-0000-4000-8000-0000000000c0',
  display_name: 'E2E Collector',
  // The collector's own contact fields (G-B1) — `_collector_me_payload` sends
  // them, and the Profile › Account card is seeded from them. No `email`: the
  // backend does not return one for a collector.
  full_name: 'E2E Collector',
  phone: '0912 000 0000',
  city: 'Tehran',
  preferred_language: 'en',
  // Also `CollectorTierEnum`, for the same reason as the options key above.
  tier: 'active',
  access_status: 'active',
  preferences: {},
};

/** `PATCH /api/auth/me/` — only these four are accepted (`CollectorProfileUpdateSerializer`);
 * anything else in the body is ignored, as the real serializer ignores it. */
const ME_EDITABLE = ['full_name', 'phone', 'city', 'preferred_language'];

const ME = {
  principal: 'team',
  id: '00000000-0000-4000-8000-0000000000e2',
  email: 'e2e@example.invalid',
  name: 'E2E Owner',
  role: 'owner',
};

const OPTIONS = {
  'catalog.availability_status': [
    { value: 'available', label: 'Available' },
    { value: 'reserved', label: 'Reserved' },
    { value: 'sold', label: 'Sold' },
  ],
  'catalog.price_type': [
    { value: 'fixed', label: 'Fixed' },
    { value: 'on_request', label: 'On request' },
  ],
  'catalog.visibility': [
    { value: 'visible_all', label: 'Visible to all' },
    { value: 'selected', label: 'Selected collectors' },
    { value: 'gallery_portal', label: 'Gallery portal' },
  ],
  currency: [{ value: 'USD', label: 'US Dollar' }],
  'crm.request_kind': [{ value: 'purchase', label: 'Purchase' }],
  'crm.request_status_by_kind': { purchase: [{ value: 'new', label: 'New' }] },
  'crm.activity_kind': [{ value: 'view', label: 'View' }],
  // G-P5-10 — the viewing sheet's two labels come from here, not from the app.
  'crm.viewing_mode': [
    { value: 'in_person', label: 'In person' },
    { value: 'virtual', label: 'Virtual' },
  ],
  'crm.collector_action': [
    { value: 'purchase', label: 'Buy' },
    { value: 'hold', label: 'Hold' },
    { value: 'offer', label: 'Make an offer' },
    { value: 'viewing', label: 'Request a viewing' },
  ],
  // `CollectorTierEnum` — the real four. This said `[{standard, Standard}]`
  // until 2026-09-22, and `standard` is not in the enum at all: the stub was
  // inventing a tier. It matters because this key is also what the membership
  // sheet labels a redeemed code's `plan` from, so a stub with the wrong
  // vocabulary makes a working lookup look broken (and a broken one look fine).
  'accounts.collector_tier': [
    { value: 'vip', label: 'VIP' },
    { value: 'active', label: 'Active' },
    { value: 'new', label: 'New' },
    { value: 'institutional', label: 'Institutional' },
  ],
  'accounts.collector_access_status': [{ value: 'active', label: 'Active' }],
  'accounts.team_role': [{ value: 'owner', label: 'Owner' }],
  // The real three sales vocabularies (`apps/sales/models.py`). No
  // `sales.source`: the backend does not register one (C-14), so the desk's
  // source labels fall back to the raw value — the stub must not hide that.
  'sales.status': [
    { value: 'draft', label: 'Draft' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'invoiced', label: 'Invoiced' },
    { value: 'paid', label: 'Paid' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'archived', label: 'Archived' },
    { value: 'lost', label: 'Lost' },
  ],
  'sales.payment_status': [
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'partial', label: 'Partial' },
    { value: 'paid', label: 'Paid' },
  ],
  // The four auction vocabularies (`apps/auctions/apps.py`) — the Live
  // Auctions status filter and pills, registrations and records read them.
  'auctions.auction_status': [
    { value: 'draft', label: 'Draft' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'live', label: 'Live' },
    { value: 'closed', label: 'Closed' },
    { value: 'cancelled', label: 'Cancelled' },
  ],
  'auctions.lot_status': [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'live', label: 'Live' },
    { value: 'sold', label: 'Sold' },
    { value: 'passed', label: 'Passed' },
  ],
  'auctions.registration_status': [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ],
  'auctions.record_status': [
    { value: 'sold', label: 'Sold' },
    { value: 'unsold', label: 'Unsold' },
    { value: 'passed', label: 'Passed' },
    { value: 'withdrawn', label: 'Withdrawn' },
    { value: 'pending', label: 'Pending' },
  ],
  'sales.delivery_status': [
    { value: 'pending', label: 'Pending' },
    { value: 'in_transit', label: 'In transit' },
    { value: 'delivered', label: 'Delivered' },
  ],
};

/**
 * The collector's own requests (`GET /api/crm/requests/`), in the shape the
 * backend serves since G-P5-2: `artwork` is **nested** `{id, title, artist,
 * image}`, not a bare uuid. One of each shape a list row draws — an inquiry
 * (Chat), an offer with its decimal-string amount, a hold with its server-set
 * expiry, and the general chat (no artwork). `unread_count` stays 0 so the
 * floating reply notice never sits over another walk's screen.
 */
const WORK = (id, title) => ({
  id,
  title,
  artist: { id: '00000000-0000-4000-8000-00000000a871', display_name: 'Parviz Tanavoli' },
  image: null,
});
/** The full collector artwork behind each request row — what `ArtworkCache`
 * reads for the one surface that needs more than the nested four fields (the
 * request card's year · medium line). Without it these ids fall into the
 * paginated catch-all and the card would render an envelope as an artwork. */
const FULL_WORK = (work, year, medium) => ({
  ...work,
  artist: {
    ...work.artist,
    name_variants: [],
    bio: '',
    birth_year: 1937,
    nationality: 'Iranian',
  },
  year,
  medium,
  material: '',
  dimensions: '',
  edition: '',
  city: 'Tehran',
  price_amount: null,
  currency: 'USD',
  price_type: 'on_request',
  availability_status: 'available',
  public_description: '',
  tags: [],
  images: [],
  allowed_actions: ['purchase', 'hold', 'offer', 'viewing'],
  is_saved: false,
  saved_at: null,
  refine_tags: {},
});
const REQUEST_BASE = {
  artist: null,
  unread_count: 0,
  collector_archived: false,
  version: 1,
  updated_at: '2026-09-20T10:00:00Z',
};
const COLLECTOR_REQUESTS = [
  {
    ...REQUEST_BASE,
    id: '00000000-0000-4000-8000-00000000c101',
    kind: 'information',
    status: 'new',
    artwork: WORK('00000000-0000-4000-8000-00000000a101', 'Heech'),
    detail: { message: 'Is this still available?' },
    created_at: '2026-09-20T10:00:00Z',
  },
  {
    ...REQUEST_BASE,
    id: '00000000-0000-4000-8000-00000000c102',
    kind: 'offer',
    status: 'submitted',
    artwork: WORK('00000000-0000-4000-8000-00000000a102', 'Poet and Bird'),
    detail: {
      amount: '9500.00',
      currency: 'USD',
      counter_of: null,
      counter_amount: null,
      counter_currency: '',
    },
    created_at: '2026-09-19T10:00:00Z',
  },
  {
    ...REQUEST_BASE,
    id: '00000000-0000-4000-8000-00000000c103',
    kind: 'hold',
    status: 'active',
    artwork: WORK('00000000-0000-4000-8000-00000000a103', 'Lovers'),
    detail: { expires_at: '2099-01-01T00:00:00Z' },
    created_at: '2026-09-18T10:00:00Z',
  },
  {
    ...REQUEST_BASE,
    id: '00000000-0000-4000-8000-00000000c104',
    kind: 'message',
    status: 'new',
    artwork: null,
    detail: { message: '' },
    created_at: '2026-09-17T10:00:00Z',
  },
];

const REQUEST_WORKS = Object.fromEntries(
  COLLECTOR_REQUESTS.filter((r) => r.artwork).map((r, i) => [
    r.artwork.id,
    FULL_WORK(r.artwork, 1975 + i, ['Bronze', 'Oil on canvas', 'Ink on paper'][i]),
  ]),
);

/** A fixed-price work with **no currency** (Q-6): its detail must not offer
 * "Make an offer", because the backend 400s an offer on it. */
const NO_CURRENCY_ID = '00000000-0000-4000-8000-00000000a104';
REQUEST_WORKS[NO_CURRENCY_ID] = {
  ...FULL_WORK(WORK(NO_CURRENCY_ID, 'Untitled'), 1979, 'Bronze'),
  price_type: 'fixed',
  price_amount: '12000.00',
  currency: null,
};

/** The collector's curated works (`GET /api/catalog/artworks/selections/`):
 * one granted work carrying its selection's name (G-P24-1), which the Market
 * chip prints instead of "Curated for You". */
const SELECTIONS = [
  {
    ...REQUEST_WORKS['00000000-0000-4000-8000-00000000a101'],
    selection_name: 'Autumn Selection',
  },
];

/** The collector's shared documents (`GET /api/documents/`, G-DOC-1) —
 * `CollectorDocumentSerializer`, paginated, newest-shared first. */
const COLLECTOR_DOCUMENTS = [
  {
    id: '00000000-0000-4000-8000-00000000d0c1',
    kind: 'invoice',
    title: 'Parviz Tanavoli — Heech',
    ref: 'INV-0001',
    pdf_url: 'http://127.0.0.1:8787/files/inv-0001.pdf',
    shared_at: '2026-09-21T10:00:00Z',
    created_at: '2026-09-20T10:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-00000000d0c2',
    kind: 'certificate',
    title: 'Parviz Tanavoli — Heech',
    ref: 'COA-0001',
    pdf_url: 'http://127.0.0.1:8787/files/coa-0001.pdf',
    shared_at: '2026-09-20T10:00:00Z',
    created_at: '2026-09-20T10:00:00Z',
  },
];

/**
 * The Sales ledger (V1 Phase 2) — `SaleAdminSerializer` rows, nested refs
 * (G-SALE-3). One market deal with an OVERDUE follow-up and a note, and one
 * auction sale as the auction→Sale automation makes it: `source: auction`, a
 * `lot`, draft, commission = the buyer's premium.
 */
const SALE_MARKET_ID = '00000000-0000-4000-8000-0000000005a1';
const SALE_AUCTION_ID = '00000000-0000-4000-8000-0000000005a2';
const SALE_LOT_ID = '00000000-0000-4000-8000-0000000010f1';
const SALE_AUCTION_EVENT_ID = '00000000-0000-4000-8000-00000000ac71';
const SALE_BASE = {
  source_request: null,
  seller_source: '',
  discount_amount: null,
  fees_tax: null,
  currency: 'USD',
  confirmed_at: null,
  version: 1,
  updated_at: '2026-09-22T10:00:00Z',
};
const SALES = [
  {
    ...SALE_BASE,
    id: SALE_MARKET_ID,
    artwork: { id: '00000000-0000-4000-8000-00000000a101', title: 'Heech' },
    collector: { id: '00000000-0000-4000-8000-0000000000c1', display_name: 'Roya Ahmadi' },
    responsible: { id: ME.id, name: ME.name },
    source: 'market',
    lot: null,
    agreed_price: '42000.00',
    commission_amount: '4200.00',
    payment_status: 'unpaid',
    delivery_status: 'pending',
    status: 'confirmed',
    confirmed_at: '2026-09-18T10:00:00Z',
    follow_up_at: '2026-09-20',
    follow_up_overdue: true,
    created_at: '2026-09-15T10:00:00Z',
  },
  {
    ...SALE_BASE,
    id: SALE_AUCTION_ID,
    artwork: { id: '00000000-0000-4000-8000-00000000a102', title: 'Poet and Bird' },
    collector: { id: '00000000-0000-4000-8000-0000000000c2', display_name: 'Kaveh Shirazi' },
    responsible: null,
    source: 'auction',
    lot: SALE_LOT_ID,
    agreed_price: '12000.00',
    commission_amount: '2000.00',
    payment_status: 'unpaid',
    delivery_status: 'pending',
    status: 'draft',
    follow_up_at: null,
    follow_up_overdue: false,
    created_at: '2026-09-21T10:00:00Z',
  },
];
const SALE_NOTES = {
  [SALE_MARKET_ID]: [
    {
      id: '00000000-0000-4000-8000-0000000005b1',
      body: 'Asked for the invoice by Friday.',
      author: ME.id,
      author_name: ME.name,
      created_at: '2026-09-19T09:30:00Z',
    },
  ],
};
/** `GET …/sales/summary/` — the backend seeds every choice to 0. */
const saleSummary = () => {
  const seed = (key) => Object.fromEntries(OPTIONS[key].map((c) => [c.value, 0]));
  const out = {
    total: SALES.length,
    by_status: seed('sales.status'),
    by_payment_status: seed('sales.payment_status'),
    by_delivery_status: seed('sales.delivery_status'),
    by_source: { market: 0, auction: 0 },
  };
  for (const s of SALES) {
    out.by_status[s.status] += 1;
    out.by_payment_status[s.payment_status] += 1;
    out.by_delivery_status[s.delivery_status] += 1;
    out.by_source[s.source] += 1;
  }
  return out;
};
/** The list honours the filter set (`SaleAdminFilterSet`), so a filtered
 * walk sees the rows a real backend would. */
const saleList = (sp) => {
  let rows = SALES;
  for (const key of ['status', 'payment_status', 'delivery_status', 'source']) {
    const v = sp.get(key);
    if (v) rows = rows.filter((s) => s[key] === v);
  }
  const q = (sp.get('search') || '').toLowerCase();
  if (q) {
    rows = rows.filter((s) =>
      [s.artwork.title, s.collector.display_name, s.seller_source]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }
  const ordering = sp.get('ordering');
  if (ordering === 'price' || ordering === '-price') {
    const dir = ordering === 'price' ? 1 : -1;
    rows = [...rows].sort((a, b) => dir * (Number(a.agreed_price) - Number(b.agreed_price)));
  }
  return rows;
};
const CLOSED_SALE = ['completed', 'archived', 'lost'];

const page = (results) =>
  envelope({
    pagination: {
      page: 1,
      per_page: 25,
      total_pages: 1,
      total_count: results.length,
      has_next: false,
      has_previous: false,
    },
    results,
  });

const SUMMARY = {
  requests: { new_by_kind: { purchase: 2 }, new_total: 2, resolved_total: 5 },
  today: { requests_created: 1, collectors_created: 0, bids_placed: 0, collector_logins: 3 },
  collectors: { total: 12, active: 4 },
  catalogue: { total: 9, available: 7, on_hold: 0, reserved: 1, sold: 1 },
  auctions: { live_now: 0, scheduled: 0, registrations_pending: 0 },
  exhibitions: { pending_review: 0 },
};

/**
 * A sign-in answers the token for ITS principal, and `/auth/me/` reads the
 * principal back out of the bearer token. That keeps the stub stateless, which
 * matters more here than it looks: Playwright runs spec files in parallel
 * workers against ONE stub, so a remembered "last login" leaks across them —
 * the collector walk signing in made the panel walk's owner-only desks answer
 * 403, which is a test failure with no bug behind it. The token IS the
 * session; nothing needs to be remembered.
 */
const TOKENS = {
  team: { access: 'e2e-team', refresh: 'e2e-team-r' },
  collector: { access: 'e2e-collector', refresh: 'e2e-collector-r' },
};

/** Which principal the caller is holding a token for. A refresh POST carries
 * the refresh token in its BODY rather than the header, so both are checked by
 * the caller that knows which it has. */
function bearerIsCollector(req) {
  const auth = req.headers.authorization || '';
  return auth.includes('e2e-collector');
}

/**
 * V1 Phase 3 — the auctions desks (G-AUC-1…4, G-REC-1). Three admin
 * auctions: a SCHEDULED one with two scheduled lots and an uploaded poster
 * (editable; the E2E edit/lot/cover walks use it), a LIVE one (read-only
 * form), and an ARCHIVED one (only on `?archived=true`, as the server does).
 * Stateless like the rest: a write answers the row as it would be after it,
 * and a PATCH whose `expected_version` is behind the row's is the 409 a stale
 * save gets.
 */
const STUB_ORIGIN = 'http://127.0.0.1:8787';
const COVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a1714"/><stop offset="1" stop-color="#6b5a48"/></linearGradient></defs><rect width="600" height="800" fill="url(#g)"/><text x="50" y="690" fill="#efe9de" font-family="Georgia,serif" font-size="54">Spring Evening</text><text x="50" y="740" fill="#b5a898" font-family="Georgia,serif" font-size="30">Auction · Darz</text></svg>`;
const COVER_URL = `${STUB_ORIGIN}/files/auction-cover.svg`;
const AUC_SCHEDULED_ID = '00000000-0000-4000-8000-00000000ac01';
const AUC_LIVE_ID = '00000000-0000-4000-8000-00000000ac02';
const AUC_ARCHIVED_ID = '00000000-0000-4000-8000-00000000ac03';
const AUC_BASE = {
  description: '',
  currency: 'USD',
  terms: '',
  terms_required: true,
  invite_only: false,
  archived: false,
  cover_image_url: null,
  version: 4,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};
const AUCTIONS = [
  {
    ...AUC_BASE,
    id: AUC_SCHEDULED_ID,
    title: 'Spring Evening Auction',
    description: 'Contemporary Iranian painting, one evening only.',
    status: 'scheduled',
    starts_at: '2026-10-19T16:00:00Z',
    ends_at: '2026-10-24T16:00:00Z',
    cover_image_url: COVER_URL,
    lots_count: 2,
  },
  {
    ...AUC_BASE,
    id: AUC_LIVE_ID,
    title: 'Summer Online Auction',
    status: 'live',
    starts_at: '2026-09-20T10:00:00Z',
    ends_at: '2026-10-18T10:00:00Z',
    lots_count: 0,
  },
  {
    ...AUC_BASE,
    id: AUC_ARCHIVED_ID,
    title: 'Winter Archive Sale',
    status: 'closed',
    starts_at: '2026-01-10T10:00:00Z',
    ends_at: '2026-01-17T10:00:00Z',
    archived: true,
    lots_count: 0,
  },
];
const LOT_BASE = {
  auction: AUC_SCHEDULED_ID,
  reserve_amount: '9000.00',
  premium_pct: '20.00',
  currency: 'USD',
  starts_at: '2026-10-19T16:00:00Z',
  ends_at: '2026-10-24T16:00:00Z',
  soft_close_sec: 120,
  status: 'scheduled',
  closing_notified: false,
  current_amount: null,
  bid_count: 0,
  leading_bidder: null,
  reserve_met: false,
  version: 2,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};
const AUC_LOTS = [
  {
    ...LOT_BASE,
    id: '00000000-0000-4000-8000-0000000010a1',
    artwork: '00000000-0000-4000-8000-00000000a101',
    lot_number: 1,
    opening_amount: '8000.00',
    low_estimate: '9000.00',
    high_estimate: '12000.00',
  },
  {
    ...LOT_BASE,
    id: '00000000-0000-4000-8000-0000000010a2',
    artwork: '00000000-0000-4000-8000-00000000a102',
    lot_number: 2,
    opening_amount: '15000.00',
    low_estimate: '18000.00',
    high_estimate: '25000.00',
  },
];
const LOT_ARTWORK_TITLES = {
  '00000000-0000-4000-8000-00000000a101': ['Parviz Tanavoli', 'Heech'],
  '00000000-0000-4000-8000-00000000a102': ['Monir Farmanfarmaian', 'Poet and Bird'],
};
const REG_BASE = { auction: AUC_SCHEDULED_ID, paddle_number: null, terms_accepted_at: null };
const REGISTRATIONS = [
  {
    ...REG_BASE,
    id: '00000000-0000-4000-8000-0000000019a1',
    collector: '00000000-0000-4000-8000-0000000019c1',
    status: 'pending',
    created_at: '2026-09-23T09:00:00Z',
  },
  {
    ...REG_BASE,
    id: '00000000-0000-4000-8000-0000000019a2',
    collector: '00000000-0000-4000-8000-0000000019c2',
    status: 'rejected',
    created_at: '2026-09-21T09:00:00Z',
  },
];
const REG_COLLECTORS = {
  '00000000-0000-4000-8000-0000000019c1': 'Sara Ahmadi',
  '00000000-0000-4000-8000-0000000019c2': 'Reza Karimi',
};
const REC_BASE = {
  artist: null,
  currency: 'USD',
  status: 'sold',
  is_highlight: false,
  version: 1,
  sale_name: '',
  year: '',
  hammer_amount: null,
  price_amount: null,
};
const AUCTION_RECORDS = [
  {
    ...REC_BASE,
    id: '00000000-0000-4000-8000-0000000018a1',
    artist_display_name: 'Parviz Tanavoli',
    lot_title: 'Heech and Chair',
    house: 'Christie’s',
    sale_date: '2026-05-10',
    realized_amount: '120000.00',
  },
  {
    ...REC_BASE,
    id: '00000000-0000-4000-8000-0000000018a2',
    artist_display_name: 'Monir Farmanfarmaian',
    lot_title: 'Mirror Ball',
    house: 'Tehran Auction',
    sale_date: '2026-03-02',
    realized_amount: '95000.00',
  },
  {
    ...REC_BASE,
    id: '00000000-0000-4000-8000-0000000018a3',
    artist_display_name: 'Farhad Moshiri',
    lot_title: 'Kiss',
    house: 'Artcurial',
    sale_date: '2025-11-20',
    realized_amount: '60000.00',
  },
];
const conflict = () => ({
  status: 409,
  body: {
    success: false,
    error: { code: 'CONFLICT', message: 'This record was modified by someone else.' },
    timestamp: new Date().toISOString(),
  },
});
/** C-11: an ordinary refusal comes back as a 400 whose code is INTERNAL_ERROR. */
const refused = (message) => ({
  status: 400,
  body: {
    success: false,
    error: { code: 'INTERNAL_ERROR', message },
    timestamp: new Date().toISOString(),
  },
});
/** A locked PATCH: stale → 409; else the row with the body merged, version+1. */
const lockedPatch = (row, body, editable, refusal) => {
  if (!row) return notFound('Not found.');
  if (typeof body?.expected_version !== 'number')
    return refused('expected_version is required');
  if (!editable(row)) return refused(refusal);
  if (body.expected_version !== row.version) return conflict();
  const { expected_version: _v, ...fields } = body;
  return envelope({ ...row, ...fields, version: row.version + 1 });
};
const auctionById = (path) => AUCTIONS.find((a) => a.id === path.split('/')[5]);

/** The collector's auction list — only non-archived sales here, with the
 * poster on one card (the card reads `cover_image_url`, no lot request). */
const COLLECTOR_AUCTIONS = AUCTIONS.filter((a) => !a.archived);

/* ── V1 Phase 4: the catalogue / collectors desks ─────────────────────────
 * Admin artworks carry `thumb` + `artist_name` (G-CAT-1), and the list
 * honours the Database's filters (Phase 5b + G-HEALTH-2/4) so a test can see
 * both the request query and a narrowed answer. One work (INCOMPLETE) is
 * refused by the publish gate with `details.missing` (G-CAT-8). */
const DAY = 86_400_000;
const thumbUrl = (n) => `${STUB_ORIGIN}/files/thumb-${n}.svg`;
const THUMB_SVG = (hue) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" viewBox="0 0 280 280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},32%,22%)"/><stop offset="1" stop-color="hsl(${hue + 40},40%,58%)"/></linearGradient></defs><rect width="280" height="280" fill="url(#g)"/><circle cx="140" cy="130" r="62" fill="hsl(${hue + 180},30%,70%)" opacity=".55"/></svg>`;
const ADM_BASE = {
  artist: null,
  artist_name_raw: '',
  year: null,
  medium: '',
  material: '',
  dimensions: '',
  width_cm: null,
  height_cm: null,
  edition: '',
  city: '',
  price_amount: null,
  currency: 'USD',
  price_type: 'on_request',
  availability_status: 'available',
  visibility: 'visible_all',
  source_name: '',
  source_type: '',
  public_description: '',
  internal_notes: '',
  provenance: '',
  tags: [],
  offer_floor: null,
  allowed_actions: [],
  is_published: false,
  published_at: null,
  legacy_darz_id: null,
  legacy_airtable_id: null,
  version: 1,
  updated_at: '2026-09-20T10:00:00Z',
};
const ADM_INCOMPLETE_ID = '00000000-0000-4000-8000-00000000a203';
const ADMIN_ARTWORKS = [
  {
    ...ADM_BASE,
    id: '00000000-0000-4000-8000-00000000a201',
    artist: '00000000-0000-4000-8000-00000000a871',
    artist_name: 'Parviz Tanavoli',
    thumb: thumbUrl(1),
    title: 'Heech in a Cage',
    year: 2005,
    medium: 'Bronze',
    dimensions: '150 x 60 cm',
    width_cm: '150.00',
    height_cm: '60.00',
    price_type: 'fixed',
    price_amount: '120000.00',
    is_published: true,
    published_at: '2026-09-01T10:00:00Z',
    source_type: 'gallery',
    _complete: true,
    _dup: false,
    created_at: new Date(Date.now() - 3 * DAY).toISOString(),
  },
  {
    ...ADM_BASE,
    id: '00000000-0000-4000-8000-00000000a202',
    artist: '00000000-0000-4000-8000-00000000a872',
    artist_name: 'Monir Farmanfarmaian',
    thumb: thumbUrl(2),
    title: 'Mirror Study',
    year: 1975,
    medium: 'Mirror mosaic',
    dimensions: '40 x 40 cm',
    width_cm: '40.00',
    height_cm: '40.00',
    availability_status: 'reserved',
    // published but NOT public — the Published desk must still list it
    visibility: 'selected',
    is_published: true,
    published_at: '2026-08-10T10:00:00Z',
    source_type: 'dealer',
    _complete: true,
    _dup: true,
    created_at: '2026-05-02T10:00:00Z',
  },
  {
    ...ADM_BASE,
    id: ADM_INCOMPLETE_ID,
    artist_name: 'Behjat Sadr',
    artist_name_raw: 'Behjat Sadr',
    thumb: null,
    title: 'Untitled Study',
    medium: 'Oil on canvas',
    visibility: 'gallery_portal',
    availability_status: 'sold',
    _complete: false,
    _dup: false,
    created_at: '2025-11-20T10:00:00Z',
  },
];
/** The Database's filters over the fixture, the server's way. */
const adminArtworkList = (sp) => {
  const b = (k) => (sp.get(k) === 'true' ? true : sp.get(k) === 'false' ? false : undefined);
  const size = (w) => {
    const side = Math.max(Number(w.width_cm) || 0, Number(w.height_cm) || 0);
    if (!side) return null;
    return side <= 50 ? 'small' : side <= 120 ? 'medium' : 'large';
  };
  const q = (sp.get('search') || '').toLowerCase();
  return ADMIN_ARTWORKS.filter(
    (w) =>
      (!q || `${w.title} ${w.artist_name || ''}`.toLowerCase().includes(q)) &&
      (!sp.get('availability_status') ||
        w.availability_status === sp.get('availability_status')) &&
      (b('published') === undefined || w.is_published === b('published')) &&
      (b('has_images') === undefined || !!w.thumb === b('has_images')) &&
      (b('duplicate_images') === undefined || w._dup === b('duplicate_images')) &&
      (b('complete') === undefined || w._complete === b('complete')) &&
      (b('gallery_portal') === undefined ||
        (w.visibility === 'gallery_portal') === b('gallery_portal')) &&
      (!sp.get('size') || size(w) === sp.get('size')) &&
      (!sp.get('source_type') || w.source_type === sp.get('source_type')) &&
      (!sp.get('created_after') || w.created_at >= sp.get('created_after')),
  ).map(({ _complete, _dup, ...w }) => w);
};
const adminArtwork = (id) => adminArtworkList(new URLSearchParams()).find((w) => w.id === id);

/** The admin artists roster (G-CAT-3): server search + ordering, `works_count`. */
const ADMIN_ARTISTS = [
  ['00000000-0000-4000-8000-00000000a871', 'Parviz Tanavoli', 30, '2026-01-10T00:00:00Z'],
  ['00000000-0000-4000-8000-00000000a872', 'Monir Farmanfarmaian', 12, '2026-03-02T00:00:00Z'],
  ['00000000-0000-4000-8000-00000000a873', 'Behjat Sadr', 4, '2026-09-01T00:00:00Z'],
].map(([id, display_name, works_count, created_at]) => ({
  id,
  display_name,
  name_variants: [],
  bio: '',
  birth_year: null,
  nationality: 'Iranian',
  external_ids: {},
  works_count,
  version: 1,
  created_at,
  updated_at: created_at,
}));
const adminArtistList = (sp) => {
  const q = (sp.get('search') || '').toLowerCase();
  const rows = ADMIN_ARTISTS.filter((a) => a.display_name.toLowerCase().includes(q));
  const by = {
    name: (a, b) => a.display_name.localeCompare(b.display_name),
    '-name': (a, b) => b.display_name.localeCompare(a.display_name),
    created: (a, b) => a.created_at.localeCompare(b.created_at),
    '-created': (a, b) => b.created_at.localeCompare(a.created_at),
    works: (a, b) => b.works_count - a.works_count,
  }[sp.get('ordering') || ''];
  return by ? [...rows].sort(by) : rows;
};

/** The admin collectors roster (G-COL-1/2): the summary, and rows with the
 * list-only `last_activity_at` / `purchase_count`, ordered the server's way. */
const COLLECTORS_SUMMARY = { collectors: 3, vip: 1, active_30d: 2, engaged: 2 };
const COL_BASE = {
  full_name: '',
  phone: '',
  city: 'Tehran',
  access_status: 'active',
  preferences: {},
  notes: '',
  version: 1,
  updated_at: '2026-09-01T00:00:00Z',
};
const ADMIN_COLLECTORS = [
  {
    ...COL_BASE,
    id: '00000000-0000-4000-8000-0000000c0001',
    display_name: 'Leila Ahmadi',
    email: 'leila@example.invalid',
    tier: 'vip',
    last_activity_at: new Date(Date.now() - 2 * DAY).toISOString(),
    purchase_count: 1,
    created_at: '2026-02-01T00:00:00Z',
  },
  {
    ...COL_BASE,
    id: '00000000-0000-4000-8000-0000000c0002',
    display_name: 'Dariush Kamali',
    email: 'dariush@example.invalid',
    tier: '',
    last_activity_at: new Date(Date.now() - 12 * DAY).toISOString(),
    purchase_count: 3,
    created_at: '2026-06-15T00:00:00Z',
  },
  {
    ...COL_BASE,
    id: '00000000-0000-4000-8000-0000000c0003',
    display_name: 'Sara Nouri',
    email: 'sara@example.invalid',
    tier: '',
    last_activity_at: null,
    purchase_count: 0,
    created_at: '2026-09-10T00:00:00Z',
  },
];
const adminCollectorList = (sp) => {
  const q = (sp.get('search') || '').toLowerCase();
  const rows = ADMIN_COLLECTORS.filter(
    (c) =>
      `${c.display_name} ${c.email}`.toLowerCase().includes(q) &&
      (!sp.get('tier') || c.tier === sp.get('tier')) &&
      (!sp.get('access_status') || c.access_status === sp.get('access_status')),
  );
  const desc = (k) => (a, b) =>
    (b[k] ?? -Infinity) > (a[k] ?? -Infinity)
      ? 1
      : (b[k] ?? -Infinity) < (a[k] ?? -Infinity)
        ? -1
        : 0;
  const by = {
    name: (a, b) => a.display_name.localeCompare(b.display_name),
    '-name': (a, b) => b.display_name.localeCompare(a.display_name),
    created: (a, b) => a.created_at.localeCompare(b.created_at),
    '-activity': desc('last_activity_at'),
    '-purchases': desc('purchase_count'),
  }[sp.get('ordering') || ''];
  return by
    ? [...rows].sort(by)
    : [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
};

/** The Club's selections — each nested artwork carries `thumb` (G-CLUB-1). */
const CLUB_SELECTIONS = [
  {
    id: '00000000-0000-4000-8000-0000000c1b01',
    name: 'Autumn private view',
    note: 'Before the public catalogue.',
    artworks: [
      { id: ADMIN_ARTWORKS[1].id, title: 'Mirror Study', thumb: thumbUrl(2) },
      { id: ADMIN_ARTWORKS[0].id, title: 'Heech in a Cage', thumb: thumbUrl(1) },
    ],
    collectors: [{ id: ADMIN_COLLECTORS[0].id, display_name: 'Leila Ahmadi' }],
    created_by: null,
    version: 1,
    created_at: '2026-09-12T00:00:00Z',
    updated_at: '2026-09-12T00:00:00Z',
  },
];

const routes = {
  // `?langs=` turns the multilingual engine on for one walk. The app ships it
  // OFF (no `theme.langs`), and the default here reproduces that — so the stub
  // proves both halves: English-only by default, and a real language when the
  // owner publishes one.
  'GET /api/app-theme/': (req) => {
    const on = new URL(req.url, 'http://x').searchParams.get('langs');
    return envelope({
      theme: on ? { langs: { enabled: ['en', 'fa'], def: on } } : {},
    });
  },
  'POST /api/auth/team/login/': () => envelope(TOKENS.team),
  // The collector gate's own sign-in — first name + access key, the credential
  // model D4 kept (`docs/PHASE_24_35_PLAN.md`).
  'POST /api/auth/collector/login/': () => envelope(TOKENS.collector),
  // A cold load (a reload, a `page.goto`) refreshes with NO bearer — the
  // refresh token is in the body. Until the stub read bodies this answered
  // every cold load with the TEAM pair, so a collector walk silently became a
  // team session after its first navigation (the Profile card then had no
  // contact fields to show). The body decides now; the header stays as the
  // fallback for a caller that sends one.
  'POST /api/auth/token/refresh/': (req, body) =>
    envelope(
      String(body?.refresh || '').includes('e2e-collector') || bearerIsCollector(req)
        ? TOKENS.collector
        : TOKENS.team,
    ),
  'GET /api/auth/me/': (req) => envelope(bearerIsCollector(req) ? ME_COLLECTOR : ME),
  // The collector's own profile edit (G-B1). Echoes the stored collector with
  // the accepted fields applied — stateless, like every route here, so a
  // reload reads the fixture again. A team token is a 403, as on the backend.
  'PATCH /api/auth/me/': (req, body) => {
    if (!bearerIsCollector(req)) {
      return {
        status: 403,
        body: {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Only a collector can edit their profile here.',
          },
          timestamp: new Date().toISOString(),
        },
      };
    }
    const accepted = Object.fromEntries(
      Object.entries(body || {}).filter(([k]) => ME_EDITABLE.includes(k)),
    );
    return envelope({ ...ME_COLLECTOR, ...accepted });
  },
  // G-MEMB-3/6/7 — `{tier, status, active_until}`, an active VIP with an end
  // date, so the Settings row carries its pill and the sheet its active block.
  'GET /api/auth/my-membership/': () =>
    envelope({ tier: 'vip', status: 'active', active_until: '2027-03-12' }),
  'GET /api/documents/': () => page(COLLECTOR_DOCUMENTS),
  'GET /api/catalog/artworks/selections/': () => page(SELECTIONS),
  'GET /api/options/': () => envelope(OPTIONS),
  'GET /api/crm/requests/': () =>
    envelope({
      pagination: {
        page: 1,
        per_page: 100,
        total_pages: 1,
        total_count: COLLECTOR_REQUESTS.length,
        has_next: false,
        has_previous: false,
      },
      results: COLLECTOR_REQUESTS,
    }),
  // The gate's Request access (G-P34-1). Answers **200** — the backend's
  // replay of a `client_req_id` it already holds — because that is the answer
  // the gate used to treat as nothing special and must treat as success; a
  // first insert (201) takes the same path.
  'POST /api/auth/access-requests/': () =>
    envelope({ id: '00000000-0000-4000-8000-00000000acc1', status: 'pending' }),
  // Membership redeem (Phase 13). A POST, so the catch-all 400s it — which is
  // a fine stand-in for a rejected code but never lets the success path run.
  // Answers `vip`, labelled "VIP" from the options map (never "Basic Access").
  'POST /api/auth/membership/redeem/': () =>
    envelope({ plan: 'vip', tier: 'vip', redeemed_at: new Date().toISOString() }),
  // the REAL path: DashboardService = '/dashboard' + '/admin/summary/'.
  // The route said '/api/admin/summary/' until PR #54 — the summary then
  // fell into the paginated catch-all and Tiles crashed on
  // `requests.new_by_kind`, which is what the overnight bimodal e2e runs
  // really were: the walk only passed when the assertions outran the fetch.
  'GET /api/dashboard/admin/summary/': () => envelope(SUMMARY),
  // The Database desk's Year/Source dropdown vocabularies. Registered
  // explicitly because the catch-all below answers a PAGINATED envelope, and
  // a desk reading `{years, sources}` off that used to crash on `.map` of
  // undefined — the desk now normalises (see `artworkFacets.ts`), and this
  // route makes the stub tell the truth about the endpoint's real shape.
  'GET /api/catalog/admin/artworks/facets/': () => envelope({ years: [], sources: [] }),
  'GET /api/catalog/admin/artworks/': (req) =>
    page(adminArtworkList(new URL(req.url, 'http://x').searchParams)),
  'GET /api/catalog/admin/artists/': (req) =>
    page(adminArtistList(new URL(req.url, 'http://x').searchParams)),
  'GET /api/auth/admin/collectors/summary/': () => envelope(COLLECTORS_SUMMARY),
  'GET /api/auth/admin/collectors/': (req) =>
    page(adminCollectorList(new URL(req.url, 'http://x').searchParams)),
  'GET /api/crm/admin/selections/': () => page(CLUB_SELECTIONS),
  // The collector questionnaire. Both halves are registered because the
  // catch-all cannot express either: a never-submitted collector reads **200
  // with `answered: false`** (G-P25-1 — the backend used to 404 here), and the
  // catch-all's paginated 200 would carry no `answered` flag at all. POST
  // answers the stored object.
  'GET /api/recommendations/questionnaire/': () =>
    envelope({ answers: [], submitted_at: null, answered: false }),
  // The stub reads no request bodies anywhere, so this does not echo what was
  // sent — it answers the shape and the timestamp, which is all the app reads
  // back (the thank-you screen renders from its own state, not the response).
  'POST /api/recommendations/questionnaire/': () =>
    envelope({ answers: [], submitted_at: new Date().toISOString(), answered: true }),
  'GET /api/sales/admin/sales/summary/': () => envelope(saleSummary()),
  'GET /api/sales/admin/sales/': (req) =>
    page(saleList(new URL(req.url, 'http://x').searchParams)),
  'GET /api/auctions/admin/auctions/': (req) => {
    const archived = new URL(req.url, 'http://x').searchParams.get('archived');
    return page(AUCTIONS.filter((a) => a.archived === (archived === 'true')));
  },
  'GET /api/auctions/admin/registrations/': (req) => {
    const sp = new URL(req.url, 'http://x').searchParams;
    return page(
      REGISTRATIONS.filter(
        (r) =>
          (!sp.get('status') || r.status === sp.get('status')) &&
          (!sp.get('auction') || r.auction === sp.get('auction')),
      ),
    );
  },
  'GET /api/auctions/admin/records/': (req) => {
    const house = new URL(req.url, 'http://x').searchParams.get('house');
    return page(AUCTION_RECORDS.filter((r) => !house || r.house === house));
  },
  'GET /api/auctions/': () => page(COLLECTOR_AUCTIONS),
  // One incomplete work and one shared image, with the G-HEALTH-3 deleted count.
  'GET /api/catalog/admin/data-health/': () =>
    envelope({
      healthy: false,
      duplicate_images: { count: 1, items: [{ object_key: 'artworks/mirror.jpg', n: 2 }] },
      incomplete_records: {
        count: 1,
        items: [
          { id: ADM_INCOMPLETE_ID, title: 'Untitled Study', missing: ['size', 'image'] },
        ],
      },
      published_but_hidden: { count: 0, items: [] },
      deleted_records: { count: 7 },
    }),
};

/**
 * Routes whose path carries an id, matched by pattern. Same job as the facets
 * entry above: **not every GET answers a paginated envelope**, and a stub that
 * pretends they all do is lying about the API rather than simplifying it.
 *
 * `artworkImages` and `artworkSelectionGrants` are `retrieve<X[]>` — a BARE
 * ARRAY — so a desk doing `images.map(...)` got an object and threw. The desks
 * now guard (`asArray`), and these entries stop the stub from being the one
 * telling the lie.
 */
const notFound = (message) => ({
  status: 404,
  body: {
    success: false,
    error: { code: 'NOT_FOUND', message },
    timestamp: new Date().toISOString(),
  },
});

const patterns = [
  // Public documents (`AllowAny`): only `legal_terms` is published here, as a
  // confirmed public `Document`; any other kind is the backend's 404.
  [
    /^\/api\/documents\/public\/[^/]+\/$/,
    'GET',
    (path) =>
      path.split('/')[4] === 'legal_terms'
        ? envelope({
            id: '00000000-0000-4000-8000-00000000d0e1',
            kind: 'legal_terms',
            ref: '',
            title: 'Terms & Conditions',
            fields: {},
            object_key: 'public/documents/legal_terms.pdf',
            pdf_url: 'http://127.0.0.1:8787/files/legal_terms.pdf',
            visibility: 'public',
            status: 'confirmed',
            owner_lock: false,
            collector: null,
            shared_at: null,
            created_by: null,
            confirmed_at: '2026-09-01T10:00:00Z',
            confirmed_by: null,
          })
        : notFound('No published document of that kind.'),
  ],
  // One of the collector's own requests (G-P5-3) — a deep link reads this
  // instead of waiting for the list. An id the collector does not own is a 404,
  // as on the real endpoint; the catch-all would hand back a list envelope.
  [
    /^\/api\/crm\/requests\/[^/]+\/$/,
    'GET',
    (path) => {
      const row = COLLECTOR_REQUESTS.find((r) => r.id === path.split('/')[4]);
      return row ? envelope(row) : notFound('No request found.');
    },
  ],
  [
    /^\/api\/catalog\/artworks\/00000000-0000-4000-8000-00000000a10[1-4]\/$/,
    'GET',
    (path) => envelope(REQUEST_WORKS[path.split('/')[4]]),
  ],
  [/^\/api\/catalog\/admin\/artworks\/[^/]+\/images\/$/, 'GET', () => envelope([])],
  // The publish gate (G-CAT-8): the incomplete work is refused with the
  // structured `details.missing`; any other known work publishes.
  [
    /^\/api\/catalog\/admin\/artworks\/[^/]+\/publish\/$/,
    'POST',
    (path) => {
      const id = path.split('/')[5];
      if (id === ADM_INCOMPLETE_ID)
        return {
          status: 400,
          body: {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message:
                'Validation failed: Cannot publish an incomplete listing.; missing: size; missing: image',
              details: {
                non_field_errors: ['Cannot publish an incomplete listing.'],
                missing: ['size', 'image'],
              },
            },
            timestamp: new Date().toISOString(),
          },
        };
      const w = adminArtwork(id);
      return w
        ? envelope({ ...w, is_published: true })
        : notFound('No Artwork matches the given query.');
    },
  ],
  [
    /^\/api\/catalog\/admin\/artworks\/[^/]+\/unpublish\/$/,
    'POST',
    (path) => {
      const w = adminArtwork(path.split('/')[5]);
      return w
        ? envelope({ ...w, is_published: false })
        : notFound('No Artwork matches the given query.');
    },
  ],
  [/^\/api\/catalog\/admin\/artworks\/[^/]+\/selection-grants\/$/, 'GET', () => envelope([])],
  // One sale (the desk's detail); an unknown id is a 404, as on the backend.
  [
    /^\/api\/sales\/admin\/sales\/[^/]+\/$/,
    'GET',
    (path) => {
      const sale = SALES.find((s) => s.id === path.split('/')[5]);
      return sale ? envelope(sale) : notFound('No Sale matches the given query.');
    },
  ],
  // Set/clear the follow-up (G-SALE-5). Stateless: answers the sale with the
  // sent date, `follow_up_overdue` computed the model's way.
  [
    /^\/api\/sales\/admin\/sales\/[^/]+\/follow-up\/$/,
    'POST',
    (path, body) => {
      const sale = SALES.find((s) => s.id === path.split('/')[5]);
      if (!sale) return notFound('No Sale matches the given query.');
      const at = body?.follow_up_at ?? null;
      const today = new Date().toISOString().slice(0, 10);
      return envelope({
        ...sale,
        follow_up_at: at,
        follow_up_overdue: !!at && at < today && !CLOSED_SALE.includes(sale.status),
      });
    },
  ],
  [
    /^\/api\/sales\/admin\/sales\/[^/]+\/notes\/$/,
    'GET',
    (path) => {
      const id = path.split('/')[5];
      if (!SALES.some((s) => s.id === id)) return notFound('No Sale matches the given query.');
      return page(SALE_NOTES[id] || []);
    },
  ],
  // Append a note: 201 with the note, authored by the signed-in team user.
  [
    /^\/api\/sales\/admin\/sales\/[^/]+\/notes\/$/,
    'POST',
    (path, body) => {
      if (!SALES.some((s) => s.id === path.split('/')[5]))
        return notFound('No Sale matches the given query.');
      return {
        status: 201,
        body: envelope({
          id: `00000000-0000-4000-8000-${String(Date.now()).slice(-12)}`,
          body: String(body?.body || ''),
          author: ME.id,
          author_name: ME.name,
          created_at: new Date().toISOString(),
        }),
      };
    },
  ],
  // The auction sale's lot — the admin tier's `LotAdmin`, for its auction id
  // and number (the Auction Sales tab links to the lot's auction page) — and
  // the Phase 3 auction's two scheduled lots.
  [
    /^\/api\/auctions\/admin\/lots\/[^/]+\/$/,
    'GET',
    (path) => {
      const id = path.split('/')[5];
      const lot = AUC_LOTS.find((l) => l.id === id);
      if (lot) return envelope(lot);
      return id === SALE_LOT_ID
        ? envelope({
            id: SALE_LOT_ID,
            auction: SALE_AUCTION_EVENT_ID,
            artwork: '00000000-0000-4000-8000-00000000a102',
            lot_number: 4,
            opening_amount: '8000.00',
            premium_pct: '20.00',
            currency: 'USD',
            status: 'sold',
          })
        : notFound('No Lot matches the given query.');
    },
  ],
  // G-AUC-2: a scheduled lot's locked PATCH.
  [
    /^\/api\/auctions\/admin\/lots\/[^/]+\/$/,
    'PATCH',
    (path, body) =>
      lockedPatch(
        AUC_LOTS.find((l) => l.id === path.split('/')[5]),
        body,
        (l) => l.status === 'scheduled',
        'Only a scheduled lot can be edited.',
      ),
  ],
  [
    /^\/api\/auctions\/admin\/auctions\/[^/]+\/$/,
    'GET',
    (path) => {
      const a = auctionById(path);
      return a ? envelope(a) : notFound('No Auction matches the given query.');
    },
  ],
  // G-AUC-1: draft/scheduled only; locked.
  [
    /^\/api\/auctions\/admin\/auctions\/[^/]+\/$/,
    'PATCH',
    (path, body) =>
      lockedPatch(
        auctionById(path),
        body,
        (a) => a.status === 'draft' || a.status === 'scheduled',
        'Only a draft or scheduled auction can be edited.',
      ),
  ],
  // G-AUC-4: a bare POST archives; `{archived:false}` restores.
  [
    /^\/api\/auctions\/admin\/auctions\/[^/]+\/archive\/$/,
    'POST',
    (path, body) => {
      const a = auctionById(path);
      if (!a) return notFound('No Auction matches the given query.');
      const archived = body?.archived ?? true;
      return envelope({ ...a, archived, version: a.version + 1 });
    },
  ],
  // The poster: multipart upload (the body is not JSON — not read) / delete.
  [
    /^\/api\/auctions\/admin\/auctions\/[^/]+\/cover-image\/$/,
    'POST',
    (path) => {
      const a = auctionById(path);
      if (!a) return notFound('No Auction matches the given query.');
      return envelope({ ...a, cover_image_url: COVER_URL, version: a.version + 1 });
    },
  ],
  [
    /^\/api\/auctions\/admin\/auctions\/[^/]+\/cover-image\/$/,
    'DELETE',
    (path) => {
      const a = auctionById(path);
      if (!a) return notFound('No Auction matches the given query.');
      return envelope({ ...a, cover_image_url: null, version: a.version + 1 });
    },
  ],
  [
    /^\/api\/auctions\/admin\/auctions\/[^/]+\/invite-only\/$/,
    'GET',
    () => envelope({ invite_only: false, invited_collectors: [] }),
  ],
  [
    /^\/api\/auctions\/admin\/auctions\/[^/]+\/lots\/$/,
    'GET',
    (path) => page(AUC_LOTS.filter((l) => l.auction === path.split('/')[5])),
  ],
  // The collector's view of the two visible sales (unknown ids keep the
  // catch-all, which the route walk relies on); their lots are the catch-all's
  // empty list — the event page's empty state.
  [
    /^\/api\/auctions\/00000000-0000-4000-8000-00000000ac0[12]\/$/,
    'GET',
    (path) => envelope(COLLECTOR_AUCTIONS.find((a) => a.id === path.split('/')[3])),
  ],
  // The lots' artworks and the registrations' collectors, by id.
  [
    /^\/api\/catalog\/admin\/artworks\/[^/]+\/$/,
    'GET',
    (path) => {
      const id = path.split('/')[5];
      const admin = adminArtwork(id);
      if (admin) return envelope(admin);
      const t = LOT_ARTWORK_TITLES[id];
      return t
        ? envelope({ id, artist_name_raw: t[0], title: t[1] })
        : notFound('No Artwork matches the given query.');
    },
  ],
  [
    /^\/api\/auth\/admin\/collectors\/[^/]+\/$/,
    'GET',
    (path) => {
      const id = path.split('/')[5];
      return REG_COLLECTORS[id]
        ? envelope({ id, display_name: REG_COLLECTORS[id] })
        : notFound('No Collector matches the given query.');
    },
  ],
  // G-AUC-3: a rejected registration back to pending; anything else is C-11.
  [
    /^\/api\/auctions\/admin\/registrations\/[^/]+\/reset\/$/,
    'POST',
    (path) => {
      const r = REGISTRATIONS.find((x) => x.id === path.split('/')[5]);
      if (!r) return notFound('No BidderRegistration matches the given query.');
      if (r.status !== 'rejected')
        return refused('Only a rejected registration can be reset.');
      return envelope({ ...r, status: 'pending' });
    },
  ],
  [
    /^\/api\/projects\/admin\/projects\/reports\/$/,
    'GET',
    () => envelope({ deliverables: [] }),
  ],
];

const server = http.createServer((req, res) => {
  // Writes carry a JSON body a route may read (the profile PATCH echoes it);
  // collect it first, then answer.
  if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') {
    respond(req, res, undefined);
    return;
  }
  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', () => {
    let body;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      body = undefined;
    }
    respond(req, res, body);
  });
});

function respond(req, res, body) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const key = `${req.method} ${url.pathname}`;
  const hit = routes[key];
  res.setHeader('Content-Type', 'application/json');
  // the dev origin differs from the stub's — answer CORS plainly
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  // The uploaded poster the stub's auctions point at — a small SVG, so a
  // render check shows a real image rather than a broken one.
  // The Phase 4 artwork thumbnails — small generated SVGs, one hue each.
  const thumb = url.pathname.match(/^\/files\/thumb-(\d+)\.svg$/);
  if (thumb) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.writeHead(200);
    res.end(THUMB_SVG(Number(thumb[1]) * 97));
    return;
  }
  if (url.pathname === '/files/auction-cover.svg') {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.writeHead(200);
    res.end(COVER_SVG);
    return;
  }
  if (hit) {
    // A handler may answer `{status, body}` when the endpoint's real answer is
    // not a 200 (e.g. an error branch a test drives).
    const answered = hit(req, body);
    const status = answered && typeof answered.status === 'number' ? answered.status : 200;
    res.writeHead(status);
    res.end(JSON.stringify(status === 200 ? answered : answered.body));
    return;
  }
  for (const [re, method, answer] of patterns) {
    if (req.method === method && re.test(url.pathname)) {
      // A write's pattern reads the body it was sent (the follow-up date, a
      // note), as the keyed routes above already do.
      const answered = answer(url.pathname, body);
      const status = typeof answered.status === 'number' ? answered.status : 200;
      res.writeHead(status);
      res.end(JSON.stringify(status === 200 ? answered : answered.body));
      return;
    }
  }
  if (req.method === 'GET') {
    // any list-shaped desk read renders its empty state
    res.writeHead(200);
    res.end(JSON.stringify(paginatedEmpty));
    return;
  }
  res.writeHead(400);
  res.end(
    JSON.stringify({
      success: false,
      error: { code: 'stub_unhandled', message: `stub has no ${key}` },
      timestamp: new Date().toISOString(),
    }),
  );
}

// 127.0.0.1 explicitly — the health URL and the browser both dial ipv4
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[e2e-stub] listening on :${PORT}`);
});
