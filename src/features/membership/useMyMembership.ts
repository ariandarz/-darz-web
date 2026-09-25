/**
 * `GET /api/auth/my-membership/` for the Settings row and the sheet it opens —
 * one read shared by both, re-read after a redeem.
 *
 * `undefined` while it loads, `null` when it failed (a team token 403s, or the
 * network is down). Both render as "no membership", which is the old row's
 * default sub-line — the honest degraded state, never an error on Settings.
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { MyMembership } from '../../api/types';

export function useMyMembership(enabled: boolean): {
  membership: MyMembership | null | undefined;
  reload: () => Promise<MyMembership | null>;
} {
  const { auth } = useApi();
  const [membership, setMembership] = useState<MyMembership | null | undefined>(undefined);

  const reload = useCallback(
    () =>
      auth.myMembership().then(
        (m) => {
          setMembership(m);
          return m;
        },
        () => {
          setMembership(null);
          return null;
        },
      ),
    [auth],
  );

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    auth.myMembership().then(
      (m) => alive && setMembership(m),
      () => alive && setMembership(null),
    );
    return () => {
      alive = false;
    };
  }, [auth, enabled]);

  return { membership, reload };
}
