/** The Import desk's client-side half — the backend only takes structured rows. */
import { describe, expect, it } from 'vitest';
import { guessMapping, parseCsv, rowsToRecords } from './csv';

describe('parseCsv — RFC 4180', () => {
  it('splits rows and cells', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
  it('handles quoted commas, escaped quotes and embedded newlines', () => {
    expect(parseCsv('"a,1","say ""hi"""\n"line\nbreak",x')).toEqual([
      ['a,1', 'say "hi"'],
      ['line\nbreak', 'x'],
    ]);
  });
  it('handles CRLF and no trailing phantom row', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('guessMapping — Airtable-ish headers land on serializer fields', () => {
  it('maps common spellings', () => {
    expect(guessMapping(['Title', 'Artist', 'Price', 'Size', 'weird-col'])).toEqual([
      'title',
      'artist_name_raw',
      'price_amount',
      'dimensions',
      '',
    ]);
  });
});

describe('rowsToRecords', () => {
  it('drops ignored columns, blank cells and empty rows', () => {
    const rows = [
      ['Work A', 'Ave', ''],
      ['', '', ''],
    ];
    expect(rowsToRecords(rows, ['title', 'artist_name_raw', ''])).toEqual([
      { title: 'Work A', artist_name_raw: 'Ave' },
    ]);
  });
});
