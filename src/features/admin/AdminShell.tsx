/**
 * AdminShell — the panel's real chrome, replacing the one-line scaffolding bar
 * `AdminLayout` carried since the team sign-in landed (its own header called
 * itself *"Deliberately **not** an admin shell; that is Phase 11"*).
 *
 * A faithful port of the old panel's **two-tier navbar**
 * (`darzstudio.art` `darz-studio.html`: markup `:11086-11110`, CSS
 * `:8193-8218`, and `_dzRenderSubnav` `:11828-11846` for the second row's
 * rules). The structure it renders:
 *
 *   row 1  `.ad-tabs`     Dashboard · the unfolded group triggers · More · the
 *                         owner groups (gold, `.ad-gtab--owner`)
 *   row 2  `.ad-subtabs`  the active group's own tabs, behind its label
 *
 * Four rules from `_dzRenderSubnav` that are easy to miss and all ported here:
 *
 *  1. **A folded group's row is prefixed by the More row** plus a separator
 *     (`:11837`), so an admin can move between the folded groups without going
 *     back up to row 1.
 *  2. **A group with one tab and no More row shows no second row at all**
 *     (`:11838`) — *"a single-tab group has nothing to switch between"*.
 *  3. **A page belonging to no group hides the row** (`:11832`). The Dashboard
 *     is the one such page.
 *  4. The group's own label leads the row, as an eyebrow (`:11841`).
 *
 * Everything about *which* tabs exist and who may see them is in `adminNav.ts`,
 * ported from the same file's `ADGROUPS`/`OWNER_ONLY`. This component only
 * renders what that table says.
 *
 * Not ported, deliberately: the old header's `＋ New`, `✓ Confirmed & Saved`
 * and the dark-mode toggle. The first two act on desks this phase has not
 * built, and the third is the old panel's own `html.dz-admindark` switch —
 * this repo's `admin.css` maps the panel's palette onto the app's tokens
 * instead, so the panel already follows the app's skin with no second toggle
 * (see the note in `admin.css`, and `docs/PHASE_11B_PLAN.md` D10).
 */
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DeskBoundary } from './DeskBoundary';
import { useApi, useSession } from '../../api/hooks';
import {
  ADMIN_CHAT,
  ADMIN_HOME,
  asAdminRole,
  findTab,
  foldedGroups,
  topRowGroups,
  visibleTabs,
  type AdminGroup,
  type AdminRole,
} from './adminNav';
import './admin.css';

/** Where a group trigger goes: that group's first tab this role can open. */
function groupHome(group: AdminGroup, role: AdminRole): string {
  return visibleTabs(group, role)[0]?.path ?? '/admin';
}

