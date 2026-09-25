/**
 * PortalSession.enter — how each way an entry read can fail maps onto a phase.
 * The case that matters most is the last: a 5xx used to be rethrown with the
 * phase left on 'opening', freezing the gate on its busy state (C-4).
 */
import { describe, expect, it } from 'vitest';
import { HttpError, NetworkError, UnauthorizedError } from '../../api/errors';
import { PortalSession } from './PortalSession';

function session(state: () => Promise<unknown>) {
  // Only `state` is touched by `enter`; the cast keeps the test from standing
  // up the whole service.
  return new PortalSession({ state } as never, 'tok');
}

describe('PortalSession.enter', () => {
  it('opens on success', async () => {
    const s = session(() => Promise.resolve({ name: 'G' }));
    expect(await s.enter('123456')).toBe(true);
    expect(s.getSnapshot().phase).toBe('ready');
  });

  it('keeps a wrong PIN on the gate with the inline error', async () => {
    const s = session(() =>
      Promise.reject(new UnauthorizedError('unauthorized', 'Incorrect PIN.', null)),
    );
    expect(await s.enter('000000')).toBe(false);
    expect(s.getSnapshot().phase).toBe('gate');
    expect(s.getSnapshot().pinError).not.toBe('');
  });

  it('turns an inactive link or an unknown token dead', async () => {
    const inactive = session(() =>
      Promise.reject(
        new UnauthorizedError('unauthorized', 'This portal link is no longer active.', null),
      ),
    );
    await inactive.enter('123456');
    expect(inactive.getSnapshot().phase).toBe('dead');
    const unknown = session(() => Promise.reject(new HttpError(404, 'not_found', '', null)));
    await unknown.enter('123456');
    expect(unknown.getSnapshot().phase).toBe('dead');
  });

  it('offers a retry on a transport failure', async () => {
    const s = session(() => Promise.reject(new NetworkError()));
    expect(await s.enter('123456')).toBe(false);
    expect(s.getSnapshot().phase).toBe('unreachable');
  });

  it('never leaves the gate busy on an unexpected status (C-4)', async () => {
    for (const status of [500, 400, 429]) {
      const s = session(() =>
        Promise.reject(new HttpError(status, 'INTERNAL_ERROR', 'x', null)),
      );
      expect(await s.enter('123456')).toBe(false);
      expect(s.getSnapshot().phase).toBe('unreachable');
    }
  });
});
