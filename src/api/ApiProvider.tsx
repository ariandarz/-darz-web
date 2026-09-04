/**
 * `ApiProvider` — puts a single `DarzApi` on React context.
 *
 * The hooks that read it (`useApi`, `useSession`) live in `./hooks` so this
 * file only exports a component (keeps fast-refresh happy).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiContext } from './apiContext';
import { api as defaultApi, DarzApi } from './index';

export function ApiProvider({
  children,
  api = defaultApi,
  /** run `session.resume()` on mount (re-establish a session from the stored
   * refresh token). Set false in tests / storybook. */
  resume = true,
}: {
  children: ReactNode;
  api?: DarzApi;
  resume?: boolean;
}) {
  const [resuming, setResuming] = useState(resume);

  useEffect(() => {
    if (!resume) return;
    let cancelled = false;
    api.session.resume().finally(() => {
      if (!cancelled) setResuming(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api, resume]);

  const value = useMemo(() => api, [api]);
  // Block first paint only while we're checking a stored token, so the app
  // never flashes "logged out" before a valid session resumes.
  if (resuming) return null;
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}
