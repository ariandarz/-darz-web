/**
 * The pure pieces of the gate's "Request access" submission — the old app's
 * `submitRequest` logic (app.html:2554-2566), ported in `./accessRequest`.
 */
import { describe, expect, it } from 'vitest';
import { HttpError, ValidationError } from '../../api/errors';
import {
  AccessRequestKey,
  accessRequestError,
  newClientReqId,
  readRefCode,
  splitContact,
} from './accessRequest';

class MemStorage implements Storage {
  private m = new Map<string, string>();
  getItem = (k: string) => this.m.get(k) ?? null;
  setItem = (k: string, v: string) => void this.m.set(k, v);
  removeItem = (k: string) => void this.m.delete(k);
  clear = () => this.m.clear();
  key = () => null;
  get length() {
    return this.m.size;
  }
}

describe('splitContact — one field, two backend fields (D2)', () => {
  it('routes anything containing @ to email', () => {
    expect(splitContact('a@b.com')).toEqual({ email: 'a@b.com', phone: '' });
  });

  it('routes anything else to phone', () => {
    expect(splitContact('+98 912 000 0000')).toEqual({
      email: '',
      phone: '+98 912 000 0000',
    });
  });

  it('trims, so a stray space does not become the phone number', () => {
    expect(splitContact('  a@b.com  ')).toEqual({ email: 'a@b.com', phone: '' });
    expect(splitContact('  09120000000 ')).toEqual({ email: '', phone: '09120000000' });
  });

  it('is the old crude @ test, not validation — a malformed address still goes to email', () => {
    // app.html:2558 does exactly this; the backend's EmailField is what
    // actually rejects it, and its message is what the gate shows.
    expect(splitContact('not@an@address')).toEqual({
      email: 'not@an@address',
      phone: '',
    });
  });
});

describe('readRefCode — ?ref= then stored, else nothing', () => {
  it('prefers the URL parameter', () => {
    const s = new MemStorage();
    s.setItem('darz_ref', 'stored');
    expect(readRefCode('?ref=gallery-x', s)).toBe('gallery-x');
  });

  it('decodes a percent-escaped value', () => {
    expect(readRefCode('?ref=a%20gallery', new MemStorage())).toBe('a gallery');
  });

  it('falls back to the stored value when the URL has none', () => {
    const s = new MemStorage();
    s.setItem('darz_ref', 'stored');
    expect(readRefCode('?other=1', s)).toBe('stored');
  });

  it('returns empty when there is neither, and when storage is unavailable', () => {
    expect(readRefCode('', new MemStorage())).toBe('');
    expect(readRefCode('', null)).toBe('');
  });

  it('survives a storage that throws (private mode, blocked site data)', () => {
    const hostile = {
      getItem() {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    // requesting access must not depend on localStorage being readable
    expect(() => readRefCode('', hostile)).not.toThrow();
    expect(readRefCode('', hostile)).toBe('');
  });
});

describe('newClientReqId', () => {
  it('has the old app’s shape and is not repeated', () => {
    const a = newClientReqId();
    expect(a).toMatch(/^ar_[a-z0-9]+$/);
    expect(a).not.toBe(newClientReqId());
  });
});

describe('AccessRequestKey — one key per submission, reused on retry (G-P34-1)', () => {
  const values = { name: 'Sara', email: 'sara@example.com', phone: '' };

  it('keeps the key across retries of the same values', () => {
    let n = 0;
    const key = new AccessRequestKey(() => `k${++n}`);
    expect(key.for(values)).toBe('k1');
    expect(key.for({ ...values })).toBe('k1');
  });

  it('mints a new key when any field changes, so a correction is not replayed away', () => {
    let n = 0;
    const key = new AccessRequestKey(() => `k${++n}`);
    key.for(values);
    expect(key.for({ ...values, phone: '+98 912' })).toBe('k2');
  });

  it('ignores field order', () => {
    let n = 0;
    const key = new AccessRequestKey(() => `k${++n}`);
    key.for({ a: '1', b: '2' });
    expect(key.for({ b: '2', a: '1' })).toBe('k1');
  });

  it('starts over after reset', () => {
    let n = 0;
    const key = new AccessRequestKey(() => `k${++n}`);
    key.for(values);
    key.reset();
    expect(key.for(values)).toBe('k2');
  });
});

describe('accessRequestError — what the gate shows on a failure', () => {
  it('replaces the throttle message on a 429 (G-P34-2)', () => {
    const err = new HttpError(
      429,
      'TOO_MANY_REQUESTS',
      'Request was throttled. Expected available in 3587 seconds.',
      null,
    );
    expect(accessRequestError(err)).toBe('Too many attempts — try again shortly.');
  });

  it("keeps the backend's own message otherwise", () => {
    const err = new ValidationError(
      'VALIDATION_ERROR',
      'Enter a valid email address.',
      null,
      {},
    );
    expect(accessRequestError(err)).toBe('Enter a valid email address.');
  });

  it('falls back when there is nothing to say', () => {
    expect(accessRequestError('boom')).toBe('Something went wrong.');
  });
});
