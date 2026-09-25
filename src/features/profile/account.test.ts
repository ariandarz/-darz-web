/**
 * The Account card's payload shaping (`PATCH /api/auth/me/`) and its language
 * vocabulary. Node project — no DOM.
 */
import { describe, expect, it } from 'vitest';
import type { Me } from '../../api/AuthSession';
import {
  accountPatch,
  accountValues,
  labelForLanguage,
  languageFromLabel,
  languageOptions,
} from './account';

const ME: Me = {
  principal: 'collector',
  id: 'c1',
  display_name: 'Jane',
  full_name: 'Jane Doe',
  phone: '0912',
  city: null,
  preferred_language: 'fa',
};

describe('accountValues', () => {
  it('reads every field as a string, null as empty', () => {
    expect(accountValues(ME)).toEqual({
      full_name: 'Jane Doe',
      phone: '0912',
      city: '',
      preferred_language: 'fa',
    });
    expect(accountValues(null).full_name).toBe('');
  });
});

describe('accountPatch', () => {
  it('sends only the fields that changed, trimmed', () => {
    expect(accountPatch({ full_name: ' Jane Doe ', city: ' Isfahan ' }, ME)).toEqual({
      city: 'Isfahan',
    });
  });

  it('is empty when nothing changed — no request at all', () => {
    expect(accountPatch(accountValues(ME), ME)).toEqual({});
  });

  it('can clear a field (the serializer allows blank)', () => {
    expect(accountPatch({ phone: '' }, ME)).toEqual({ phone: '' });
  });

  it('never sends a language the backend does not know', () => {
    expect(accountPatch({ preferred_language: 'French' }, ME)).toEqual({});
    expect(accountPatch({ preferred_language: 'en' }, ME)).toEqual({
      preferred_language: 'en',
    });
  });

  it('never carries a field PATCH /auth/me/ does not accept', () => {
    const body = accountPatch(
      { ...accountValues(ME), email: 'x@y.z', display_name: 'X' } as never,
      null,
    );
    expect(Object.keys(body).sort()).toEqual(['full_name', 'phone', 'preferred_language']);
  });
});

describe('languages', () => {
  it('offers the schema enum, labelled in the old app’s words', () => {
    expect(languageOptions(null)).toEqual([
      { value: 'en', label: 'English' },
      { value: 'fa', label: 'Farsi' },
    ]);
  });

  it('takes the label from /api/options/ the day it serves one', () => {
    const opts = { 'accounts.preferred_language': [{ value: 'fa', label: 'فارسی' }] };
    expect(languageOptions(opts)[1]).toEqual({ value: 'fa', label: 'فارسی' });
    expect(languageOptions(opts)[0].label).toBe('English');
  });

  it('maps the questionnaire’s label to the code and back', () => {
    expect(languageFromLabel('Farsi')).toBe('fa');
    expect(languageFromLabel('French')).toBeNull();
    expect(labelForLanguage('en')).toBe('English');
    expect(labelForLanguage('de')).toBe('');
    expect(labelForLanguage(null)).toBe('');
  });
});
