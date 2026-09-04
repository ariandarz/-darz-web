/**
 * Hooks over `SavedController`. Kept out of `SavedProvider.tsx` so that file
 * exports only a component (fast-refresh), matching `api/hooks.ts`.
 */
import { useContext, useSyncExternalStore } from 'react';
import { SavedContext } from './savedContext';
import type { SavedController, SavedSnapshot } from './SavedController';

export function useSavedController(): SavedController {
  const controller = useContext(SavedContext);
  if (!controller) throw new Error('useSaved must be used within <SavedProvider>.');
  return controller;
}

/** Subscribes the component to the saved set — same `useSyncExternalStore`
 * pattern as `useSession()` / `useTheme()`. */
export function useSaved(): SavedSnapshot & { controller: SavedController } {
  const controller = useSavedController();
  const snapshot = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  );
  return { ...snapshot, controller };
}
