/**
 * AdminLayout — the minimum chrome a signed-in team member needs: who they are,
 * and a way out.
 *
 * Deliberately **not** an admin shell; that is Phase 11 (`docs/TASKLIST.md`).
 * It exists because the admin desk sits outside the collector `AppShell`: a team
 * session has no nav bar, so without this a team member who signs in has no
 * sign-out at all and is stranded in the desk until `localStorage` is cleared by
 * hand.
 *
 * "LEAVE THE ROOM" is the app's own sign-out copy (`SettingsPage`'s `.st-leave`,
 * itself ported from the old app), reused rather than reinvented. The bar is the
 * one piece of new markup in this change — the old admin's real chrome is an
 * entire workspace this repo has not ported — so it is held to a single line and
 * styled in `admin.css` as `.ad-bar`, flagged there as scaffolding.
 */
import { Outlet, useNavigate } from 'react-router-dom';
import { useApi, useSession } from '../../api/hooks';
import './admin.css';

export function AdminLayout() {
  const { auth } = useApi();
  const { me } = useSession();
  const navigate = useNavigate();

  // Same shape as every other sign-out in the app (SettingsPage, ProfilePage,
  // AppShell) — but back to the *team* gate, not the collector one.
  const signOut = () =>
    void auth.logout().finally(() => navigate('/admin/login', { replace: true }));

  /* One wrapper, never a fragment: `#root` is `display:flex; justify-content:
     center`, so two top-level children lay out side by side in a row (the bar
     ended up beside the table, not above it). The collector side never hits
     this because `AppShell` also renders a single element. */
  return (
    <div className="ad-shell">
      <div className="ad-bar">
        <span className="ad-who">
          {me?.name || me?.display_name || me?.email || 'Darz team'}
        </span>
        <button type="button" className="ad-leave" onClick={signOut}>
          LEAVE THE ROOM
        </button>
      </div>
      <Outlet />
    </div>
  );
}
