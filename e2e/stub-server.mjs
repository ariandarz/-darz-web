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
  'accounts.collector_tier': [{ value: 'standard', label: 'Standard' }],
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

const TOKENS = { access: 'e2e-access', refresh: 'e2e-refresh' };

const routes = {
  'GET /api/app-theme/': () => envelope({ theme: {} }),
  'POST /api/auth/team/login/': () => envelope(TOKENS),
  'POST /api/auth/token/refresh/': () => envelope(TOKENS),
  'GET /api/auth/me/': () => envelope(ME),
  'GET /api/options/': () => envelope(OPTIONS),
  'GET /api/admin/summary/': () => envelope(SUMMARY),
  'GET /api/catalog/admin/data-health/': () =>
    envelope({
      healthy: true,
      duplicate_images: { count: 0, items: [] },
      incomplete_records: { count: 0, items: [] },
      published_but_hidden: { count: 0, items: [] },
    }),
};

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
    res.writeHead(200);
    res.end(JSON.stringify(hit()));
    return;
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
