/**
 * One tab's write outcome — the kit's two answers (TD-4/TD-5) applied to an
 * inline-edit desk. Every PATCH here carries `expected_version`; a 409 means
 * someone else saved the row first, and the only helpful move is to re-read,
 * so it raises the `ConflictBanner` (whose Reload the tab wires to its list)
 * instead of the plain error line, which would read as "your edit was wrong".
 */
import { useCallback, useState } from 'react';
import { isConflict } from '../kit';

export function useRowWrites(): {
  /** Run a write; resolves to its result, or `undefined` when it failed (the
   * failure is already on screen). */
  run: <T>(write: () => Promise<T>) => Promise<T | undefined>;
  conflict: boolean;
  error: string | null;
  /** Clear both — on Reload, or before a fresh attempt. */
  clear: () => void;
} {
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(write: () => Promise<T>): Promise<T | undefined> => {
    setError(null);
    try {
      return await write();
    } catch (err: unknown) {
      if (isConflict(err)) setConflict(true);
      else setError(err instanceof Error ? err.message : 'Could not save.');
      return undefined;
    }
  }, []);

  const clear = useCallback(() => {
    setConflict(false);
    setError(null);
  }, []);

  return { run, conflict, error, clear };
}
