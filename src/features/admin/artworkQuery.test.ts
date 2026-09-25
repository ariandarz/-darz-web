/**
 * The Database desk's mappings (V1 Phase 4): each old filter control → its
 * query param, a tile link ↔ the desk's opening query, and the publish gate's
 * `missing` list → the old refusal's words.
 */
import { describe, expect, it } from 'vitest';
import { HttpError, ValidationError } from '../../api/errors';
import {
  addedSinceChip,
  artworkQueryFromParams,
  boolFrom,
  boolPick,
  databaseLink,
  imagesPatch,
  imagesPick,
  missingEssentials,
  publishMissing,
  publishRefusalLines,
  recentlyAddedSince,
  sizeChip,
} from './artworkQuery';

describe('the Images select (has_images + duplicate_images)', () => {
  it('maps each pick onto the two params, clearing the other', () => {
    expect(imagesPatch('yes')).toEqual({ has_images: true, duplicate_images: undefined });
    expect(imagesPatch('no')).toEqual({ has_images: false, duplicate_images: undefined });
    expect(imagesPatch('dup')).toEqual({ has_images: undefined, duplicate_images: true });
    expect(imagesPatch(undefined)).toEqual({
      has_images: undefined,
      duplicate_images: undefined,
    });
  });

  it('reads the pick back from the query', () => {
    expect(imagesPick({ duplicate_images: true })).toBe('dup');
    expect(imagesPick({ has_images: true })).toBe('yes');
    expect(imagesPick({ has_images: false })).toBe('no');
    expect(imagesPick({})).toBeUndefined();
  });
});

describe('tri-state boolean selects (gallery_portal, complete, published)', () => {
  it('round-trips true / false / unset', () => {
    for (const v of [true, false, undefined]) expect(boolFrom(boolPick(v))).toBe(v);
  });
});

describe('size and recently added', () => {
  it('labels a size chip with the backend buckets', () => {
    expect(sizeChip('small')).toBe('Size: Small ≤ 50 cm');
    expect(sizeChip('large')).toBe('Size: Large > 120 cm');
  });

  it('is the old 30-day window as an ISO datetime', () => {
    expect(recentlyAddedSince(new Date('2026-09-25T12:00:00Z'))).toBe(
      '2026-08-26T12:00:00.000Z',
    );
  });

  it('chips a created_after by its date', () => {
    expect(addedSinceChip('2026-03-02T00:00:00Z')).toBe('Added since 2 Mar 2026');
    expect(addedSinceChip('nonsense')).toBe('Added since nonsense');
  });
});

describe('tile links ↔ the opening query', () => {
  it('parses every linkable filter, typed', () => {
    const q = artworkQueryFromParams(
      new URLSearchParams(
        'availability_status=sold&published=true&complete=false&duplicate_images=true' +
          '&has_images=false&gallery_portal=true&size=medium&source_type=dealer' +
          '&created_after=2026-08-26T12:00:00.000Z',
      ),
    );
    expect(q).toEqual({
      availability_status: 'sold',
      published: true,
      complete: false,
      duplicate_images: true,
      has_images: false,
      gallery_portal: true,
      size: 'medium',
      source_type: 'dealer',
      created_after: '2026-08-26T12:00:00.000Z',
    });
  });

  it('drops junk values and unknown params rather than sending them', () => {
    expect(
      artworkQueryFromParams(new URLSearchParams('published=yes&size=huge&search=x&page=3')),
    ).toEqual({});
  });

  it('builds a link that parses back to the same query', () => {
    const q = { availability_status: 'on_hold', complete: false } as const;
    const link = databaseLink(q);
    expect(link).toBe('/admin/artworks?availability_status=on_hold&complete=false');
    expect(artworkQueryFromParams(new URLSearchParams(link.split('?')[1]))).toEqual(q);
    expect(databaseLink({})).toBe('/admin/artworks');
  });
});

describe('the publish refusal (G-CAT-8)', () => {
  const gate = (missing: string[]) =>
    new ValidationError('VALIDATION_ERROR', 'Validation failed: …', null, {
      non_field_errors: ['Cannot publish an incomplete listing.'],
      missing,
    });

  it('words the backend tokens the old way, in the old order', () => {
    // backend order is title · size · medium · artist · price · image
    expect(missingEssentials(['title', 'size', 'medium', 'artist', 'price', 'image'])).toEqual(
      [
        'image',
        'size',
        'artist name',
        'title',
        'medium',
        'price (or turn on “Price on request”)',
      ],
    );
  });

  it('lists exactly the missing items, and keeps an unknown token raw', () => {
    expect(missingEssentials(['size', 'image'])).toEqual(['image', 'size']);
    expect(missingEssentials(['frame'])).toEqual(['frame']);
  });

  it('reads `details.missing` off a 400, and nothing off anything else', () => {
    expect(publishMissing(gate(['price']))).toEqual(['price (or turn on “Price on request”)']);
    expect(publishMissing(gate([]))).toBeNull();
    expect(publishMissing(new HttpError(500, null, 'boom', null))).toBeNull();
    expect(publishMissing(new Error('x'))).toBeNull();
  });

  it('is the old popup copy around the list', () => {
    expect(publishRefusalLines(['image', 'size'])).toEqual([
      'This artwork isn’t ready for the Market App yet.',
      'Please complete: image, size.',
      'Collectors only ever see complete listings, so it can’t go live until these are filled.',
    ]);
  });
});
