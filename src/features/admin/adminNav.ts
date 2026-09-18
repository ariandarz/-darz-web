/**
 * The admin panel's navigation, ported as **data** from the old panel's own
 * `ADGROUPS` table (`darzstudio.art` `darz-studio.html:11721-11779`), its
 * `AD_FOLDED` map (`:11781`) and `_dzAllowedTabs` (`:11794-11803`).
 *
 * Why a table and not markup: the old panel's navbar is generated from exactly
 * this structure, and every rule that matters — which group a page belongs to,
 * which tabs a role may see, which groups fold under More — is a lookup against
 * it. Porting the structure keeps those rules in one place; porting the
 * rendered markup instead would scatter them (docs/PHASE_11B_PLAN.md §2).
 *
 * **The shape is not obvious from the backend's tab names, so read §2 of the
 * plan before adding to this file.** The old panel is a two-tier navbar with
 * sixteen groups; Phase 11b's desks are scattered across five of them. Import
 * sits beside Database under *Artworks*, Data Health under *Operations*, and
 * App Design appears in **two** groups at once.
 *
 * ## What is registered here
 *
 * Only Phase 11b's own groups and tabs — the five the plan builds. The other
 * eleven groups (Artists, Galleries, Auctions, Documents, Sales, Intelligence,
 * Social, …) belong to other phases and are deliberately absent rather than
 * stubbed (owner decision D9).
 *
 * A tab whose desk is not built yet carries `path: null`. It stays in the table
 * so the port is complete and the owner-gating rules can be tested against the
 * real key set, but **nothing renders it** — `visibleTabs()` drops it. Building
 * a desk is then: add its route, give the tab its `path`. That is the same
 * "absent, not stubbed" result D9 asked for, without a half-ported table.
 */

/** The two real roles this system has (`apps/core/permissions.py:24-25`). The
 * old panel also had a per-tab `teamAccess` grant on top of a single `admin`
 * role; backend Phase 31 deliberately replaced that with these two, so there is
 * no third source of truth to consult. */
export type AdminRole = 'owner' | 'standard_admin';

export interface AdminTab {
  /** The old panel's own page key (its `ap`), kept verbatim so a reader can
   * grep `darz-studio.html` for the desk this tab opens. */
  key: string;
  label: string;
  /** This app's route, or `null` while the desk is unbuilt. */
  path: string | null;
  /** In the old panel's `OWNER_ONLY` list (`:11800`). Derived below rather
   * than hand-set, so the two can never drift. */
  ownerOnly?: boolean;
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

/** Tag a tab from `OWNER_ONLY` so the list stays the single source. */
function tab(key: string, label: string, path: string | null): AdminTab {
  const t: AdminTab = { key, label, path };
  if (OWNER_ONLY.includes(key)) t.ownerOnly = true;
  return t;
}

/**
 * The Dashboard button — `.ad-tab0` in the old markup (`:11088`), a fixed first
 * entry that belongs to no group, which is why `_dzPageGroup('dashboard')`
 * returns `''` and the sub-row stays hidden on it.
 */
export const ADMIN_HOME: AdminTab = tab('dashboard', 'Dashboard', null);

/**
 * Phase 11b's slice of `ADGROUPS` (`:11721-11779`), in the old file's own
 * order. Labels are verbatim.
 */
export const ADMIN_GROUPS: readonly AdminGroup[] = [
  // :11721 — {k:'catalog',label:'Artworks',tabs:[{ap:'database'},{ap:'import'}]}
  // `database` is Phase 7's desk, not this phase's, so only Import is listed.
  {
    key: 'catalog',
    label: 'Artworks',
    tabs: [tab('import', 'Import', null)],
  },
  // :11729 — {k:'market',label:'Market App',tabs:[{ap:'market'},{ap:'design'}]}
  // `market` (Published works) is Phase 7's; App Design is this phase's.
  {
    key: 'market',
    label: 'Market App',
    tabs: [tab('design', 'App Design', null)],
  },
  // :11746 — the Collectors group, folded under More.
  // The old middle tab routes through `goReq('all')` rather than a plain page
  // switch, because page:'activity' is shared with the Auctions group's
  // "Register to Bid" and the two must not inherit each other's scope
  // (:11747-11751). Here they are separate routes, so the collision is gone.
  {
    key: 'collectors',
    label: 'Collectors',
    folded: true,
    tabs: [
      tab('users', 'Collectors', null),
      tab('activity', 'Requests & Activity', '/admin/requests'),
      tab('club', 'Collector Club', null),
    ],
  },
  // :11763 — {k:'operations',...,tabs:[{ap:'design'},{ap:'logistics'},{ap:'analytics'},{ap:'health'}]}
  // App Design appears here AND under Market App — one screen, two entry
  // points. Not a bug to fix: a fact to port (plan §2, finding 1).
  // `logistics` and `analytics` are other phases'.
  {
    key: 'operations',
    label: 'Operations',
    folded: true,
    tabs: [tab('design', 'App Design', null), tab('health', 'Data Health', null)],
  },
  // :11774 — the Owner group. Only Access and Team are this phase's.
  {
    key: 'owner',
    label: 'Owner',
    owner: true,
    tabs: [tab('access', 'Access', null), tab('team', 'Team', null)],
  },
  // :11776 — Access Management, both tabs this phase's.
  {
    key: 'system',
    label: 'Access Management',
    owner: true,
    tabs: [tab('memberships', 'Memberships', null), tab('system', 'Access Request', null)],
  },
];

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

/** The top row: Dashboard, then the unfolded groups, then More (when any
 * folded group is visible), then the owner groups — `:11092-11102`'s order. */
export function topRowGroups(role: AdminRole): AdminGroup[] {
  return visibleGroups(role).filter((g) => !g.folded);
}

/** The groups behind "More" (`AD_FOLDED`, `:11781`). */
export function foldedGroups(role: AdminRole): AdminGroup[] {
  return visibleGroups(role).filter((g) => g.folded);
}

/** Which group owns a route, and which tab. `null` for a path outside the
 * panel, and for the Dashboard, which belongs to no group.
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

/** Whether this role may open this route. A path with no tab (the desk index,
 * an unbuilt desk) is not this function's to allow — the route table handles
 * those — so it answers `false` and the caller redirects. */
export function isPathAllowed(path: string, role: AdminRole): boolean {
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
