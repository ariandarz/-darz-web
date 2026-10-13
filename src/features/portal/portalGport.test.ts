/**
 * The post-V1 G-PORT model (backend 2026-10-01): per-work actions + minimum
 * offer (G-PORT-8), the Introduce form (G-PORT-5), the drawn signature's size
 * gate (G-PORT-7), the formatted pricelist's reading of its lines (P3c), and
 * how the desk words an `actions` proposal.
 */
import { describe, expect, it } from 'vitest';
import type { PortalUpdate } from '../../api/types';
import {
  SIGNATURE_MAX_BYTES,
  blankReferral,
  buildActionsProposal,
  buildReferralBody,
  dataUrlBytes,
  historyStateNote,
  offerChanged,
  offerExample,
  priorActions,
  referralTone,
  shownActions,
  signatureAcceptable,
} from './portalForm';
import { describeUpdate } from '../admin/exhibitionForm';
import {
  priceText,
  pricelistFilename,
  pricelistPdfFields,
} from '../admin/pdf/pricelistFields';

const upd = (over: Partial<PortalUpdate>): PortalUpdate => ({
  id: 'u',
  kind: 'actions',
  artwork: 'a1',
  payload: {},
  status: 'pending',
  review_note: '',
  created_at: '2026-10-02T10:00:00Z',
  ...over,
});
const NONE = { actions: null, floor: null };

describe('G-PORT-8 — what collectors can do + minimum offer', () => {
  it('an empty grid sends ["viewing"], never [] — [] means ALL FOUR once applied', () => {
    const body = buildActionsProposal({ offerActions: [] }, NONE);
    expect(body).toEqual({ allowed_actions: ['viewing'] });
  });

  it('sends only what was touched; the Save sends the whole grid as shown', () => {
    expect(buildActionsProposal({}, NONE)).toBeNull();
    expect(buildActionsProposal({ offerFloor: '8,000' }, NONE)).toEqual({
      offer_floor: '8000',
    });
    // Save with nothing touched: the shown set, which untouched is all four
    expect(buildActionsProposal({}, NONE, true)).toEqual({
      allowed_actions: ['purchase', 'hold', 'offer', 'viewing'],
    });
  });

  it('keeps the backend’s order however the boxes were ticked, and drops unknowns', () => {
    const body = buildActionsProposal(
      { offerActions: ['viewing', 'bogus', 'purchase'] },
      NONE,
    );
    expect(body).toEqual({ allowed_actions: ['purchase', 'viewing'] });
  });

  it('an emptied floor is null (no floor); the old digits-only clean otherwise', () => {
    expect(buildActionsProposal({ offerFloor: '' }, { actions: null, floor: '9000' })).toEqual(
      { offer_floor: null },
    );
    expect(buildActionsProposal({ offerFloor: 'T 12,500,000' }, NONE)).toEqual({
      offer_floor: '12500000',
    });
  });

  it('prefills from this portal’s newest pending/approved proposal, key by key', () => {
    const updates = [
      upd({
        id: 'old',
        status: 'approved',
        payload: { allowed_actions: ['purchase', 'offer'], offer_floor: '9000.00' },
        created_at: '2026-10-01T10:00:00Z',
      }),
      // newer, floor only — the actions above still stand
      upd({ id: 'new', payload: { offer_floor: '9500' }, created_at: '2026-10-03T10:00:00Z' }),
      // rejected and other works never count
      upd({ id: 'no', status: 'rejected', payload: { allowed_actions: ['hold'] } }),
      upd({ id: 'other', artwork: 'a2', payload: { allowed_actions: ['hold'] } }),
      upd({ id: 'kind', kind: 'note', payload: { allowed_actions: ['hold'] } }),
    ];
    expect(priorActions(updates, 'a1')).toEqual({
      actions: ['purchase', 'offer'],
      floor: '9500',
    });
    expect(priorActions([], 'a1')).toEqual(NONE);
    // a proposal that cleared the floor reads as no floor
    expect(priorActions([upd({ payload: { offer_floor: null } })], 'a1').floor).toBeNull();
  });

  it('shows the draft, else the last proposal, else all four', () => {
    expect(shownActions({ offerActions: ['hold'] }, NONE)).toEqual(['hold']);
    expect(shownActions({}, { actions: ['offer'], floor: null })).toEqual(['offer']);
    expect(shownActions({}, NONE)).toEqual(['purchase', 'hold', 'offer', 'viewing']);
  });

  it('touching the block is its own change', () => {
    expect(offerChanged({})).toBe(false);
    expect(offerChanged({ offerActions: ['offer'] })).toBe(true);
    expect(offerChanged({ offerFloor: '' })).toBe(true);
  });

  it('the placeholder is ~85% of the price on a clean step (old _offerEx)', () => {
    expect(offerExample('12000.00')).toBe('e.g. 10,000');
    expect(offerExample('95000000')).toBe('e.g. 81,000,000');
    expect(offerExample(null)).toBe('e.g. 80,000,000');
  });

  it('an approved proposal stands in the catalogue — approval applies it', () => {
    expect(historyStateNote({ kind: 'actions', status: 'approved' })).toContain(
      'stands in the Darz catalogue',
    );
  });

  it('the desk words a proposal with the action labels, and an explicit clear', () => {
    const label = (v: string) => ({ purchase: 'Buy', offer: 'Make an offer' })[v] ?? v;
    expect(
      describeUpdate(
        {
          kind: 'actions',
          payload: { allowed_actions: ['purchase', 'offer'], offer_floor: '8000' },
        },
        label,
      ),
    ).toEqual([
      { label: 'Collectors can', to: 'Buy, Make an offer' },
      { label: 'Minimum offer (private)', to: '8,000' },
    ]);
    expect(describeUpdate({ kind: 'actions', payload: { offer_floor: null } })).toEqual([
      { label: 'Minimum offer (private)', to: 'no minimum' },
    ]);
  });
});

