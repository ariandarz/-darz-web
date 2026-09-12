/**
 * LoginPage — the private-access gate (SCREENS.md §01, capture `01-gate`).
 * Faithful port of app.html's `#dzGate` (:2550-2600 markup, the `#dzGate`
 * style block): "its own black world (#0A0A0A, Barlow), never skinned".
 *
 *   1. the landing — wordmark `darzmarket.art` (serif 38px), the 64px chroma
 *      rule, "THE IRANIAN ART MARKET", **Enter the Room**, "BETA VERSION";
 *   2. the **Private Access** pop-up (344px card, #141414): "darzmarket.art is
 *      a private collector network. Enter the name and key issued to you." ·
 *      First name · Access key (tracked digits, eye toggle) · **Enter the Room**
 *      · error line · "Request access" footer link.
 *
 * Copy is verbatim. `firstName` is captured but **not sent** —
 * `CollectorLoginSerializer` takes only `access_key` (the collector's name
 * lives on the `Collector` record); kept because the owner asked for the
 * exact screen (2026-09-04), flagged in docs/API_GAP_ANALYSIS.md. "Request
 * access" has no endpoint, so it shows a factual note instead of a fake form.
 * The name + email/phone sign-up that generates a password (the old app's
 * second method) is not ported: the API issues keys, it does not generate
 * passwords (flagged).
 */
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApi, useSession } from '../../api/hooks';
import { Chroma, Input } from '../../components';
import './auth.css';

// app.html EYE_SHOW / EYE_HIDE (:2470 area)
const EYE_SHOW = (
  <svg
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

  const close = () => {
    setOpen(false);
    setView('signin');
    setError(null);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!accessKey || pending) return;
    setPending(true);
    setError(null);
    auth
      .loginCollector(accessKey)
      .catch((err: Error) => setError(err.message))
      .finally(() => setPending(false));
  };

  return (
    <div id="dzGate">
      <div className="land">
        <div className="ttl">darzmarket.art</div>
        <Chroma className="cline" />
        <div className="tag">The Iranian art market</div>
        <div className="lbtns">
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            Enter the Room
          </button>
        </div>
        <div className="beta">Beta version</div>
      </div>

      {open && (
        <div
          className="pop"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="popc" role="dialog" aria-modal="true" aria-label="Private Access">
            <button type="button" className="x" aria-label="Close" onClick={close}>
              ×
            </button>
            <div className="ph">
              <div className="h">
                {view === 'signin' ? 'Private Access' : 'Request access'}
              </div>
            </div>

            {view === 'signin' ? (
              <form onSubmit={onSubmit} className="gate-form">
                <div className="sub">
                  darzmarket.art is a private collector network.
                  <br />
                  Enter the name and key issued to you.
                </div>
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
                  trailing={
                    <button
                      type="button"
                      className="keyeye"
                      aria-label={revealed ? 'Hide key' : 'Show key'}
                      aria-pressed={revealed}
                      onClick={() => setRevealed((v) => !v)}
                    >
                      {revealed ? EYE_HIDE : EYE_SHOW}
                    </button>
                  }
                />
                <button type="submit" className="btn2" disabled={pending || !accessKey}>
                  {pending ? 'Entering…' : 'Enter the Room'}
                </button>
                <div className="e" role="alert">
                  {error ?? ''}
                </div>
                <div className="foot">
                  <a onClick={() => setView('request')}>Request access</a>
                </div>
              </form>
            ) : (
              <div className="gate-form">
                <div className="sub">
                  darzmarket.art is invitation-only. Ask your gallery for an access key, or
                  write to <a href="mailto:hello@darzmarket.art">hello@darzmarket.art</a>.
                </div>
                <div className="foot">
                  <a onClick={() => setView('signin')}>← Back to private access</a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
