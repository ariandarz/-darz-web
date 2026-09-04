/**
 * LoginPage — the collector sign-in gate. Exact two-step port of app.html's
 * `#dzGate`: a landing screen (wordmark, chroma, tagline, one "Enter the
 * Room" button, beta caption) that opens the "Private Access" form — reusing
 * the existing `Sheet` component rather than a second bespoke card (see
 * CLAUDE.md "Reusing the design system"). auth.css cites the exact source
 * lines for each piece.
 *
 * Copy kept verbatim from the old app: "darzmarket.art", "The Iranian Art
 * Market", "Enter the Room", "Private Access", "Beta version", "Request
 * access". Every field/link app.html:2556-2560 has is present, including
 * "First name" — the exact-copy instruction (owner, 2026-09-04) overrides
 * the earlier decision to drop it.
 *
 * FLAGGED FOR OWNER (not silently decided): `firstName` is captured here but
 * **not sent anywhere** — `CollectorLoginSerializer` takes only `access_key`,
 * and the collector's real name already lives on the `Collector` record. So
 * either (a) it's cosmetic-only (matches the old screen, does nothing), or
 * (b) the backend should accept it and update `display_name` on login. Left
 * as (a) until you decide — see docs/API_GAP_ANALYSIS.md.
 *
 * "Request access" has no backend to submit to (no request-access endpoint
 * exists) — clicking it shows a factual message instead of a fake form, per
 * VOICE_AND_COPY.md ("never a stack trace or a lie — calm and honest").
 */
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApi, useSession } from '../../api/hooks';
import { Button, Chroma, Eyebrow, Input, Sheet } from '../../components';
import './auth.css';

const EYE_SHOW = (
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EYE_HIDE = (
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c7 0 10.5 6 10.5 6a18 18 0 0 1-3.3 4M6.4 7.6A18 18 0 0 0 1.5 12S5 18 12 18a9.6 9.6 0 0 0 4-.85" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M3 3l18 18" />
  </svg>
);

export function LoginPage() {
  const { auth } = useApi();
  const { isAuthenticated } = useSession();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'signin' | 'request'>('signin');
  const [firstName, setFirstName] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (isAuthenticated) {
    const to = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={to} replace />;
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    auth
      .loginCollector(accessKey)
      .catch((err: Error) => setError(err.message))
      .finally(() => setPending(false));
  };

  return (
    <div className="dz-gate-land">
      <div className="dz-gate-title">darzmarket.art</div>
      <Chroma />
      <Eyebrow>The Iranian Art Market</Eyebrow>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Enter the Room
      </Button>
      <p className="dz-gate-beta">Beta version</p>

      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          setView('signin');
        }}
        title={view === 'signin' ? 'Private Access' : 'Request access'}
        subtitle={
          view === 'signin'
            ? 'darzmarket.art is a private collector network. Enter the name and key issued to you.'
            : undefined
        }
      >
        {view === 'signin' ? (
          <form onSubmit={onSubmit}>
            <Input
              label="First name"
              name="firstName"
              autoComplete="given-name"
              autoCapitalize="words"
              placeholder="Your first name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
            />
            <Input
              label="Access key"
              name="accessKey"
              type={revealed ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={32}
              placeholder="••••••"
              inputClassName="code"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              error={error ?? undefined}
              trailing={
                <button
                  type="button"
                  aria-label={revealed ? 'Hide key' : 'Show key'}
                  aria-pressed={revealed}
                  onClick={() => setRevealed((v) => !v)}
                >
                  {revealed ? EYE_HIDE : EYE_SHOW}
                </button>
              }
            />
            <div style={{ marginTop: 16 }}>
              <Button type="submit" variant="primary" block disabled={pending || !accessKey}>
                {pending ? 'Entering…' : 'Enter the Room'}
              </Button>
            </div>
            <p className="dz-gate-foot">
              <a onClick={() => setView('request')}>Request access</a>
            </p>
          </form>
        ) : (
          <div>
            <p className="dz-gate-sub">
              darzmarket.art is invitation-only. Ask your gallery for an access key, or write
              to <a href="mailto:hello@darzmarket.art">hello@darzmarket.art</a>.
            </p>
            <p className="dz-gate-foot">
              <a onClick={() => setView('signin')}>← Back to private access</a>
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