describe('G-PORT-5 — the Introduce form', () => {
  it('needs a name; everything else goes trimmed', () => {
    expect(buildReferralBody(blankReferral())).toEqual({
      ok: false,
      error: 'Please enter the name of the person you are introducing.',
    });
    const out = buildReferralBody({
      kind: 'gallery',
      name: '  Ada Lovelace ',
      org: ' Ada Gallery ',
      email: ' ada@x.invalid ',
      phone: '',
      note: ' Met at the fair ',
    });
    expect(out).toEqual({
      ok: true,
      body: {
        referred_kind: 'gallery',
        referred_name: 'Ada Lovelace',
        referred_org: 'Ada Gallery',
        referred_email: 'ada@x.invalid',
        referred_phone: '',
        note: 'Met at the fair',
      },
    });
  });

  it('tones the chip: accepted green, declined red, the rest neutral', () => {
    expect(referralTone('accepted')).toBe('accepted');
    expect(referralTone('declined')).toBe('rejected');
    expect(referralTone('new')).toBe('');
    expect(referralTone('reviewed')).toBe('');
  });
});

describe('G-PORT-7 — the drawn signature’s size gate', () => {
  it('measures decoded bytes from the base64 length', () => {
    expect(dataUrlBytes('data:image/png;base64,QUJD')).toBe(3);
    expect(dataUrlBytes('data:image/png;base64,QUI=')).toBe(2);
    expect(dataUrlBytes('data:image/png;base64,QQ==')).toBe(1);
  });

  it('takes a PNG up to the server’s 2 MB, and nothing else', () => {
    expect(signatureAcceptable('data:image/png;base64,QUJD')).toBe(true);
    expect(signatureAcceptable('data:image/jpeg;base64,QUJD')).toBe(false);
    expect(signatureAcceptable('')).toBe(false);
    const big =
      'data:image/png;base64,' + 'A'.repeat(Math.ceil((SIGNATURE_MAX_BYTES * 4) / 3) + 8);
    expect(signatureAcceptable(big)).toBe(false);
  });
});

describe('P3c — the formatted pricelist reads its lines', () => {
  const works = [
    {
      artwork: 'a1',
      snapshot: {
        artist: 'Sohrab Sepehri',
        title: 'Tree Trunks',
        year: '1974',
        medium: 'Oil on canvas',
        dimensions: '100 x 120 cm',
      },
    },
  ];
  const AVAIL = [{ value: 'available', label: 'Available' }];
  const line = (over: Record<string, unknown>) => ({
    id: 'x',
    artwork: null,
    work_title: '',
    price: null,
    currency: 'USD',
    availability: '',
    note: '',
    position: 0,
    ...over,
  });

  it('resolves an assigned work from the snapshot and splits a typed "Artist — title"', () => {
    const f = pricelistPdfFields(
      {
        title: '',
        notes: 'Prices valid to December',
        lines: [
          line({ position: 1, work_title: 'Behjat Sadr — Untitled', price: '9000.50' }),
          line({
            position: 0,
            artwork: 'a1',
            work_title: 'Sohrab Sepehri — Tree Trunks',
            price: '52000.00',
            availability: 'available',
            note: 'Framed',
          }),
        ],
      },
      'Golestan Gallery',
      works,
      AVAIL,
      new Date('2026-10-13T12:00:00Z'),
    );
    expect(f.eyebrow).toBe('Golestan Gallery');
    expect(f.title).toBe('Pricelist');
    expect(f.intro).toBe('Prices valid to December');
    expect(f.date).toBe('October 2026');
    expect(f.lines).toEqual([
      {
        artist: 'Sohrab Sepehri',
        title: 'Tree Trunks',
        year: '1974',
        details: 'Oil on canvas  ·  100 x 120 cm  ·  Available  ·  Framed',
        price: '52,000',
        currency: 'USD',
      },
      {
        artist: 'Behjat Sadr',
        title: 'Untitled',
        year: '',
        details: '',
        price: '9,000.50',
        currency: 'USD',
      },
    ]);
  });

  it('a line with no price is "on request" — no stray currency', () => {
    const f = pricelistPdfFields(
      { title: 'Autumn', notes: '', lines: [line({ work_title: 'Untitled, 1974' })] },
      'Aria',
      [],
      [],
    );
    expect(f.lines[0]).toMatchObject({
      artist: '',
      title: 'Untitled, 1974',
      price: '',
      currency: '',
    });
    expect(f.title).toBe('Autumn');
  });

  it('prices and file names', () => {
    expect(priceText('52000.00')).toBe('52,000');
    expect(priceText(null)).toBe('');
    expect(pricelistFilename('Golestan Gallery!', new Date('2026-10-13T00:00:00Z'))).toBe(
      'golestan-gallery-pricelist-2026-10.pdf',
    );
    expect(pricelistFilename('گالری', new Date('2026-10-13T00:00:00Z'))).toBe(
      'partner-pricelist-2026-10.pdf',
    );
  });
});
