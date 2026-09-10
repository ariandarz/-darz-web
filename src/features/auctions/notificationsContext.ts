/** React context holding the app's one `AuctionNotificationsController` — its
 * own file so the provider exports only a component and the hook file only
 * hooks (same split as `savedContext.ts`). */
import { createContext } from 'react';
import type { AuctionNotificationsController } from './AuctionNotificationsController';

export const AuctionNotificationsContext =
  createContext<AuctionNotificationsController | null>(null);
