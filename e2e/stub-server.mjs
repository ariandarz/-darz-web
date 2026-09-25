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
  'catalog.visibility': [{ value: 'visible_all', label: 'Visible to all' }],
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
  'GET /api/catalog/admin/data-health/': () =>
    envelope({
      healthy: true,
      duplicate_images: { count: 0, items: [] },
      incomplete_records: { count: 0, items: [] },
      published_but_hidden: { count: 0, items: [] },
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
  // and number (the Auction Sales tab links to the lot's auction page).
  [
    /^\/api\/auctions\/admin\/lots\/[^/]+\/$/,
    'GET',
    (path) =>
      path.split('/')[5] === SALE_LOT_ID
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
        : notFound('No Lot matches the given query.'),
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
