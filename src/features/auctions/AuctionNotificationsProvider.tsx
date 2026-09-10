/**
 * AuctionNotificationsProvider — one `AuctionNotificationsController` on
 * context, started while a collector session is live and stopped on logout /
 * collector switch. Mounted inside `RequireAuth` in `routes.tsx` so the live
 * banner (`AuctionBanner`) and the `/auctions/notifications` page read the
 * same polled state. Mirrors `SavedProvider`.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useApi, useSession } from '../../api/hooks';
import { AuctionBanner } from './AuctionBanner';
import { AuctionNotificationsController } from './AuctionNotificationsController';
import { AuctionNotificationsContext } from './notificationsContext';

export function AuctionNotificationsProvider({ children }: { children: ReactNode }) {
  const { auctions } = useApi();
  const { isAuthenticated, me } = useSession();
  const [controller] = useState(() => new AuctionNotificationsController(auctions));

  const identity = isAuthenticated ? (me?.id ?? 'pending') : null;

  useEffect(() => {
    if (identity === null) {
      controller.stop();
      controller.reset();
      return;
    }
    controller.start();
    return () => controller.stop();
  }, [controller, identity]);

  return (
    <AuctionNotificationsContext.Provider value={controller}>
      {children}
      <AuctionBanner />
    </AuctionNotificationsContext.Provider>
  );
}
