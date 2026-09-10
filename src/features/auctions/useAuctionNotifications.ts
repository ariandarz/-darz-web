/**
 * Hooks over the app's `AuctionNotificationsController`. Kept out of the
 * provider file so that exports only a component (fast-refresh), matching
 * `useSaved.ts`.
 */
import { useContext, useSyncExternalStore } from 'react';
import type { AuctionNotification } from '../../api/types';
import type { ListSnapshot } from '../shared/ListController';
import type { AuctionNotificationsController } from './AuctionNotificationsController';
import { AuctionNotificationsContext } from './notificationsContext';

export function useAuctionNotificationsController(): AuctionNotificationsController {
  const controller = useContext(AuctionNotificationsContext);
  if (!controller) {
    throw new Error(
      'useAuctionNotifications must be used within <AuctionNotificationsProvider>.',
    );
  }
  return controller;
}

type NotificationSnapshot = ListSnapshot<
  AuctionNotification,
  { page?: number; per_page?: number }
>;

/** Subscribes to the polled notification set. */
export function useAuctionNotifications(): NotificationSnapshot & {
  controller: AuctionNotificationsController;
  unread: AuctionNotification[];
  unreadCount: number;
  latestUnread: AuctionNotification | null;
} {
  const controller = useAuctionNotificationsController();
  const snapshot = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  );
  return {
    ...snapshot,
    controller,
    unread: controller.unread(),
    unreadCount: controller.unreadCount(),
    latestUnread: controller.latestUnread(),
  };
}
