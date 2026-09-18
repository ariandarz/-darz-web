/**
 * Unit tests for the API client — envelope unwrapping, the error hierarchy,
 * the auth lifecycle, and the 401 -> refresh -> retry. `fetch` and
 * `localStorage` are stubbed; no network, no backend.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './ApiClient';
import { AuthSession } from './AuthSession';
import { ConflictError, UnauthorizedError, ValidationError } from './errors';
import { AuthService } from './services';

const BASE = 'http://api.test/api';

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: true, data, message: 'ok', timestamp: '' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function fail(status: number, code: string, message: string, details?: unknown) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message, details }, timestamp: '' }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

class MemStorage {
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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function makeApi(storage = new MemStorage()) {
  const session = new AuthSession(BASE, storage as unknown as Storage);
  const client = new ApiClient(BASE, session);
  return { session, client, storage, auth: new AuthService(client, session) };
}

function headersOf(call: unknown[]): Headers {
  return (call[1] as RequestInit & { headers: Headers }).headers;
}

describe('HttpClient envelope', () => {
  it('unwraps the success envelope to data', async () => {
    fetchMock.mockResolvedValueOnce(ok({ hello: 'world' }));
    const { client } = makeApi();
    await expect(client.send('GET', '/thing/')).resolves.toEqual({ hello: 'world' });
  });

  it('returns undefined for 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { client } = makeApi();
    await expect(client.send('DELETE', '/thing/1/')).resolves.toBeUndefined();
  });

  it('appends query params and repeats arrays', async () => {
    fetchMock.mockResolvedValueOnce(ok([]));
    const { client } = makeApi();
    await client.send('GET', '/artworks/', {
      query: { tag: ['a', 'b'], medium: 'oil', skip: '' },
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://api.test/api/artworks/?tag=a&tag=b&medium=oil',
    );
  });
});

describe('error hierarchy', () => {
  it('maps 409 to ConflictError', async () => {
    fetchMock.mockResolvedValueOnce(fail(409, 'version_conflict', 'Stale.'));
    const { client } = makeApi();
    await expect(client.send('PATCH', '/thing/1/')).rejects.toBeInstanceOf(ConflictError);
  });

  it('maps 400 to ValidationError carrying field errors', async () => {
    fetchMock.mockResolvedValueOnce(
      fail(400, 'invalid', 'Bad.', { email: ['Enter a valid email address.'] }),
    );
    const { client } = makeApi();
    await client.send('POST', '/thing/').then(
      () => expect.unreachable(),
      (err) => {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).fields.email).toEqual([
          'Enter a valid email address.',
        ]);
      },
    );
  });
});

describe('AuthSession lifecycle', () => {
  it('login stores the refresh token, sets access, loads me', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ access: 'a1', refresh: 'r1' })) // collector/login
      .mockResolvedValueOnce(ok({ principal: 'collector', id: 'c1', display_name: 'Jane' })); // me
    const { session, auth, storage } = makeApi();

    const me = await auth.loginCollector('KEY');

    expect(me.display_name).toBe('Jane');
    expect(session.getSnapshot().isAuthenticated).toBe(true);
    expect(storage.getItem('dz-refresh')).toBe('r1');
    expect(headersOf(fetchMock.mock.calls[1]).get('Authorization')).toBe('Bearer a1');
  });

  it('team login posts email + password and lands the team principal', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ access: 'a1', refresh: 'r1' })) // team/login
      .mockResolvedValueOnce(
        ok({ principal: 'team', id: 't1', email: 'ops@darz.art', name: 'Ops' }),
      ); // me
    const { session, auth, storage } = makeApi();

    const me = await auth.loginTeam('ops@darz.art', 'pw');

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/auth/team/login/');
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      email: 'ops@darz.art',
      password: 'pw',
    });
    expect(me.principal).toBe('team');
    // exactly what RequireTeam reads to let anyone near the admin desk
    expect(session.getSnapshot().principal).toBe('team');
    expect(storage.getItem('dz-refresh')).toBe('r1');
  });

  it('team login surfaces the backend message on a bad password', async () => {
    // AuthSession speaks HttpClient directly, so the ApiClient 401 ->
    // refresh -> retry never runs here: the 401 must reach the gate's error
    // line verbatim rather than being swallowed by a refresh attempt.
    fetchMock.mockResolvedValueOnce(
      fail(401, 'authentication_failed', 'Invalid email or password.'),
    );
    const { auth, storage } = makeApi();

    await auth.loginTeam('ops@darz.art', 'wrong').then(
      () => expect.unreachable(),
      (err) => {
        expect(err).toBeInstanceOf(UnauthorizedError);
        expect((err as Error).message).toBe('Invalid email or password.');
      },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storage.getItem('dz-refresh')).toBeNull();
  });

  it('logout blacklists then clears local state', async () => {
    const storage = new MemStorage();
    storage.setItem('dz-refresh', 'r-old');
    fetchMock.mockResolvedValueOnce(ok({})); // logout
    const { session, auth } = makeApi(storage);

    await auth.logout();

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/auth/logout/');
    expect(session.getSnapshot().isAuthenticated).toBe(false);
    expect(storage.getItem('dz-refresh')).toBeNull();
  });
});

describe('401 -> refresh -> retry', () => {
  it('refreshes once and replays the request with the new token', async () => {
    const storage = new MemStorage();
    storage.setItem('dz-refresh', 'r1');
    const { client } = makeApi(storage);

    fetchMock
      .mockResolvedValueOnce(fail(401, 'token_not_valid', 'expired')) // first /data/ call
      .mockResolvedValueOnce(ok({ access: 'a2', refresh: 'r2' })) // token/refresh
      .mockResolvedValueOnce(ok({ ok: true })); // retried /data/ call

    await expect(client.send('GET', '/data/')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/api/auth/token/refresh/');
    expect(headersOf(fetchMock.mock.calls[2]).get('Authorization')).toBe('Bearer a2');
  });

  it('gives up after one failed refresh and surfaces the 401', async () => {
    const storage = new MemStorage();
    storage.setItem('dz-refresh', 'r1');
    const { session, client } = makeApi(storage);

    fetchMock
      .mockResolvedValueOnce(fail(401, 'token_not_valid', 'expired')) // /data/
      .mockResolvedValueOnce(fail(401, 'token_not_valid', 'refresh rejected')); // token/refresh

    await expect(client.send('GET', '/data/')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(session.getSnapshot().isAuthenticated).toBe(false); // session cleared
  });
});
