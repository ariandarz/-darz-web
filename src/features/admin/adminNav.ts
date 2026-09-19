/**
 * The admin panel's navigation and its build map, ported as **data** from the
 * old panel's own `ADGROUPS` table (`darzstudio.art` `darz-studio.html:11721-11779`),
 * its `AD_FOLDED` map (`:11781`) and `_dzAllowedTabs` (`:11794-11803`).
 *
 * Why a table and not markup: the old panel's navbar is generated from exactly
 * this structure, and every rule that matters — which group a page belongs to,
 * which tabs a role may see, which groups fold under More — is a lookup against
 * it. Porting the structure keeps those rules in one place.
 *
 * **This file is the whole admin's map, not just the built part.** All fourteen
 * groups and 55 tabs are here, so `docs/ADMIN_ARCHITECTURE.md` and the navbar
 * can never disagree about what the panel is. (Fourteen, not fifteen: `ADGROUPS`
 * has fifteen entries, but `more` is the folded-group *menu* rather than a
 * group — `foldedGroups()` derives it. Plus Dashboard and Chat, which belong to
 * no group.) Three fields carry the state of each tab:
 *
 *  - `path`   — this app's route, or `null` while the desk is unbuilt.
 *               **`path` alone decides what renders**: `visibleTabs()` drops a
 *               `null`, so an unbuilt desk is absent from the navbar rather
 *               than stubbed (owner decision D9). Building a desk is then: add
 *               the route, give the tab its path.
 *  - `api`    — whether the backend this desk needs exists today. Documentation
 *               that lives beside the thing it describes, so it cannot drift
 *               into a stale table in a doc. It does **not** affect rendering.
 *  - `phase`  — which frontend phase owns it, for the same reason.
 *
 * The old panel's own page key (`ap`) is kept as `key` so any tab can be
 * grepped back to its source in `darz-studio.html`.
 */

/** The two real roles this system has (`apps/core/permissions.py:24-25`). The
 * old panel also had a per-tab `teamAccess` grant on top of a single `admin`
 * role; backend Phase 31 deliberately replaced that with these two, so there is
 * no third source of truth to consult. */
export type AdminRole = 'owner' | 'standard_admin';

/** Whether the API a desk needs is there. `partial` means some of the desk's
 * tabs/actions are served and some are not — the desk is buildable, with the
 * unserved parts flagged on screen rather than silently missing. */
export type ApiState = 'ready' | 'partial' | 'none';

export interface AdminTab {
  /** The old panel's own page key (its `ap`), verbatim. */
  key: string;
  label: string;
  /** This app's route, or `null` while the desk is unbuilt. Decides rendering. */
  path: string | null;
  /** In the old panel's `OWNER_ONLY` list (`:11800`). Derived, never hand-set. */
  ownerOnly?: boolean;
  /** Backend readiness. Documentation only — never affects rendering. */
  api: ApiState;
  /** Which frontend phase owns this desk. Documentation only. */
  phase: string;
  /** Why `api` is not `ready`, or anything a builder needs to know first. */
  note?: string;
}

export interface AdminGroup {
  key: string;
  label: string;
  /** Rendered gold (`.ad-gtab--owner`, `:8199`) and offered to an owner only. */
  owner?: boolean;
  /** Folded under "More" (`AD_FOLDED`, `:11781`). */
  folded?: boolean;
  tabs: AdminTab[];
}

/**
 * `darz-studio.html:11800`, verbatim. Every key here is hidden from a standard
 * admin — but never from the owner, see `isTabAllowed`.
 *
 * Note what is **not** in it: `design`. The old panel deliberately leaves App
 * Design open to a standard admin, which is why backend Phase 32 gated it at
 * `IsStandardAdminOrOwner` while Memberships and Team-logins got `IsOwner`.
 * Keep the two in step — this list is the frontend's half of the same rule.
 */
