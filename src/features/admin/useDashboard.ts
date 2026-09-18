/**
 * The Dashboard's one read — `GET /api/dashboard/admin/summary/`.
 *
 * Same shape as `useOptions()` / `useCuratedCount()`: fetch once, `null` until
 * it answers. Unlike those, a failure is **not** swallowed into a neutral
 * value: the desk is nothing but these numbers, so a silent zero would be a
 * dashboard confidently reporting that nothing is waiting. The error surfaces.
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { DashboardSummary } from '../../api/types';

export function useDashboard(): {
  summary: DashboardSummary | null;
  error: string | null;
  reload: () => void;
} {
  const { dashboard } = useApi();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    dashboard.summary().then(
      (data) => alive && setSummary(data),
      (err: unknown) =>
        alive &&
        setError(err instanceof Error ? err.message : 'Could not load the dashboard.'),
    );
    return () => {
      alive = false;
    };
  }, [dashboard, nonce]);

  // clearing the error belongs to the event that causes the change (the
  // Refresh click), not to the effect — a sync setState in an effect cascades
  const reload = useCallback(() => {
    setError(null);
    setNonce((n) => n + 1);
  }, []);
  return { summary, error, reload };
}
