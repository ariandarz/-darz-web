/**
 * `availabilityLabel` reads the served `catalog.availability_status` choices
 * (V1 Phase 10) and humanises the raw value until they arrive.
 */
import { describe, expect, it } from 'vitest';
import { availabilityLabel } from './format';

describe('availabilityLabel', () => {
  it('prefers the label /api/options/ serves', () => {
    const options = {
      'catalog.availability_status': [
        { value: 'on_hold', label: 'On hold' },
        { value: 'reserved', label: 'Reserved (served)' },
      ],
    };
    expect(availabilityLabel('reserved', options)).toBe('Reserved (served)');
    expect(availabilityLabel('on_hold', options)).toBe('On hold');
  });

  it('humanises the raw value before the options arrive or when they fail', () => {
    expect(availabilityLabel('on_hold', null)).toBe('On hold');
    expect(availabilityLabel('sold', {})).toBe('Sold');
    expect(availabilityLabel('withdrawn')).toBe('Withdrawn');
  });

  it('renders no word for a row without the field', () => {
    expect(availabilityLabel(undefined, {})).toBe('');
    expect(availabilityLabel(null)).toBe('');
  });
});
