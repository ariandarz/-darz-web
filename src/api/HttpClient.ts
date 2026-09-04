/**
 * HttpClient — the transport base class.
 *
 * Knows the base URL, JSON encoding, and the Darz response envelope; knows
 * nothing about auth (that's `ApiClient`, which extends this). Every response
 * is `{success, data, message, timestamp}` on success or `{success, error:
 * {code, message}, timestamp}` on failure — unwrapped here once so no call
 * site re-parses it (see the CLAUDE.md API-access note).
 */
import {
  ConflictError,
  HttpError,
  NetworkError,
  UnauthorizedError,
  ValidationError,
} from './errors';

export interface RequestOptions {
  /** query params — `undefined`/`null`/`''` entries are dropped; arrays repeat the key */
  query?: Record<
    string,
    string | number | boolean | Array<string | number> | null | undefined
  >;
  /** JSON body */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  message: string;
  timestamp: string;
}

export class HttpClient {
  protected readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  protected get<T>(path: string, opts: RequestOptions = {}) {
    return this.request<T>('GET', path, opts);
  }
  protected post<T>(path: string, opts: RequestOptions = {}) {
    return this.request<T>('POST', path, opts);
  }
  protected patch<T>(path: string, opts: RequestOptions = {}) {
    return this.request<T>('PATCH', path, opts);
  }
  protected delete<T>(path: string, opts: RequestOptions = {}) {
    return this.request<T>('DELETE', path, opts);
  }

  /**
   * Hook for subclasses to add per-request headers (e.g. `Authorization`).
   * Base implementation adds nothing.
   */
  protected async decorate(
    _method: string,
    _path: string,
    headers: Headers,
  ): Promise<Headers> {
    return headers;
  }

  /**
   * Hook for subclasses to react to a response before it is unwrapped — e.g.
   * catch a 401, refresh the token, and signal a retry by returning `true`.
   * Base implementation never retries.
   */
  protected async onResponse(_response: Response, _attempt: number): Promise<boolean> {
    return false;
  }

  protected async request<T>(
    method: string,
    path: string,
    opts: RequestOptions,
    attempt = 0,
  ): Promise<T> {
    const url = this.baseUrl + path + this.queryString(opts.query);

    const headers = new Headers({ Accept: 'application/json', ...opts.headers });
    if (opts.body !== undefined) headers.set('Content-Type', 'application/json');
    await this.decorate(method, path, headers);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
      });
    } catch (cause) {
      throw new NetworkError(undefined, cause);
    }

    if (await this.onResponse(response, attempt)) {
      return this.request<T>(method, path, opts, attempt + 1);
    }

    return this.unwrap<T>(response);
  }

  private async unwrap<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;

    const raw = await response.text();
    const body: unknown = raw ? safeJsonParse(raw) : null;

    if (response.ok && isSuccessEnvelope<T>(body)) return body.data;

    const { code, message } = readError(body);
    switch (response.status) {
      case 401:
        throw new UnauthorizedError(code, message, body);
      case 409:
        throw new ConflictError(code, message, body);
      case 400:
        throw new ValidationError(code, message, body, readFieldErrors(body));
      default:
        throw new HttpError(
          response.status,
          code,
          message || `Request failed (${response.status}).`,
          body,
        );
    }
  }

  private queryString(query: RequestOptions['query']): string {
    if (!query) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const item of value) params.append(key, String(item));
      } else {
        params.append(key, String(value));
      }
    }
    const s = params.toString();
    return s ? `?${s}` : '';
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isSuccessEnvelope<T>(body: unknown): body is SuccessEnvelope<T> {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { success?: unknown }).success === true &&
    'data' in body
  );
}

function readError(body: unknown): { code: string | null; message: string } {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const err = (body as { error?: { code?: string; message?: string } }).error ?? {};
    return { code: err.code ?? null, message: err.message ?? '' };
  }
  return { code: null, message: '' };
}

function readFieldErrors(body: unknown): Record<string, string[]> {
  if (typeof body !== 'object' || body === null || !('error' in body)) return {};
  const details = (body as { error?: { details?: unknown } }).error?.details;
  if (typeof details !== 'object' || details === null) return {};
  const out: Record<string, string[]> = {};
  for (const [field, msgs] of Object.entries(details as Record<string, unknown>)) {
    out[field] = Array.isArray(msgs) ? msgs.map(String) : [String(msgs)];
  }
  return out;
}
