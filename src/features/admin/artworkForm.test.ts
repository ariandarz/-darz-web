import { describe, expect, it } from 'vitest';
import {
  actionOn,
  buildArtworkPayload,
  draftFromArtwork,
  joinProvenance,
  priceProblem,
  provenanceLines,
  toggleAction,
  transitionTargets,
} from './artworkForm';

const ALL = ['purchase', 'hold', 'offer', 'viewing'];

describe('transitionTargets', () => {
  it('mirrors the backend table', () => {
    expect(transitionTargets('available')).toEqual([
      'on_hold',
      'reserved',
      'sold',
      'withdrawn',
      'archived',
    ]);
    expect(transitionTargets('reserved')).toEqual(['available', 'sold']);
    expect(transitionTargets('sold')).toEqual(['archived']);
  });
  it('is empty for terminal and unknown statuses', () => {
    expect(transitionTargets('withdrawn')).toEqual([]);
    expect(transitionTargets('archived')).toEqual([]);
    expect(transitionTargets('nonsense')).toEqual([]);
  });
});

describe('provenance', () => {
  it('splits on newlines, trims, and keeps one empty row for the editor', () => {
    expect(provenanceLines('Darz, Tehran\n\n Private collection ')).toEqual([
      'Darz, Tehran',
      'Private collection',
    ]);
    expect(provenanceLines('')).toEqual(['']);
    expect(provenanceLines(null)).toEqual(['']);
  });
  it('joins back to the old newline-separated plain string', () => {
    expect(joinProvenance(['a', ' ', 'b'])).toBe('a\nb');
  });
});

describe('buildArtworkPayload', () => {
  const base = draftFromArtwork(null);
  it('on_request clears price fields, the server rule mirrored', () => {
    const p = buildArtworkPayload({
      ...base,
      title: 'T',
      price_type: 'on_request',
      price_amount: '100',
      currency: 'USD',
    });
    expect(p.price_amount).toBeNull();
    expect(p.currency).toBeNull();
  });
  it('casts year and empty artist', () => {
    const p = buildArtworkPayload({ ...base, title: 'T', year: '1998', artist: '' });
    expect(p.year).toBe(1998);
    expect(p.artist).toBeNull();
    expect(buildArtworkPayload({ ...base, title: 'T' }).year).toBeNull();
  });
});

describe('priceProblem', () => {
  const base = draftFromArtwork(null);
  it('fixed/estimate need amount and currency', () => {
    expect(priceProblem({ ...base, price_type: 'fixed' })).toMatch(/amount and a currency/);
    expect(
      priceProblem({ ...base, price_type: 'estimate', price_amount: '10', currency: 'USD' }),
    ).toBeNull();
  });
  it('on_request never complains', () => {
    expect(priceProblem({ ...base, price_type: 'on_request' })).toBeNull();
  });
});

describe('allowed_actions empty-means-all', () => {
  it('every action reads as on when the list is empty', () => {
    for (const k of ALL) expect(actionOn([], k)).toBe(true);
    expect(actionOn(['hold'], 'purchase')).toBe(false);
  });
  it('turning one off from the default expands the list', () => {
    expect(toggleAction([], 'hold', ALL).sort()).toEqual(['offer', 'purchase', 'viewing']);
  });
  it('turning the last one back on collapses to the canonical empty list', () => {
    expect(toggleAction(['purchase', 'offer', 'viewing'], 'hold', ALL)).toEqual([]);
  });
});
