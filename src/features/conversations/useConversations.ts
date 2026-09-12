/** Hooks over `ConversationsController` / `ThreadController` — the same
 * `useSyncExternalStore` pattern as `useSaved()`. */
import { useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useApi } from '../../api/hooks';
import type {
  ConversationsController,
  ConversationsSnapshot,
} from './ConversationsController';
import { ConversationsContext } from './conversationsContext';
import { ThreadController, type ThreadSnapshot } from './ThreadController';

export function useConversationsController(): ConversationsController {
  const controller = useContext(ConversationsContext);
  if (!controller)
    throw new Error('useConversations must be used within <ConversationsProvider>.');
  return controller;
}

export function useConversations(): ConversationsSnapshot & {
  controller: ConversationsController;
} {
  const controller = useConversationsController();
  const snapshot = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  );
  return { ...snapshot, controller };
}

/** One thread, polled while the component is mounted. */
export function useThread(
  requestId: string,
): ThreadSnapshot & { controller: ThreadController } {
  const { crm } = useApi();
  const conversations = useConversationsController();
  const [controller] = useState(
    () =>
      new ThreadController(crm, requestId, {
        onSeen: (id) => conversations.markSeenLocally(id),
      }),
  );

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  const snapshot = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  );
  return { ...snapshot, controller };
}