export const OWNER_ONLY: readonly string[] = [
  'igStudio',
  'socialCal',
  'socialAi',
  'team',
  'strategy',
  'access',
  'marketing',
  'accounting',
  'automations',
  'settings',
  'system',
  'memberships',
  'portal',
];

/** Build a tab, tagging `ownerOnly` from `OWNER_ONLY` so that list stays the
 * single source of the rule. */
function tab(
  key: string,
  label: string,
  path: string | null,
  api: ApiState,
  phase: string,
  note?: string,
): AdminTab {
  const t: AdminTab = { key, label, path, api, phase };
  if (OWNER_ONLY.includes(key)) t.ownerOnly = true;
  if (note) t.note = note;
  return t;
}

/**
 * The two fixed top-row buttons that belong to **no group** — `.ad-tab0`
 * (`:11088`) and `.ad-tab0.ad-chattab` (`:11099`). `_dzPageGroup` returns `''`
 * for both, which is why the sub-row stays hidden on them (`:11832`).
 */
export const ADMIN_HOME: AdminTab = tab(
  'dashboard',
  'Dashboard',
  '/admin',
  'ready',
  '11b·1',
  'GET /api/dashboard/admin/summary/ (backend Phase 29).',
);

export const ADMIN_CHAT: AdminTab = tab(
  'chat',
  'Chat',
  '/admin/chat',
  'ready',
  '11b·3',
  'The admin end of the collector conversation — crm admin messages, already ' +
    'consumed by the collector side. Its own top-row button, not a group tab.',
);

/**
 * Every group in `ADGROUPS` (`:11721-11779`), in the old file's own order.
 *
 * `more` is not registered: it is the folded-group menu, which `foldedGroups()`
 * derives from the `folded` flag rather than storing twice. The `artist` and
 * `gallery` workspace pages are not here either — the old panel reaches them
 * from a list, not from the navbar (`:11743`, `:11727`).
 */
