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
  // Also `CollectorTierEnum`, for the same reason as the options key above.
  tier: 'active',
  access_status: 'active',
};

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
  'sales.status': [{ value: 'draft', label: 'Draft' }],
  'sales.payment_status': [{ value: 'unpaid', label: 'Unpaid' }],
  'sales.delivery_status': [{ value: 'pending', label: 'Pending' }],
};

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
  'GET /api/app-theme/': () => envelope({ theme: {} }),
  'POST /api/auth/team/login/': () => envelope(TOKENS.team),
  // The collector gate's own sign-in — first name + access key, the credential
  // model D4 kept (`docs/PHASE_24_35_PLAN.md`).
  'POST /api/auth/collector/login/': () => envelope(TOKENS.collector),
  'POST /api/auth/token/refresh/': (req) =>
    envelope(bearerIsCollector(req) ? TOKENS.collector : TOKENS.team),
  'GET /api/auth/me/': (req) => envelope(bearerIsCollector(req) ? ME_COLLECTOR : ME),
  'GET /api/options/': () => envelope(OPTIONS),
  // Membership redeem (Phase 13). A POST, so the catch-all 400s it — which is
  // a fine stand-in for a rejected code but never lets the success path run.
  // Answers `basic` so the sheet's active block and the Settings pill appear.
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
  // catch-all cannot express either: a GET **404s** until the collector has
  // submitted one — the documented answer, not a failure — and the catch-all's
  // paginated 200 would instead tell the app a profile already exists and send
  // it straight to the review with no answers. POST answers the stored object.
  'GET /api/recommendations/questionnaire/': () => ({
    status: 404,
    body: {
      success: false,
      error: { code: 'not_found', message: 'No questionnaire on file.' },
      timestamp: new Date().toISOString(),
    },
  }),
  // The stub reads no request bodies anywhere, so this does not echo what was
  // sent — it answers the shape and the timestamp, which is all the app reads
  // back (the thank-you screen renders from its own state, not the response).
  'POST /api/recommendations/questionnaire/': () =>
    envelope({ answers: [], submitted_at: new Date().toISOString() }),
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
const patterns = [
  [/^\/api\/catalog\/admin\/artworks\/[^/]+\/images\/$/, 'GET', () => envelope([])],
  [/^\/api\/catalog\/admin\/artworks\/[^/]+\/selection-grants\/$/, 'GET', () => envelope([])],
  [
    /^\/api\/projects\/admin\/projects\/reports\/$/,
    'GET',
    () => envelope({ deliverables: [] }),
  ],
];

const server = http.createServer((req, res) => {
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
    // not a 200 — the questionnaire's "never submitted" 404 is the first.
    const answered = hit(req);
    const status = answered && typeof answered.status === 'number' ? answered.status : 200;
    res.writeHead(status);
    res.end(JSON.stringify(status === 200 ? answered : answered.body));
    return;
  }
  for (const [re, method, answer] of patterns) {
    if (req.method === method && re.test(url.pathname)) {
      res.writeHead(200);
      res.end(JSON.stringify(answer()));
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
});

// 127.0.0.1 explicitly — the health URL and the browser both dial ipv4
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[e2e-stub] listening on :${PORT}`);
});
