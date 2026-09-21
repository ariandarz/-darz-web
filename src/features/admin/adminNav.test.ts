/**
 * The panel navigation's rules — the part of the old panel's `_dzAllowedTabs`
 * and `_dzRenderSubnav` that is logic rather than markup.
 *
 * These are the tests that keep the owner-gating honest: the frontend's
 * `OWNER_ONLY` list is the mirror of the backend's `IsOwner` vs.
 * `IsStandardAdminOrOwner` split, and a drift between them shows up as either a
 * tab that 403s on click or a desk nobody can find.
 */
import { describe, expect, it } from 'vitest';
import {
  ADMIN_GROUPS,
  OWNER_ONLY,
  allTabs,
  asAdminRole,
  findTab,
  firstVisiblePath,
  foldedGroups,
  isPathAllowed,
  isTabAllowed,
  topRowGroups,
  visibleGroups,
  visibleTabs,
} from './adminNav';

describe('OWNER_ONLY — the old panel’s list, :11800', () => {
  it('gates Memberships, Team and Access Request', () => {
    // the three Phase 11b desks backend Phases 30/31/34 put behind IsOwner
    expect(OWNER_ONLY).toContain('memberships');
    expect(OWNER_ONLY).toContain('team');
    expect(OWNER_ONLY).toContain('system');
    expect(OWNER_ONLY).toContain('access');
  });

  it('does NOT gate App Design — the backend matches it at IsStandardAdminOrOwner', () => {
    // If this ever flips, apps/core/urls.py's admin app-theme routes have to
    // flip with it; the old panel deliberately left `design` open (plan §2).
    expect(OWNER_ONLY).not.toContain('design');
  });

  it('is the only source of a tab’s ownerOnly flag', () => {
    for (const group of ADMIN_GROUPS) {
      for (const t of group.tabs) {
        expect(Boolean(t.ownerOnly)).toBe(OWNER_ONLY.includes(t.key));
      }
    }
  });
});

describe('isTabAllowed — the owner always sees every tab', () => {
  const ownerTab = {
    key: 'team',
    label: 'Team',
    path: '/x',
    ownerOnly: true,
    api: 'ready' as const,
    phase: 'test',
  };
  const openTab = {
    key: 'design',
    label: 'App Design',
    path: '/y',
    api: 'ready' as const,
    phase: 'test',
  };

  it('gives the owner everything, owner-only included', () => {
    expect(isTabAllowed(ownerTab, 'owner')).toBe(true);
    expect(isTabAllowed(openTab, 'owner')).toBe(true);
  });

  it('withholds only the owner-only ones from a standard admin', () => {
    expect(isTabAllowed(ownerTab, 'standard_admin')).toBe(false);
    expect(isTabAllowed(openTab, 'standard_admin')).toBe(true);
  });
});

describe('visibleTabs — allowed AND built (D9)', () => {
  it('lists exactly the built tabs of a group', () => {
    const collectors = ADMIN_GROUPS.find((g) => g.key === 'collectors')!;
    const keys = visibleTabs(collectors, 'owner').map((t) => t.key);
    // the whole Collectors group is built now
    expect(keys).toEqual(['users', 'activity', 'club']);
  });

  it('never returns a tab without a path', () => {
    for (const group of ADMIN_GROUPS) {
      for (const role of ['owner', 'standard_admin'] as const) {
        for (const t of visibleTabs(group, role)) expect(t.path).not.toBeNull();
      }
    }
  });
});

describe('visibleGroups', () => {
  it('drops a group with nothing renderable in it', () => {
    // All fourteen groups are registered as the panel's map; the ones with a
    // built tab are what the navbar shows. Fourteen, not fifteen: `ADGROUPS`
    // has fifteen entries but `more` is the folded-group MENU, not a group.
    expect(ADMIN_GROUPS.length).toBe(14);
    expect(visibleGroups('owner').map((g) => g.key)).toEqual([
      'catalog',
      'artists',
      'galleries',
      'market',
      'documents',
      'auctions',
      'collectors',
      'sales',
      'projects',
      'operations',
      'owner',
      'system',
    ]);
    // `system` is owner-only, so a standard admin still sees one group
    expect(visibleGroups('standard_admin').map((g) => g.key)).toEqual([
      'catalog',
      'artists',
      'galleries',
      'market',
      'documents',
      'auctions',
      'collectors',
      'sales',
      'projects',
      'operations',
    ]);
  });

  it('drops an owner-only group wholesale for a standard admin', () => {
    const keys = visibleGroups('standard_admin').map((g) => g.key);
    expect(keys).not.toContain('owner');
    expect(keys).not.toContain('system');
  });

  it('splits into the top row and the folded ones', () => {
    const folded = foldedGroups('owner').map((g) => g.key);
    const top = topRowGroups('owner').map((g) => g.key);
    expect(folded).toContain('collectors');
    // no group appears in both rows
    expect(top.filter((k) => folded.includes(k))).toEqual([]);
  });
});

