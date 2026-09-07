/** Hooks over `RequestController` — same `useSyncExternalStore` pattern as
 * `useSession()` / `useSaved()`. */
import { useContext, useSyncExternalStore } from 'react';
import { RequestContext } from './requestsContext';
import type { RequestController, RequestSnapshot } from './RequestController';

export function useRequestController(): RequestController {
  const controller = useContext(RequestContext);
  if (!controller) throw new Error('useRequests must be used within <RequestProvider>.');
  return controller;
}

export function useRequests(): RequestSnapshot & { controller: RequestController } {
  const controller = useRequestController();
  const snapshot = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  );
  return { ...snapshot, controller };
}
