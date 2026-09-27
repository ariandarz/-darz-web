/**
 * The portal's P1/P3/P4 model (V1 Phase 5): the state guard (C-8), the
 * server-backed pending marks and History (G-PORT-2), the ask / withdraw /
 * image payloads (G-PORT-4 / 6 / 1) and the pricelist builder (P3b).
 */
import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../api/errors';
import type { PortalUpdate, PortalWork } from '../../api/types';
import {
  blankBuilderLine,
  buildAskPayload,
  buildPricelistBody,
  buildWithdrawPayload,
  builderLineErrors,
  coverOf,
  historyNote,
  historyRows,
  historyStateNote,
  historyTitle,
  historyWhat,
  imageFileProblem,
  normalisePortalState,
  pendingCount,
  pendingStamps,
  pricelistStatusLabel,
} from './portalForm';

const WORK: PortalWork = {
  id: 'la1',
  link: 'l1',
  artwork: 'a1',
  snapshot: {
    artist: 'Fereydoun Ave',
    title: 'Night Work I',
    availability_status: 'available',
  },
  image_url: 'https://files.invalid/a1.jpg',
  funnel_status: '',
  created_at: '2026-09-01T10:00:00Z',
};

const upd = (over: Partial<PortalUpdate>): PortalUpdate => ({
  id: 'u1',
  kind: 'availability',
  artwork: 'a1',
  payload: {},
  status: 'pending',
  review_note: '',
  created_at: '2026-09-20T10:00:00Z',
  ...over,
});

const OPTIONS = {
  'gallery.update_kind': [
    { value: 'ask', label: 'Ask about a work' },
    { value: 'withdraw', label: 'Withdraw a work' },
    { value: 'image', label: 'Image' },
  ],
  'catalog.availability_status': [{ value: 'sold', label: 'Sold' }],
};

describe('normalisePortalState — the embedded lists are guarded (C-8)', () => {
  it('turns missing or malformed lists into empty ones, never a throw', () => {
    const s = normalisePortalState({
      id: 'l1',
      name: 'Aria',
      assigned_artworks: null,
      pricelists: { results: [] },
      messages: 'nope',
    });
    expect(s.assigned_artworks).toEqual([]);
    expect(s.pricelists).toEqual([]);
    expect(s.messages).toEqual([]);
    expect(s.updates).toEqual([]);
    expect(s.cover).toBeNull();
    expect(s.name).toBe('Aria');
  });

  it('guards each work’s snapshot + image_url and each pricelist’s lines', () => {
    const s = normalisePortalState({
      assigned_artworks: [{ ...WORK, snapshot: null, image_url: '' }],
      pricelists: [{ id: 'p1', lines: null }],
      updates: [upd({})],
      cover: 'https://files.invalid/a1.jpg',
    });
    expect(s.assigned_artworks[0].snapshot).toEqual({});
    expect(s.assigned_artworks[0].image_url).toBeNull();
    expect(s.pricelists[0].lines).toEqual([]);
    expect(s.updates).toHaveLength(1);
    expect(s.cover).toBe('https://files.invalid/a1.jpg');
  });

  it('survives a non-object answer', () => {
    expect(normalisePortalState(null).assigned_artworks).toEqual([]);
  });
});

describe('coverOf — the header cover and its old caption', () => {
  it('captions the cover with the work it came from', () => {
    expect(coverOf({ cover: WORK.image_url, assigned_artworks: [WORK] })).toEqual({
      url: WORK.image_url,
      caption: 'Fereydoun Ave — Night Work I',
    });
  });
  it('is null without a cover', () => {
    expect(coverOf({ cover: null, assigned_artworks: [WORK] })).toBeNull();
  });
});