describe('findTab / isPathAllowed', () => {
  it('finds the one built desk in its real group', () => {
    const hit = findTab('/admin/requests');
    expect(hit?.group.key).toBe('collectors');
    expect(hit?.tab.label).toBe('Requests & Activity');
  });

  it('returns null for a path outside the groups', () => {
    // /admin is the Dashboard — a real page, but in NO group (:11832), so the
    // sub-row must not appear on it and findTab answers null.
    expect(findTab('/admin')).toBeNull();
    expect(findTab('/admin/chat')).toBeNull();
    expect(findTab('/admin/nope')).toBeNull();
  });

  it('refuses a path with no tab, so the caller redirects', () => {
    expect(isPathAllowed('/admin/nope', 'owner')).toBe(false);
  });

  it('lets both roles reach a tab that is not owner-only', () => {
    expect(isPathAllowed('/admin/requests', 'owner')).toBe(true);
    expect(isPathAllowed('/admin/requests', 'standard_admin')).toBe(true);
  });
});

describe('firstVisiblePath — the old panel’s clamp, :11815', () => {
  it('lands a role on something it can actually open', () => {
    for (const role of ['owner', 'standard_admin'] as const) {
      const path = firstVisiblePath(role);
      expect(path).not.toBeNull();
      expect(isPathAllowed(path!, role)).toBe(true);
    }
  });
});

describe('asAdminRole — anything but the literal "owner" is a standard admin', () => {
  it('reads the wire value', () => {
    expect(asAdminRole('owner')).toBe('owner');
    expect(asAdminRole('standard_admin')).toBe('standard_admin');
  });

  it('fails to the safe side on null, undefined and nonsense', () => {
    expect(asAdminRole(null)).toBe('standard_admin');
    expect(asAdminRole(undefined)).toBe('standard_admin');
    expect(asAdminRole('Owner')).toBe('standard_admin');
    expect(asAdminRole('')).toBe('standard_admin');
  });
});

describe('the map itself — every registered tab is documented', () => {
  it('gives every tab an api state and an owning phase', () => {
    for (const t of allTabs()) {
      expect(['ready', 'partial', 'none']).toContain(t.api);
      expect(t.phase).toBeTruthy();
    }
  });

  it('explains every tab whose API is not ready', () => {
    // A `none`/`partial` with no note is a trap for whoever builds it next.
    for (const t of allTabs()) {
      if (t.api !== 'ready') expect(t.note, `${t.key} has no note`).toBeTruthy();
    }
  });

  it('never registers a built desk against a missing API', () => {
    for (const t of allTabs()) {
      if (t.path !== null) expect(t.api, `${t.key} is built`).not.toBe('none');
    }
  });

  it('has no duplicate route among built tabs — except the same tab twice', () => {
    // App Design is deliberately in two groups (one screen, two entry points),
    // so /admin/design appears once per group under the same key. Any OTHER
    // collision — two different desks on one route — is a wiring mistake.
    const seen = new Map<string, string>();
    for (const g of ADMIN_GROUPS) {
      for (const t of g.tabs) {
        if (t.path === null) continue;
        const prior = seen.get(t.path);
        if (prior !== undefined) expect(prior).toBe(t.key);
        seen.set(t.path, t.key);
      }
    }
  });

  it('keeps Dashboard and Chat out of every group — they are :11088/:11099', () => {
    const grouped = ADMIN_GROUPS.flatMap((g) => g.tabs).map((t) => t.key);
    expect(grouped).not.toContain('dashboard');
    expect(grouped).not.toContain('chat');
  });

  it('folds exactly the five groups AD_FOLDED names (:11781)', () => {
    const folded = ADMIN_GROUPS.filter((g) => g.folded).map((g) => g.key);
    expect(folded).toEqual(['collectors', 'sales', 'projects', 'intelligence', 'operations']);
  });

  it('marks exactly the three owner groups gold', () => {
    const owner = ADMIN_GROUPS.filter((g) => g.owner).map((g) => g.key);
    expect(owner).toEqual(['social', 'owner', 'system']);
  });

  it('carries App Design in two groups — one screen, two entry points', () => {
    const groups = ADMIN_GROUPS.filter((g) => g.tabs.some((t) => t.key === 'design'));
    expect(groups.map((g) => g.key)).toEqual(['market', 'operations']);
  });
});

describe('the map’s size, stated so a partial port cannot pass quietly', () => {
  it('registers 14 groups and 57 tabs', () => {
    // 14 groups: ADGROUPS' fifteen entries minus `more`, which is the
    // folded-group menu rather than a group of its own.
    expect(ADMIN_GROUPS.length).toBe(14);
    // 55 group tabs + Dashboard + Chat, the two that belong to no group.
    // 53 + the two Exhibition Services tabs the owner asked for on
    // 2026-09-19 (the library, and the one-page issue flow).
    expect(allTabs().length).toBe(57);
  });

  it('counts what is actually built, so progress cannot be overstated', () => {
    const built = allTabs().filter((t) => t.path !== null);
    expect(built.map((t) => t.key)).toEqual([
      'dashboard',
      'chat',
      'database',
      'import',
      'artists',
      'galleries',
      'sources',
      'exhservices',
      'issue',
      'market',
      'design',
      'docProposals',
      'docInvoices',
      'docFiles',
      'auctions',
      'records',
      'aucReg',
      'users',
      'activity',
      'club',
      'marketSales',
      'projDash',
      'projList',
      'projPipeline',
      'projPackages',
      'projCalc',
      'projPartners',
      'projReports',
      'design',
      'health',
      'team',
      'accounting',
      'settings',
      'memberships',
      'system',
    ]);
  });
});