export function AdminShell() {
  const { auth } = useApi();
  const { me } = useSession();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const role = asAdminRole(me?.role);
  const here = findTab(pathname);
  const folded = foldedGroups(role);
  const top = topRowGroups(role);

  // Same sign-out as every other one in the app (SettingsPage, ProfilePage,
  // AppShell) — but back to the *team* gate, not the collector one.
  const signOut = () =>
    void auth.logout().finally(() => navigate('/admin/login', { replace: true }));

  // :11837 — the More row only exists for a folded group's page.
  const moreRow = here?.group.folded ? folded : [];
  const tabs = here ? visibleTabs(here.group, role) : [];
  // :11838 — one tab and no More row means nothing to switch between.
  const showSubRow = here !== null && (tabs.length > 1 || moreRow.length > 0);

  return (
    <div className="ad-shell">
      <header className="ad-top">
        {/* :11084 — the brand block holds the word "Admin" and nothing else.
            `.ad-brand .w` still has CSS at :8179 but no markup uses it, so the
            shipped header carries no wordmark; adding one would be invention.
            The old block's second tag is a build version (`· v1233`) used to
            check a deploy arrived — this repo has no build-version concept, so
            it is omitted rather than faked. */}
        <div className="ad-brand">
          <span className="tag">Admin</span>
        </div>

        <nav className="ad-tabs" aria-label="Admin sections">
          {/* :11088 / :11099 — the two `.ad-tab0` buttons that belong to no
              group, which is why neither opens a second row (:11832). */}
          {ADMIN_HOME.path !== null && (
            <NavLink
              to={ADMIN_HOME.path}
              /* `end` — /admin is every desk's prefix, and Dashboard must not
                 read active on all of them */
              end
              className={({ isActive }) => `ad-tab0${isActive ? ' is-active' : ''}`}
            >
              {ADMIN_HOME.label}
            </NavLink>
          )}
          {ADMIN_CHAT.path !== null && (
            <NavLink
              to={ADMIN_CHAT.path}
              className={({ isActive }) => `ad-tab0 ad-chattab${isActive ? ' is-active' : ''}`}
              title="Chat — your conversations with collectors"
            >
              {ADMIN_CHAT.label}
            </NavLink>
          )}

          {top.map((g) => (
            <NavLink
              key={g.key}
              to={groupHome(g, role)}
              className={`ad-gtab${g.owner ? ' ad-gtab--owner' : ''}${
                here?.group.key === g.key ? ' is-active' : ''
              }`}
            >
              {g.label}
            </NavLink>
          ))}

          {/* :11098 — More, the trigger for every folded group */}
          {folded.length > 0 && (
            <NavLink
              to={groupHome(folded[0], role)}
              className={`ad-gtab${here?.group.folded ? ' is-active' : ''}`}
              title={folded.map((g) => g.label).join(' · ')}
            >
              More
            </NavLink>
          )}
        </nav>

        <div className="ad-spacer" />

        <div className="ad-actc">
          <span className="ad-who">
            {me?.name || me?.display_name || me?.email || 'Darz team'}
          </span>
          {/* the app's own sign-out copy (`SettingsPage`'s `.st-leave`) */}
          <button type="button" className="ad-leave" onClick={signOut}>
            LEAVE THE ROOM
          </button>
        </div>
      </header>

      {showSubRow && (
        <div className="ad-subtabs">
          {moreRow.length > 0 && (
            <>
              {moreRow.map((g) => (
                <NavLink
                  key={g.key}
                  to={groupHome(g, role)}
                  className={`ad-subtab ad-subtab--more${
                    here?.group.key === g.key ? ' on' : ''
                  }`}
                >
                  {g.label}
                </NavLink>
              ))}
              <span className="ad-subsep" />
            </>
          )}
          <span className="ad-subeyebrow">{here?.group.label}</span>
          {tabs.map((t) => (
            <NavLink
              key={t.key}
              to={t.path!}
              /* query-aware: the Documents group's tabs share one pathname
                 and differ in `?kind=` (the old sticky sub-tab, :11732), so
                 NavLink's pathname-only isActive would light all of them */
              className={({ isActive }) =>
                `ad-subtab${subtabOn(t.path!, tabs, pathname, search, isActive) ? ' on' : ''}`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      )}

      {/* The desk, behind the boundary that keeps a thrown render from taking
          the navbar and every other desk down with it — see DeskBoundary for
          the four times that happened. Keyed on the location so leaving a
          broken desk clears it. */}
      <DeskBoundary key={pathname}>
        <Outlet />
      </DeskBoundary>
    </div>
  );
}

/** A sub-tab is on when its full path (query included) matches the location.
 * A query-less tab keeps NavLink's own answer — filters and deep links on a
 * desk must not un-light its tab — EXCEPT when a sibling tab claims this
 * exact location (the Documents pattern: three tabs, one pathname, `?kind=`
 * apart). */
function subtabOn(
  tabPath: string,
  siblings: ReadonlyArray<{ path: string | null }>,
  pathname: string,
  search: string,
  isActive: boolean,
): boolean {
  if (tabPath.includes('?')) return tabPath === pathname + search;
  if (!isActive) return false;
  return !siblings.some((o) => o.path !== tabPath && o.path === pathname + search);
}
