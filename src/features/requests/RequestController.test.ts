/**
 * Unit tests for RequestController + the amount helpers — the duplicate-submit
 * guard (app.html's `dzGuard`), the action→kind mapping, the confirmation copy,
 * and error surfacing. `CrmService` is a fake; no network.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Artwork, CollectorRequest } from '../../api/types';
import { caretAfterGrouping, digitsBefore, groupDigits, parseAmount } from './amount';
import { columnsFor } from './layout';
import { ACTION_KIND, RequestController, workLine } from './RequestController';

const ARTWORK = {
  id: 'aw1',
  title: 'Untitled (Hexagon)',
  artist: { id: 'ar1', display_name: 'Monir Farmanfarmaian' },
  price_amount: '12000',
  currency: 'USD',
  price_type: 'fixed',
} as unknown as Artwork;

function fakeCrm(over: Partial<{ createRequest: ReturnType<typeof vi.fn> }> = {}) {
  return {
    createRequest: vi.fn(
      async () => ({ id: 'r1', kind: 'purchase' }) as unknown as CollectorRequest,
    ),
    ...over,
  };
}
const make = (crm: ReturnType<typeof fakeCrm>) => new RequestController(crm as never);
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('RequestController — filing an action', () => {
  it('maps every old action verb to the backend request kind', () => {
    expect(ACTION_KIND.buy).toBe('purchase');
    expect(ACTION_KIND.hold).toBe('hold');
    expect(ACTION_KIND.visit).toBe('viewing');
    expect(ACTION_KIND.offer).toBe('offer');
    expect(ACTION_KIND.price).toBe('price');
    expect(ACTION_KIND.information).toBe('information');
  });

  it('posts the request and opens the confirmation with the old copy', async () => {
    const crm = fakeCrm();
    const c = make(crm);

    await c.act(ARTWORK, 'hold');

    expect(crm.createRequest).toHaveBeenCalledWith({ kind: 'hold', artwork: 'aw1' });
    const { confirmation } = c.getSnapshot();
    expect(confirmation?.title).toBe('Hold request received');
    expect(confirmation?.message).toBe(
      'Your hold request has been received. Darz will review availability and get back to you shortly.',
    );
    expect(confirmation?.work).toBe('Monir Farmanfarmaian — Untitled (Hexagon)');
  });

  it('ignores a second tap of the same action while one is in flight', async () => {
    let release!: (v: CollectorRequest) => void;
    const crm = fakeCrm({
      createRequest: vi.fn(
        () =>
          new Promise<CollectorRequest>((res) => {
            release = res;
          }),
      ),
    });
    const c = make(crm);

    const first = c.act(ARTWORK, 'buy');
    await flush();
    expect(c.isPending(RequestController.actKey('aw1', 'buy'))).toBe(true);

    await c.act(ARTWORK, 'buy'); // the double-tap
    expect(crm.createRequest).toHaveBeenCalledTimes(1);

    release({ id: 'r1' } as unknown as CollectorRequest);
    await first;
    expect(c.isPending(RequestController.actKey('aw1', 'buy'))).toBe(false);
  });

  it('lets a different action on the same work through while one is pending', async () => {
    const crm = fakeCrm({
      createRequest: vi.fn(async () => {
        await flush();
        return { id: 'r' } as unknown as CollectorRequest;
      }),
    });
    const c = make(crm);

    await Promise.all([c.act(ARTWORK, 'hold'), c.act(ARTWORK, 'visit')]);

    expect(crm.createRequest).toHaveBeenCalledTimes(2);
  });

  it('sends the offer amount and currency as the request detail', async () => {
    const crm = fakeCrm();
    const c = make(crm);

    await c.offer(ARTWORK, 9500, 'USD');

    expect(crm.createRequest).toHaveBeenCalledWith({
      kind: 'offer',
      artwork: 'aw1',
      detail: { amount: 9500, currency: 'USD' },
    });
    expect(c.getSnapshot().confirmation?.title).toBe('Offer received');
  });

  it('treats a corrected offer as a new action but a repeat as a double-tap', async () => {
    let pendingResolvers: Array<() => void> = [];
    const crm = fakeCrm({
      createRequest: vi.fn(
        () =>
          new Promise<CollectorRequest>((res) => {
            pendingResolvers.push(() => res({ id: 'r' } as unknown as CollectorRequest));
          }),
      ),
    });
    const c = make(crm);

    void c.offer(ARTWORK, 9500, 'USD');
    await flush();
    void c.offer(ARTWORK, 9500, 'USD'); // same amount → refused
    expect(crm.createRequest).toHaveBeenCalledTimes(1);

    void c.offer(ARTWORK, 9600, 'USD'); // corrected amount → allowed
    expect(crm.createRequest).toHaveBeenCalledTimes(2);
    pendingResolvers.forEach((r) => r());
  });

  it('reports a failure and opens no confirmation', async () => {
    const crm = fakeCrm({
      createRequest: vi.fn(async () => {
        throw new Error('Could not reach the server.');
      }),
    });
    const c = make(crm);

    await c.act(ARTWORK, 'visit');

    expect(c.getSnapshot().error).toBe('Could not reach the server.');
    expect(c.getSnapshot().confirmation).toBeNull();
    expect(c.isPending(RequestController.actKey('aw1', 'visit'))).toBe(false);

    c.clearError();
    expect(c.getSnapshot().error).toBeNull();
  });

  it('falls back to the id-free work line when the artist is null', () => {
    expect(workLine({ artist: null, title: 'Heech' })).toBe('Heech');
    expect(workLine({ artist: null, title: '' })).toBe('');
  });
});

describe('amount helpers (app.html DZ.fmtNum / Lib.num)', () => {
  it('groups digits in thousands and drops non-digits', () => {
    expect(groupDigits('12000')).toBe('12,000');
    expect(groupDigits('1a2b3c4')).toBe('1,234');
    expect(groupDigits('000123')).toBe('123');
    expect(groupDigits('')).toBe('');
  });

  it('parses a grouped value back to a number', () => {
    expect(parseAmount('12,000')).toBe(12000);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
    expect(parseAmount(9500)).toBe(9500);
  });

  it('restores the caret by digit count, not by string index', () => {
    // "12|000" → 2 digits before the caret → after grouping "12,000" the caret
    // must sit after "12", i.e. index 2.
    expect(digitsBefore('12000', 2)).toBe(2);
    expect(caretAfterGrouping('12,000', 2)).toBe(2);
    // 3 digits before → past the comma, index 4.
    expect(caretAfterGrouping('12,000', 3)).toBe(4);
  });
});

describe('secondary-action row layout (app.html:9241)', () => {
  it('adapts the column count: 1→1, 2→2, 3→3, 4→2, 5+→3', () => {
    expect(columnsFor(0)).toBe(1);
    expect(columnsFor(1)).toBe(1);
    expect(columnsFor(2)).toBe(2);
    expect(columnsFor(3)).toBe(3);
    expect(columnsFor(4)).toBe(2);
    expect(columnsFor(5)).toBe(3);
    expect(columnsFor(6)).toBe(3);
  });
});
