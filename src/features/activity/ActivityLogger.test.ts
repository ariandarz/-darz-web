/**
 * ActivityLogger — the four behavioural kinds the backend accepts, the
 * dedupes that keep the log honest, and the rule that a failed call is never
 * anyone's problem.
 */
import { describe, expect, it, vi } from 'vitest';
import { ActivityLogger, type ActivitySink } from './ActivityLogger';

type LogBody = Parameters<ActivitySink['logActivity']>[0];

function make(logActivity = vi.fn(async (_body: LogBody) => ({}) as never)) {
  return { logger: new ActivityLogger({ logActivity }), logActivity };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('ActivityLogger — what it sends', () => {
  it('sends each kind in the shape the backend takes', () => {
    const { logger, logActivity } = make();

    logger.login();
    logger.save('aw1');
    logger.view('aw2');
    logger.search('  moshiri  ');

    expect(logActivity.mock.calls.map((c) => c[0])).toEqual([
      { kind: 'login' },
      { kind: 'save', artwork: 'aw1' },
      { kind: 'view', artwork: 'aw2' },
      { kind: 'search', metadata: { q: 'moshiri' } },
    ]);
  });
});

describe('ActivityLogger — the dedupes', () => {
  it('logs a work as viewed once per session, and again after a reset', () => {
    const { logger, logActivity } = make();

    logger.view('aw1');
    logger.view('aw1');
    logger.view('aw2');
    expect(logActivity).toHaveBeenCalledTimes(2);

    // a different collector in the same tab starts from nothing
    logger.reset();
    logger.view('aw1');
    expect(logActivity).toHaveBeenCalledTimes(3);
  });

  it('ignores an empty search and a term repeated back to back', () => {
    const { logger, logActivity } = make();

    logger.search('');
    logger.search('   ');
    expect(logActivity).not.toHaveBeenCalled();

    logger.search('tanavoli');
    logger.search('tanavoli');
    logger.search('  tanavoli  ');
    expect(logActivity).toHaveBeenCalledTimes(1);

    logger.search('moshiri');
    expect(logActivity).toHaveBeenCalledTimes(2);
  });

  it('never logs a view without an artwork', () => {
    const { logger, logActivity } = make();
    logger.view('');
    expect(logActivity).not.toHaveBeenCalled();
  });
});

describe('ActivityLogger — failure isolation', () => {
  it('swallows a rejection: a lost row never reaches the collector', async () => {
    const rejecting = vi.fn(async () => {
      throw new Error('offline');
    });
    const { logger } = make(rejecting as never);

    expect(() => logger.login()).not.toThrow();
    await flush();
    expect(rejecting).toHaveBeenCalled();
  });

  it('swallows a synchronous throw too — it must never reach the save path', () => {
    const throwing = vi.fn(() => {
      throw new Error('boom');
    });
    const logger = new ActivityLogger({ logActivity: throwing as never });

    expect(() => logger.save('aw1')).not.toThrow();
    expect(throwing).toHaveBeenCalled();
  });
});
