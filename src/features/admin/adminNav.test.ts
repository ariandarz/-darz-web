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
  const ownerTab = { key: 'team', label: 'Team', path: '/x', ownerOnly: true };
  const openTab = { key: 'design', label: 'App Design', path: '/y' };

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
  it('drops an unbuilt tab even from the owner', () => {
    const collectors = ADMIN_GROUPS.find((g) => g.key === 'collectors')!;
    const keys = visibleTabs(collectors, 'owner').map((t) => t.key);
    // `users` and `club` have no desk yet; `activity` is /admin/requests
    expect(keys).toEqual(['activity']);
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
    // Every group but Collectors is entirely unbuilt today, so an owner — who
    // is allowed all of them — still sees only the one.
    expect(visibleGroups('owner').map((g) => g.key)).toEqual(['collectors']);
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

  it('returns null for a path outside the table', () => {
    expect(findTab('/admin')).toBeNull();
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
