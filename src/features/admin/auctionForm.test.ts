import { describe, expect, it } from 'vitest';
import type { Auction, LotAdmin } from '../../api/types';
import { DARZ_AUC_TERMS } from '../auctions/terms';
import {
  ESTIMATE_ERROR,
  WINDOW_ERROR,
  auctionDraft,
  auctionDraftError,
  auctionEditable,
  auctionPatch,
  estimateError,
  fromLocalInput,
  lotDraft,
  lotDraftError,
  lotPatch,
  termsForEditing,
  termsForSaving,
  toLocalInput,
  windowError,
} from './auctionForm';

const AUCTION = {
  id: 'a1',
  title: 'Spring',
  description: '',
  currency: 'USD',
  status: 'scheduled',
  starts_at: '2026-10-01T10:00:00Z',
  ends_at: '2026-10-08T10:00:00Z',
  terms: '',
  terms_required: true,
  invite_only: false,
  archived: false,
  cover_image_url: null,
  lots_count: 2,
  version: 4,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
} as unknown as Auction;

const LOT = {
  id: 'l1',
  auction: 'a1',
  artwork: 'w1',
  lot_number: 3,
  opening_amount: '8000.00',
  reserve_amount: null,
  low_estimate: '9000.00',
  high_estimate: '12000.00',
  premium_pct: '20.00',
  currency: 'USD',
  starts_at: '2026-10-01T10:00:00Z',
  ends_at: '2026-10-08T10:00:00Z',
  soft_close_sec: 120,
  status: 'scheduled',
  version: 9,
} as unknown as LotAdmin;

describe('the window check (C-18 — the server does not make it)', () => {
  it('accepts start before end and refuses equal or reversed', () => {
    expect(windowError('2026-10-01T10:00', '2026-10-01T10:01')).toBeNull();
    expect(windowError('2026-10-01T10:00', '2026-10-01T10:00')).toBe(WINDOW_ERROR);
    expect(windowError('2026-10-02T10:00', '2026-10-01T10:00')).toBe(WINDOW_ERROR);
  });
  it('leaves a blank field to the required check', () => {
    expect(windowError('', '2026-10-01T10:00')).toBeNull();
  });
});

describe('the estimate check', () => {
  it('low ≤ high when both are set; separators stripped', () => {
    expect(estimateError('1,000', '2,000')).toBeNull();
    expect(estimateError('2000', '2000')).toBeNull();
    expect(estimateError('3,000', '2,000')).toBe(ESTIMATE_ERROR);
    expect(estimateError('', '2000')).toBeNull();
  });
});

describe('datetime-local ⇄ ISO', () => {
  it('round-trips in the viewer’s zone', () => {
    const iso = '2026-10-01T10:00:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(null)).toBe('');
  });
});

describe('terms — the old default rule (`:32166`)', () => {
  it('opens on the default when blank and stores blank when unchanged', () => {
    expect(termsForEditing('')).toBe(DARZ_AUC_TERMS);
    expect(termsForEditing('Own terms')).toBe('Own terms');
    expect(termsForSaving(`${DARZ_AUC_TERMS}\n`)).toBe('');
    expect(termsForSaving('Own terms')).toBe('Own terms');
  });
});

describe('auctionPatch — only what changed, always the lock', () => {
  it('an untouched draft sends the lock alone', () => {
    expect(auctionPatch(AUCTION, auctionDraft(AUCTION))).toEqual({ expected_version: 4 });
  });
  it('sends the edited fields, terms and the gate', () => {
    const d = {
      ...auctionDraft(AUCTION),
      title: ' Autumn ',
      terms: 'Mine',
      noTermsGate: true,
    };
    d.endsAt = toLocalInput('2026-10-09T10:00:00Z');
    expect(auctionPatch(AUCTION, d)).toEqual({
      expected_version: 4,
      title: 'Autumn',
      ends_at: '2026-10-09T10:00:00.000Z',
      terms: 'Mine',
      terms_required: false,
    });
  });
  it('refuses a reversed window before any request', () => {
    const d = { ...auctionDraft(AUCTION), endsAt: toLocalInput('2026-09-01T10:00:00Z') };
    expect(auctionDraftError(d)).toBe(WINDOW_ERROR);
  });
  it('is editable only while draft or scheduled', () => {
    expect(auctionEditable('draft')).toBe(true);
    expect(auctionEditable('scheduled')).toBe(true);
    expect(auctionEditable('live')).toBe(false);
    expect(auctionEditable('closed')).toBe(false);
    expect(auctionEditable('cancelled')).toBe(false);
  });
});

describe('lotPatch', () => {
  it('an untouched lot sends the lock alone ("8000.00" equals "8000")', () => {
    expect(lotPatch(LOT, lotDraft(LOT))).toEqual({ expected_version: 9 });
  });
  it('sends changed figures as decimal strings, a cleared one as null', () => {
    const d = { ...lotDraft(LOT), opening: '8,500', low: '', reserve: '10000' };
    expect(lotPatch(LOT, d)).toEqual({
      expected_version: 9,
      opening_amount: '8500',
      low_estimate: null,
      reserve_amount: '10000',
    });
  });
  it('refuses low above high and a reversed window', () => {
    expect(lotDraftError({ ...lotDraft(LOT), low: '20000' })).toBe(ESTIMATE_ERROR);
    expect(
      lotDraftError({ ...lotDraft(LOT), endsAt: toLocalInput('2026-09-01T10:00:00Z') }),
    ).toBe(WINDOW_ERROR);
    expect(lotDraftError(lotDraft(LOT))).toBeNull();
  });
});
