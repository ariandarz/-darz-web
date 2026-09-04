/**
 * React hooks over the API layer. Kept separate from `ApiProvider.tsx` so
 * that file exports only a component.
 */
import { useContext, useSyncExternalStore } from 'react';
import { ApiContext } from './apiContext';
import type { SessionSnapshot } from './AuthSession';
import type { DarzApi } from './index';

export function useApi(): DarzApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used within <ApiProvider>.');
  return api;
}

/** Subscribes the component to auth-state changes (login, logout, silent
 * refresh) — the same pattern as `useTheme()`. */
export function useSession(): SessionSnapshot & { session: DarzApi['session'] } {
  const { session } = useApi();
  const snapshot = useSyncExternalStore(
    (cb) => session.subscribe(cb),
    () => session.getSnapshot(),
    () => session.getSnapshot(),
  );
  return { ...snapshot, session };
}
