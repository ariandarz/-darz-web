/** The portal's update contract — what `GalleryUpdateService.approve`
 * auto-applies must be spelled exactly, and a plain confirmation must never
 * ask the catalogue for a self-transition. */
import { describe, expect, it } from 'vitest';
import {
  buildNewWorkPayload,
  buildUpdatePayload,
  blankNewWork,
  canEditExhibition,
  exhibitionTotals,
  fmtThousands,
  hasChange,
  portalIsDark,
  prettyMedium,
  updateKind,
} from './portalForm';
import type { PortalExhibition } from '../../api/types';

const work = {
  snapshot: {
    title: 'Night Work I',
    artist: 'Fereydoun Ave',
    price_amount: '12000.00',
    currency: 'USD',
    availability_status: 'available',
  },
};

describe('updateKind — the dominant change (gallery-update.html:1424)', () => {
  it('status change → availability (the auto-applied lane)', () => {
    expect(updateKind({ status: 'sold' }, 'available')).toBe('availability');
  });
  it('price beats correction beats image beats note', () => {
    expect(updateKind({ price: '9,000', needsCorrection: true }, 'available')).toBe('price');
    expect(updateKind({ needsCorrection: true, imageNeedsUpdate: true }, 'available')).toBe(
      'correction',
    );
    expect(updateKind({ imageNeedsUpdate: true, note: 'x' }, 'available')).toBe('image');
    expect(updateKind({ note: 'x' }, 'available')).toBe('note');
  });
  it('no edit at all → the plain availability confirmation', () => {
    expect(updateKind({}, 'available')).toBe('availability');
    expect(hasChange({}, 'available')).toBe(false);
  });
});

describe('buildUpdatePayload — approve() reads these keys', () => {
  it('a status change carries availability_status; a confirmation does not', () => {
    const changed = buildUpdatePayload(work, { status: 'reserved' }, 'Sara');
    expect(changed.availability_status).toBe('reserved');
    expect(changed.fromStatus).toBe('available');
    expect(changed.staff).toBe('Sara');

    const confirm = buildUpdatePayload(work, {}, '');
    expect(confirm.availability_status).toBeUndefined();
    expect(confirm.confirmAvailable).toBe(true);
    expect(confirm).not.toHaveProperty('staff');
  });
  it('price_amount is cleaned of separators; the before-values ride along', () => {
    const p = buildUpdatePayload(work, { price: '9,500,000', currency: 'TMN' }, '');
    expect(p.price_amount).toBe('9500000');
    expect(p.currency).toBe('TMN');
    expect(p.fromPrice).toBe('12000.00');
    expect(p.fromCurrency).toBe('USD');
  });
  it('untouched offer block stays out; a set one rides with its currency', () => {
    expect(buildUpdatePayload(work, {}, '')).not.toHaveProperty('offer_actions');
    const p = buildUpdatePayload(
      work,
      { offerActions: ['offer', 'visit'], offerFloor: '8,000' },
      '',
    );
    expect(p.offer_actions).toEqual(['offer', 'visit']);
    expect(p.offer_floor).toBe('8000');
    expect(p.offer_currency).toBe('USD'); // falls back to the work's currency
  });
});

describe('new-work payload', () => {
  it('formats the price and carries the staff name only when given', () => {
    const n = { ...blankNewWork(1), artist: 'A', price: '12000' };
    expect(buildNewWorkPayload(n, '').price).toBe('12,000');
    expect(buildNewWorkPayload(n, 'Sara').staff).toBe('Sara');
  });
});

describe('exhibition math (gallery-update.html:1511)', () => {
  const cat = [
    { key: 'a', title: 'A', description: '', default_price: 1000 },
    { key: 'b', title: 'B', description: '', default_price: null },
  ];
  const base: PortalExhibition = {
    id: 'x',
    title: 'Show',
    event_date: '',
    venue: '',
    artists: '',
    note: '',
    project: '',
    gallery_note: '',
    gallery_selected: [],
    request_status: 'draft',
    published: false,
    currency: 'TMN',
    discount: '',
    created_at: '',
    service_lines: [],
    documents: [],
  };

  it('unpublished: catalogue defaults price the working selection', () => {
    const t = exhibitionTotals(base, ['a', 'b'], cat);
    expect(t).toMatchObject({ sub: 1000, tot: 1000, count: 2, unpriced: 1 });
  });
  it('published: the composed lines are the truth; declined lines drop; discount subtracts', () => {
    const t = exhibitionTotals(
      {
        ...base,
        published: true,
        discount: '500',
        service_lines: [
          {
            id: '1',
            service_key: 'a',
            title: 'A',
            description: '',
            price: '2000',
            currency: 'TMN',
            status: 'confirmed',
            admin_note: '',
            quantity: 1,
            position: 0,
            created_at: '',
          },
          {
            id: '2',
            service_key: 'b',
            title: 'B',
            description: '',
            price: '999',
            currency: 'TMN',
            status: 'declined',
            admin_note: '',
            quantity: 1,
            position: 1,
            created_at: '',
          },
        ],
      },
      [],
      cat,
    );
    expect(t).toMatchObject({ sub: 2000, disc: 500, tot: 1500, count: 2, unpriced: 0 });
  });
  it('editability mirrors the server guard (draft + requested only)', () => {
    expect(canEditExhibition({ request_status: 'draft' })).toBe(true);
    expect(canEditExhibition({ request_status: 'requested' })).toBe(true);
    expect(canEditExhibition({ request_status: 'approved' })).toBe(false);
  });
});

describe('small pieces', () => {
  it('fmtThousands leaves text alone and formats numbers', () => {
    expect(fmtThousands('12000000')).toBe('12,000,000');
    expect(fmtThousands('on request')).toBe('on request');
  });
  it('prettyMedium opens slug arrays', () => {
    expect(prettyMedium('["works-on-paper","mixed-media"]')).toBe(
      'Works on paper · Mixed media',
    );
  });
  it('portalIsDark reads the blob and tolerates the old plain string', () => {
    expect(portalIsDark({ mode: 'dark' })).toBe(true);
    expect(portalIsDark('dark')).toBe(true);
    expect(portalIsDark({})).toBe(false);
    expect(portalIsDark(null)).toBe(false);
  });
});
