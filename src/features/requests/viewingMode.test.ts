/** G-P5-10 — the viewing-mode labels come from `GET /api/options/`, never from
 * a copy of the backend's choices kept in this repo. */
import { describe, expect, it } from 'vitest';
import type { OptionsMap } from '../../api/services';
import { viewingModeChoices } from './viewingMode';

describe('viewingModeChoices', () => {
  it('labels each mode from crm.viewing_mode', () => {
    const options = {
      'crm.viewing_mode': [
        { value: 'in_person', label: 'At the gallery' },
        { value: 'virtual', label: 'Video call' },
      ],
    } as unknown as OptionsMap;
    expect(viewingModeChoices(options)).toEqual([
      { value: 'in_person', label: 'At the gallery' },
      { value: 'virtual', label: 'Video call' },
    ]);
  });

  it('falls back to the raw value until the options arrive', () => {
    expect(viewingModeChoices(null)).toEqual([
      { value: 'in_person', label: 'in person' },
      { value: 'virtual', label: 'virtual' },
    ]);
  });

  it('never offers a value the request body cannot carry', () => {
    const options = {
      'crm.viewing_mode': [
        { value: 'in_person', label: 'In person' },
        { value: 'phone', label: 'Phone' },
      ],
    } as unknown as OptionsMap;
    expect(viewingModeChoices(options).map((c) => c.value)).toEqual(['in_person', 'virtual']);
  });
});
