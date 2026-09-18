/**
 * RequireTeam — the principal-aware guard `routes.tsx` used to call "Phase 7
 * proper" in a TODO beside `/admin/requests`.
 *
 * `RequireAuth` only proves *a* session exists. The admin desk needs the **team**
 * principal specifically: `/api/crm/admin/...` refuses a collector token, so a
 * signed-in collector who reached the desk saw a page of 403s rather than a
 * sign-in prompt. This sends them to the team gate instead, remembering where
 * they were headed the way `RequireAuth` does.
 *
 * No loading state is needed: `ApiProvider` blocks first paint until
 * `session.resume()` has settled, and `resume()` only resolves after
 * `loadMe()`, so by the time this renders `principal` is either known or the
 * session is genuinely dead. The `isAuthenticated && principal === null` case
 * (refresh succeeded, `/auth/me/` did not) is treated as not-a-team-session and
 * sent to the gate — the desk cannot work without knowing the principal.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../../api/hooks';

export function RequireTeam({ children }: { children: ReactNode }) {
  const { isAuthenticated, principal } = useSession();
  const location = useLocation();

  if (!isAuthenticated || principal !== 'team') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
