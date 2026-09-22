/**
 * TD-3 — the payee bank block's server-side memory.
 *
 * The cases below are the three failures the bug produced (a second admin gets
 * blanks, a cleared browser loses them, a blank invoice erases the memory) plus
 * the shape guard: `fields` is a JSON blob on the document, so `null`, a
 * string and an array are all things that really arrive (docs/HANDOFF.md §6).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_BANK,
  bankFromFields,
  hasBank,
  newestBank,
  readLocalBank,
  saveLocalBank,
} from './bankDetails';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
}
globalThis.localStorage = new MemoryStorage();

const FULL = { holder: 'Darz', bank: 'Mellat', card: '6104…', iban: 'IR…' };

beforeEach(() => localStorage.clear());

describe('bankFromFields', () => {
  it('reads the block an issued invoice stored', () => {
    expect(bankFromFields({ reference: 'DARZ-SINV-2026-0007', bank: FULL })).toEqual(FULL);
  });

  it('fills the missing fields rather than dropping the block', () => {
    expect(bankFromFields({ bank: { holder: 'Darz' } })).toEqual({
      holder: 'Darz',
      bank: '',
      card: '',
      iban: '',
    });
  });

  it('returns null for every shape `fields` can really be', () => {
    for (const fields of [null, undefined, 'a string', [1, 2], 42, {}, { bank: null }]) {
      expect(bankFromFields(fields)).toBeNull();
    }
    // An array or a string under `bank` is not a block either.
    expect(bankFromFields({ bank: ['Darz'] })).toBeNull();
    expect(bankFromFields({ bank: 'Mellat' })).toBeNull();
  });

  it('treats an all-blank block as no block', () => {
    // An invoice issued with the bank step left empty stores this, and it must
    // not become the memory that overwrites a real one.
    expect(bankFromFields({ bank: EMPTY_BANK })).toBeNull();
    expect(bankFromFields({ bank: { holder: 42, iban: null } })).toBeNull();
  });
});

describe('newestBank', () => {
  it('takes the first document that has one — the list is newest first', () => {
    const older = { holder: 'Old', bank: 'Saman', card: '', iban: '' };
    expect(newestBank([{ fields: { bank: FULL } }, { fields: { bank: older } }])).toEqual(
      FULL,
    );
  });

  it('skips invoices issued without bank details rather than stopping', () => {
    // This is the "a blank invoice erases the memory" failure.
    expect(
      newestBank([
        { fields: {} },
        { fields: { bank: EMPTY_BANK } },
        { fields: { bank: FULL } },
      ]),
    ).toEqual(FULL);
  });

  it('survives a results field that is not a list', () => {
    for (const results of [null, undefined, {}, 'nope']) {
      expect(newestBank(results)).toBeNull();
    }
  });

  it('is null when no invoice has ever carried one', () => {
    expect(newestBank([{ fields: {} }, { fields: {} }])).toBeNull();
  });
});

describe('the device copy', () => {
  it('round-trips', () => {
    saveLocalBank(FULL);
    expect(readLocalBank()).toEqual(FULL);
  });

  it('is empty on a fresh browser — the failure the server seed now covers', () => {
    expect(readLocalBank()).toEqual(EMPTY_BANK);
    expect(hasBank(readLocalBank())).toBe(false);
  });

  it('survives a corrupt value', () => {
    localStorage.setItem('darz_desk_bank_details', '{not json');
    expect(readLocalBank()).toEqual(EMPTY_BANK);
  });
});