export const ADMIN_GROUPS: readonly AdminGroup[] = [
  {
    key: 'catalog',
    label: 'Artworks',
    tabs: [
      tab(
        'database',
        'Database',
        '/admin/artworks',
        'ready',
        '12·1',
        'catalog admin CRUD, 18 routes.',
      ),
      tab(
        'import',
        'Import',
        '/admin/import',
        'ready',
        '11b·6',
        'Staging queue is served; CSV/PDF PARSING is frontend work (D15: CSV + paste first).',
      ),
    ],
  },
  {
    key: 'artists',
    label: 'Artists',
    tabs: [
      tab('artists', 'Artists', '/admin/artists', 'ready', '12·1', 'catalog admin artists.'),
    ],
  },
  {
    key: 'galleries',
    label: 'Galleries',
    tabs: [
      tab(
        'galleries',
        'Galleries',
        '/admin/sources?type=gallery',
        'ready',
        '12·4',
        'the gallery slice of Sources & Partners; the per-gallery workspace rides the portal step.',
      ),
      tab('sources', 'Sources & Partners', '/admin/sources', 'ready', '12·4'),
    ],
  },
  {
    key: 'market',
    label: 'Market App',
    tabs: [
      tab(
        'market',
        'Published works',
        '/admin/published',
        'ready',
        '12·2',
        'the collector list endpoint IS the published set (G-CAT-2).',
      ),
      // App Design is in this group AND under Operations — one screen, two
      // entry points (:11730 and :11764). A fact to port, not a bug to fix.
      tab(
        'design',
        'App Design',
        '/admin/design',
        'ready',
        '11b·5',
        'core app-theme, public read + admin write.',
      ),
    ],
  },
  {
    key: 'documents',
    label: 'Documents',
    tabs: [
      // The first four are one page with a sticky sub-tab in the old panel
      // (`docsTab(...)`, :11732-11735); here they are four routes.
      tab('docProposals', 'Proposals', '/admin/documents?kind=proposal', 'ready', '12·3'),
      tab('docInvoices', 'Invoices', '/admin/documents?kind=invoice', 'ready', '12·3'),
      tab('docFiles', 'Library', '/admin/documents', 'ready', '12·3'),
      tab(
        'docHistory',
        'History',
        null,
        'partial',
        '12+',
        'its issued half IS the Library list; the activity half waits on an audit feed (G-DOC-2).',
      ),
      tab(
        'library',
        'Pricelists & saved items',
        null,
        'none',
        '12+',
        'Backend Phase 21 (two builders + savedItems) is not built.',
      ),
      tab(
        'archive',
        'Document Builder',
        null,
        'ready',
        '12+',
        'the Studio — waits on D18 (the client-side PDF renderer); uploads already work.',
      ),
    ],
  },
  {
    key: 'auctions',
    label: 'Auctions',
    tabs: [
      tab(
        'auctions',
        'Live Auctions',
        '/admin/auctions',
        'ready',
        '12·5',
        'auctions admin, 12 routes.',
      ),
      tab(
        'records',
        'Auction Records',
        '/admin/auction-records',
        'ready',
        '12·6',
        'the external results DB, full CRUD.',
      ),
      tab(
        'aucReg',
        'Register to Bid',
        '/admin/auction-registrations',
        'ready',
        '12·5',
        'Paddle registrations queue.',
      ),
    ],
  },
  {
    key: 'collectors',
    label: 'Collectors',
    folded: true,
    tabs: [
      tab('users', 'Collectors', '/admin/collectors', 'ready', '11b·2'),
      tab('activity', 'Requests & Activity', '/admin/requests', 'ready', '11b·3'),
      tab(
        'club',
        'Collector Club',
        '/admin/club',
        'ready',
        '11b·3',
        'crm.CollectorSelection (backend Phase 35).',
      ),
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    folded: true,
    tabs: [
      tab(
        'marketSales',
        'Market Sales',
        '/admin/sales',
        'ready',
        '12·2',
        'sales admin, 5 routes.',
      ),
      tab(
        'auctionSales',
        'Auction Sales',
        null,
        'partial',
        '12+',
        'Sale has no source axis (G-SALE-4) — auction settlement is its own loop.',
      ),
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    folded: true,
    // Eight sub-tabs in the old panel (:13580-13587); seven are desks here.
    // The record and its stage moves ride `/admin/projects/:id`, reached from
    // the list, the board and the dashboard cards, not from the navbar.
    tabs: [
      tab(
        'projDash',
        'Dashboard',
        '/admin/projects',
        'ready',
        '11c',
        'GET /projects/admin/projects/dashboard/ — Delayed and Awaiting-approval ' +
          'read the stage sub-state, which the API does not accept yet (G-PROJ-3).',
      ),
      tab('projList', 'Projects', '/admin/projects/list', 'ready', '11c'),
      tab(
        'projPipeline',
        'Pipeline',
        '/admin/projects/pipeline',
        'ready',
        '11c',
        '17 stages; the status label is derived server-side (G-PROJ-2: not settable).',
      ),
      tab('projPackages', 'Packages', '/admin/projects/packages', 'ready', '11c'),
      tab(
        'projProposal',
        'Proposal',
        null,
        'partial',
        '11c',
        'No separate desk: the client proposal issues from the project record ' +
          '(Proposal section) as a documents.Document (kind proposal) rendered ' +
          'client-side like the exhibition documents. The old Proposal Builder ' +
          '(the free-form document editor, :14647) is not ported.',
      ),
      tab(
        'projCalc',
        'Calculator',
        '/admin/projects/calculator',
        'ready',
        '11c',
        'Prices from the service catalogue (D21) — the old client-side rate card ' +
          'has no backend.',
      ),
      tab('projPartners', 'Partners', '/admin/projects/partners', 'ready', '11c'),
      tab('projReports', 'Reports', '/admin/projects/reports', 'ready', '11c'),
    ],
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    folded: true,
    tabs: [
      tab(
        'recoOverview',
        'Overview',
        null,
        'ready',
        '11',
        'recommendations admin, 14 routes.',
      ),
      tab('recoTag', 'Tagging & Review', null, 'ready', '11'),
      tab('recoFilters', 'Smart Filters', null, 'ready', '11'),
      tab('recoReco', 'Recommendations', null, 'ready', '11'),
      tab('recoHistory', 'History', null, 'ready', '11'),
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    folded: true,
    tabs: [
      tab('design', 'App Design', '/admin/design', 'ready', '11b·5'),
      tab(
        'logistics',
        'Logistics & Payments',
        null,
        'none',
        '12+',
        'Backend Phase 20 (DARZ_LOGI_SCHEMA, large surface) is not built.',
      ),
      tab(
        'analytics',
        'Analytics',
        null,
        'none',
        '12+',
        'No analytics API. The Dashboard summary is the only aggregate served.',
      ),
      tab(
        'health',
        'Data Health',
        '/admin/data-health',
        'partial',
        '11b·6',
        'Three of the old desk’s ~8 checks port; the rest diagnosed the old ' +
          'client-sync architecture, which does not exist here.',
      ),
    ],
  },
  {
    key: 'social',
    label: 'Social',
    owner: true,
    tabs: [
      tab(
        'igStudio',
        'Instagram',
        null,
        'none',
        '12+',
        'Deliberately unscoped by the backend (their Phase 23 intro) — awaiting an owner decision there.',
      ),
      tab(
        'stories',
        'Insights & Stories',
        null,
        'none',
        '12+',
        'Backend Phase 22 (storiesView) is not built. **This is what "news" means here** — ' +
          'the old panel has no news desk.',
      ),
      tab(
        'socialCal',
        'Content Calendar',
        null,
        'none',
        '12+',
        'Deliberately unscoped by the backend.',
      ),
      tab(
        'socialAi',
        'AI Settings',
        null,
        'none',
        '12+',
        'Deliberately unscoped by the backend.',
      ),
    ],
  },
  {
    key: 'owner',
    label: 'Owner',
    owner: true,
    tabs: [
      tab(
        'access',
        'Access',
        null,
        'ready',
        '11b·2',
        'AccessKey issue/revoke/extend + login events.',
      ),
      tab('team', 'Team', '/admin/team', 'ready', '11b·4'),
      tab(
        'strategy',
        'Strategy',
        null,
        'none',
        '12+',
        'Deliberately unscoped by the backend.',
      ),
      tab(
        'marketing',
        'Marketing',
        null,
        'ready',
        '11',
        'marketing admin, 5 routes incl. campaign copy.',
      ),
      tab(
        'accounting',
        'Accounting',
        '/admin/accounting',
        'ready',
        '12·7',
        'the four-ledger books; deals/attachments/settlement follow.',
      ),
      tab(
        'automations',
        'Automations',
        null,
        'none',
        '12+',
        'Deliberately unscoped by the backend.',
      ),
      tab(
        'settings',
        'Settings',
        null,
        'partial',
        '11',
        'Audit log (GET /api/admin/audit-log/, IsOwner) is served; the rest of ' +
          'the old Settings tab is owner preferences with no API.',
      ),
      tab(
        'languages',
        'Languages',
        null,
        'none',
        '12+',
        'Backend Phase 26 (i18n + white-label) is not built.',
      ),
      tab(
        'portal',
        'Market Portal',
        null,
        'ready',
        '10',
        'gallery portal admin — links, review/approve.',
      ),
    ],
  },
  {
    key: 'system',
    label: 'Access Management',
    owner: true,
    tabs: [
      tab(
        'memberships',
        'Memberships',
        '/admin/memberships',
        'ready',
        '11b·4',
        'No payment processing anywhere, by design.',
      ),
      tab(
        'system',
        'Access Request',
        '/admin/access-requests',
        'ready',
        '11b·2',
        'The review queue for the public request form.',
      ),
    ],
  },
];

/** Every registered tab, groups flattened, plus the two group-less buttons. */
export function allTabs(): AdminTab[] {
  return [ADMIN_HOME, ADMIN_CHAT, ...ADMIN_GROUPS.flatMap((g) => g.tabs)];
}

/**
 * `_dzAllowedTabs` (`:11794`), whose opening comment is the rule and is worth
 * keeping verbatim: *"THE OWNER ALWAYS SEES EVERY TAB — no Settings lock, role
 * limit or owner-only flag ever hides a tab from the owner (owner request)."*
 */
export function isTabAllowed(t: AdminTab, role: AdminRole): boolean {
  return role === 'owner' || !t.ownerOnly;
}

/** Allowed for this role **and** actually built. What the navbar renders. */
export function visibleTabs(group: AdminGroup, role: AdminRole): AdminTab[] {
  return group.tabs.filter((t) => t.path !== null && isTabAllowed(t, role));
}

/** Groups with at least one renderable tab. An owner-only group is dropped
 * wholesale for a standard admin, matching the old panel hiding the whole
 * `.ad-gtab` when no tab inside it is allowed (`_dzApplyTabVisibility`, :11812). */
export function visibleGroups(role: AdminRole): AdminGroup[] {
  return ADMIN_GROUPS.filter(
    (g) => (role === 'owner' || !g.owner) && visibleTabs(g, role).length > 0,
  );
}

/** The top row: the unfolded groups, in `ADGROUPS` order. Dashboard, Chat and
 * More are rendered around these by `AdminShell` (`:11088-11102`). */
export function topRowGroups(role: AdminRole): AdminGroup[] {
  return visibleGroups(role).filter((g) => !g.folded);
}

/** The groups behind "More" (`AD_FOLDED`, `:11781`). */
export function foldedGroups(role: AdminRole): AdminGroup[] {
  return visibleGroups(role).filter((g) => g.folded);
}

/** Which group owns a route, and which tab. `null` for a path outside the
 * panel, and for Dashboard and Chat, which belong to no group.
 *
 * App Design is in two groups, so a first match is all that can be returned —
 * the same ambiguity `_dzPageGroup` has, which the old panel resolves with
 * sticky state. The first match is Market App, its position in `ADGROUPS`. */
export function findTab(path: string): { group: AdminGroup; tab: AdminTab } | null {
  for (const group of ADMIN_GROUPS) {
    for (const t of group.tabs) {
      if (t.path !== null && t.path === path) return { group, tab: t };
    }
  }
  return null;
}

/** Whether this role may open this route. The two group-less tabs count —
 * `findTab` deliberately does not know them, because it also decides the
 * sub-row and neither opens one (`:11832`) — and a path with no tab at all (an
 * unbuilt desk) answers `false` so the caller redirects. */
export function isPathAllowed(path: string, role: AdminRole): boolean {
  for (const t of [ADMIN_HOME, ADMIN_CHAT]) {
    if (t.path !== null && t.path === path) return isTabAllowed(t, role);
  }
  const hit = findTab(path);
  return hit !== null && isTabAllowed(hit.tab, role);
}

/**
 * Where `/admin` lands. The old panel clamps the same way when the current page
 * is not in the allowed set: `if(!set[page])page=set.dashboard?'dashboard':'database';`
 * (`:11815`) — the Dashboard if it is available, otherwise the first page that
 * is. `null` when this role can reach nothing at all.
 */
export function firstVisiblePath(role: AdminRole): string | null {
  if (ADMIN_HOME.path !== null) return ADMIN_HOME.path;
  for (const group of visibleGroups(role)) {
    const [first] = visibleTabs(group, role);
    if (first?.path) return first.path;
  }
  return null;
}

/** `Me.role` is `string | null | undefined` on the wire. Anything that is not
 * the literal `owner` is treated as a standard admin — the safe direction, and
 * the one the backend takes too (`TeamUser.role` defaults to `standard_admin`). */
export function asAdminRole(role: string | null | undefined): AdminRole {
  return role === 'owner' ? 'owner' : 'standard_admin';
}
