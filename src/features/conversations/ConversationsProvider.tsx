/**
 * ConversationsProvider — one `ConversationsController` on context, polled
 * while a collector session is live and reset on logout / collector switch.
 * Mirrors `SavedProvider` / `AuctionNotificationsProvider`.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useApi, useSession } from '../../api/hooks';
import { ConversationsController } from './ConversationsController';
import { ConversationsContext } from './conversationsContext';

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const { crm } = useApi();
  const { isAuthenticated, me } = useSession();
  const [controller] = useState(() => new ConversationsController(crm));

  const identity = isAuthenticated ? (me?.id ?? 'pending') : null;

  useEffect(() => {
    if (identity === null) {
      controller.reset();
      return;
    }
    controller.start();
    return () => controller.stop();
  }, [controller, identity]);

  return (
    <ConversationsContext.Provider value={controller}>
      {children}
    </ConversationsContext.Provider>
  );
}
