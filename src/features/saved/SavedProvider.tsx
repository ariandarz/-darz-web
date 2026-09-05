/**
 * SavedProvider — puts one `SavedController` on React context and keeps it in
 * step with the session.
 *
 * Mounted inside `RequireAuth`'d routes only: `/api/crm/saved/` needs a
 * collector session, so there is nothing to read before login. The controller
 * reads the saved set from the server on mount — that read (not any browser
 * storage) is what makes the saved state correct after a refresh — and resets
 * when the collector logs out or a different one signs in.
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
  // second collector in the same tab never inherits the first one's saved set.
  const identity = isAuthenticated ? (me?.id ?? 'pending') : null;

  useEffect(() => {
    if (identity === null) {
      controller.reset();
      return;
    }
    void controller.ensureLoaded();
  }, [controller, identity]);

  return (
    <SavedContext.Provider value={controller}>
      {children}
      {/* One confirmation surface for every save/unsave in the app. */}
      <SavedToast />
    </SavedContext.Provider>
  );
}