describe('the server’s own updates (G-PORT-2)', () => {
  const updates = [
    upd({ id: 'u1', created_at: '2026-09-20T10:00:00Z' }),
    upd({ id: 'u2', created_at: '2026-09-21T10:00:00Z' }),
    upd({ id: 'u3', artwork: 'a2', status: 'approved' }),
    upd({ id: 'u4', artwork: null, kind: 'new' }),
  ];

  it('marks a work Sent with its NEWEST pending stamp; reviewed rows mark nothing', () => {
    expect(pendingStamps(updates)).toEqual({ a1: '2026-09-21T10:00:00Z' });
  });

  it('counts every pending submission for the Pending review tile', () => {
    expect(pendingCount(updates)).toBe(3);
  });

  it('lists History newest first', () => {
    expect(historyRows(updates).map((u) => u.id)[0]).toBe('u2');
  });

  it('names the work, else the payload, else says it left the portal', () => {
    expect(historyTitle(upd({}), [WORK])).toBe('Fereydoun Ave — Night Work I');
    expect(historyTitle(upd({ payload: { artist: 'X', title: 'Y' } }), [])).toBe('X — Y');
    expect(historyTitle(upd({}), [])).toBe('A work no longer in your portal');
    expect(historyTitle(upd({ artwork: null }), [])).toBe('This portal');
  });

  it('says what was asked, with the kind’s words from options', () => {
    expect(historyWhat(upd({ payload: { availability_status: 'sold' } }), OPTIONS)).toBe(
      'Reported as Sold',
    );
    expect(historyWhat(upd({}), OPTIONS)).toBe('Confirmed as current');
    expect(
      historyWhat(
        upd({ kind: 'price', payload: { price_amount: '12000', currency: 'USD' } }),
        OPTIONS,
      ),
    ).toBe('New price 12,000 USD');
    expect(historyWhat(upd({ kind: 'ask' }), OPTIONS)).toBe('Ask about a work');
    // an unregistered kind falls back to its raw value, never a local map
    expect(historyWhat(upd({ kind: 'invoice_signed' }), OPTIONS)).toBe('Invoice signed');
  });

  it('shows an ask’s question and a note as the row’s quote', () => {
    expect(historyNote(upd({ kind: 'ask', payload: { question: ' Is it framed? ' } }))).toBe(
      'Is it framed?',
    );
    expect(historyNote(upd({ payload: { note: 'Hi' } }))).toBe('Hi');
  });

  it('only says “stands in the catalogue” where approval really applies it', () => {
    expect(historyStateNote({ kind: 'price', status: 'approved' })).toContain(
      'Darz catalogue',
    );
    expect(historyStateNote({ kind: 'withdraw', status: 'approved' })).toBe(
      'Darz has dealt with this.',
    );
    expect(historyStateNote({ kind: 'ask', status: 'pending' })).toContain('will review');
    expect(historyStateNote({ kind: 'ask', status: 'rejected' })).toContain('did not adopt');
  });
});

describe('per-work payloads (G-PORT-4 / G-PORT-6)', () => {
  it('an ask carries the trimmed question and the work it is about', () => {
    expect(buildAskPayload(WORK, '  Is it framed?  ', 'Sara')).toEqual({
      artist: 'Fereydoun Ave',
      title: 'Night Work I',
      question: 'Is it framed?',
      staff: 'Sara',
    });
  });

  it('a withdraw names the work and what it was; no staff key when unnamed', () => {
    expect(buildWithdrawPayload(WORK, '')).toEqual({
      artist: 'Fereydoun Ave',
      title: 'Night Work I',
      fromStatus: 'available',
    });
  });
});

describe('imageFileProblem — the replacement photo guard (G-PORT-1)', () => {
  it('accepts an image up to 6 MB', () => {
    expect(imageFileProblem({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toBeNull();
  });
  it('refuses a larger image with the old too-large line', () => {
    expect(imageFileProblem({ type: 'image/png', size: 6 * 1024 * 1024 + 1 })).toBe(
      'That image is too large — use a smaller file.',
    );
  });
  it('refuses a file that is not an image', () => {
    expect(imageFileProblem({ type: 'application/pdf', size: 10 })).toMatch(/not an image/);
  });
});

describe('the pricelist builder (P3b)', () => {
  it('needs at least one line with a work or a title (old “Add at least one work.”)', () => {
    expect(buildPricelistBody([blankBuilderLine(), blankBuilderLine()])).toEqual({
      ok: false,
      error: 'Add at least one work.',
    });
  });

  it('skips blank rows, cleans the price and maps rows back to the screen', () => {
    const out = buildPricelistBody([
      blankBuilderLine(),
      {
        artwork: 'a1',
        title: '',
        price: '12,000',
        currency: 'USD',
        availability: 'available',
        note: ' framed ',
      },
      { ...blankBuilderLine('EUR'), title: 'Untitled, 1974', price: '' },
    ]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.index).toEqual([1, 2]);
    expect(out.body.lines).toEqual([
      {
        artwork: 'a1',
        work_title: '',
        price: '12000',
        currency: 'USD',
        availability: 'available',
        note: 'framed',
      },
      {
        artwork: null,
        work_title: 'Untitled, 1974',
        price: null,
        currency: 'EUR',
        availability: '',
        note: '',
      },
    ]);
  });

  it('reads per-line errors from details.lines back onto the screen rows', () => {
    const err = new ValidationError(
      'VALIDATION_ERROR',
      'Validation failed.',
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          details: {
            lines: [{}, { non_field_errors: ['Each line needs an artwork or a work_title.'] }],
          },
        },
      },
      {},
    );
    expect(builderLineErrors(err, [0, 2])).toEqual({
      2: 'Each line needs an artwork or a work_title.',
    });
    expect(builderLineErrors(new Error('x'), [0])).toEqual({});
  });

  it('labels a pricelist status with the raw value while options lack one (C-14)', () => {
    expect(pricelistStatusLabel(null, 'superseded')).toBe('Superseded');
    expect(pricelistStatusLabel(null, '')).toBe('Submitted');
  });
});
