/**
 * SavedProvider — puts one `SavedController` on React context and keeps it in
 * step with the session.
 *
 * Mounted inside `RequireAuth`'d routes only: `/api/crm/saved/` needs a
 * collector session, so there is nothing to read before login. The
 * controller no longer eagerly reads the whole saved set on mount
 * (docs/PHASE_6_API_GAPS.md G-P6-1 — `artwork.is_saved` already answers that
 * per-artwork, server-side); it only needs resetting when the collector logs
 * out or a different one signs in, so this tab's local write-overrides never
 * leak across accounts.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useApi, useSession } from '../../api/hooks';
import { SavedContext } from './savedContext';
import { SavedController } from './SavedController';
import { SavedToast } from './SavedToast';

export function SavedProvider({ children }: { children: ReactNode }) {
  const { crm } = useApi();
  const { isAuthenticated, me } = useSession();
  const [controller] = useState(() => new SavedController(crm));

  // `me` is null until `/auth/me/` resolves; key on the id once we have it so a
  // second collector in the same tab never inherits the first one's overrides.
  const identity = isAuthenticated ? (me?.id ?? 'pending') : null;

  useEffect(() => {
    controller.reset();
  }, [controller, identity]);

  return (
    <SavedContext.Provider value={controller}>
      {children}
      {/* One confirmation surface for every save/unsave in the app. */}
      <SavedToast />
    </SavedContext.Provider>
  );
}
