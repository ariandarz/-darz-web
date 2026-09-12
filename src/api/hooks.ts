/**
 * React hooks over the API layer. Kept separate from `ApiProvider.tsx` so
 * that file exports only a component.
 */
import { useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { OptionsMap } from './services';
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

/** The `GET /api/options/` map — the dropdown/label source of truth (CLAUDE.md,
 * "API access": never a hardcoded label lookup). Cached by `OptionsService`;
 * `null` until it arrives, `{}` if it failed (callers fall back to the raw value). */
export function useOptions(): OptionsMap | null {
  const { options } = useApi();
  const [map, setMap] = useState<OptionsMap | null>(null);
  useEffect(() => {
    let alive = true;
    options.all().then(
      (m) => alive && setMap(m),
      () => alive && setMap({}),
    );
    return () => {
      alive = false;
    };
  }, [options]);
  return map;
}

/** A status label for one request kind from `crm.request_status_by_kind`
 * (a nested `{kind: [{value,label}]}` map inside the options payload). */
export function statusLabel(map: OptionsMap | null, kind: string, status: string): string {
  const byKind = (
    map as unknown as Record<
      string,
      Record<string, Array<{ value: string; label: string }>>
    > | null
  )?.['crm.request_status_by_kind'];
  const hit = byKind?.[kind]?.find((o) => o.value === status);
  return hit?.label ?? status.replace(/_/g, ' ');
}
