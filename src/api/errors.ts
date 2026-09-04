/**
 * API error hierarchy.
 *
 * One base (`ApiError`) with typed subclasses so call sites can `instanceof`
 * the case they care about (a 401 that means "re-login", a 409 optimistic-lock
 * conflict, a 400 with field errors) instead of sniffing status codes.
 * Mirrors the backend envelope: failures are `{success:false, error:{code,
 * message}}` (see `darzmarket-api/apps/core/exceptions.py`).
 *
 * Note: explicit field declarations + body assignment (no TS parameter
 * properties) — `tsconfig` runs `erasableSyntaxOnly`.
 */

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    // Restore the prototype chain across the TS/ES target boundary.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The request never got a response (offline, DNS, CORS, abort). */
export class NetworkError extends ApiError {
  readonly cause?: unknown;

  constructor(message = 'Could not reach the server.', cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

/** A response arrived, but not a `2xx` / not the success envelope. */
export class HttpError extends ApiError {
  readonly status: number;
  /** the backend's machine `error.code`, when present */
  readonly code: string | null;
  /** the parsed response body, whatever shape it was */
  readonly body: unknown;

  constructor(status: number, code: string | null, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** 401 — the access token is missing/expired and a refresh could not save it.
 * The session is over; the UI should return to login. */
export class UnauthorizedError extends HttpError {
  constructor(code: string | null, message: string, body: unknown) {
    super(401, code, message || 'Your session has expired.', body);
  }
}

/** 400 with per-field validation messages (`{field: [msg, ...]}`). */
export class ValidationError extends HttpError {
  readonly fields: Record<string, string[]>;

  constructor(
    code: string | null,
    message: string,
    body: unknown,
    fields: Record<string, string[]>,
  ) {
    super(400, code, message || 'Some details need fixing.', body);
    this.fields = fields;
  }
}

/** 409 — optimistic-lock / idempotency conflict. */
export class ConflictError extends HttpError {
  constructor(code: string | null, message: string, body: unknown) {
    super(409, code, message || 'This changed since you loaded it.', body);
  }
}
