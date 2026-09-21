/**
 * The non-component half of the kit's write feedback — see `feedback.tsx` for
 * what it is for and which old-panel behaviour it ports.
 *
 * Split the way `deskState.ts` is split from the components beside it: a file
 * that exports both a hook and components defeats fast refresh, and the two
 * pieces here are the ones a desk holds rather than renders.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConflictError } from '../../../api/errors';

/** The old `toast()` (`darz-studio.html:7291`) kept its message for 1800ms. */
export const TOAST_MS = 1800;

/**
 * A desk's transient confirmation: `say(...)` after a write lands, `message`
 * into `<DeskToast>`.
 *
 *     const { say, message } = useDeskToast();
 *     …
 *     await service.update(id, body);
 *     say('Saved ✓');
 *     …
 *     <DeskToast message={message} />
 *
 * Deliberately not a context/provider: a desk that wants to confirm a write
 * should have to name the words, and a panel-wide `toast()` invites a desk to
 * announce something from three call sites at once.
 */
export function useDeskToast(): { say: (message: string) => void; message: string | null } {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((next: string) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { say, message };
}

/** Every versioned write can 409; this is the one question to ask of an error. */
export function isConflict(err: unknown): boolean {
  return err instanceof ConflictError;
}
