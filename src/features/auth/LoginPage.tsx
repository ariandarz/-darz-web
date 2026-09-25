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
 * exact screen (2026-09-04), flagged in docs/API_GAP_ANALYSIS.md.
 *
 * **Request access** is real as of 2026-09-18 (backend Phase 34). It used to
 * show a factual note because no endpoint existed; it now ports the old form
 * (app.html:2544-2552) onto `POST /api/auth/access-requests/`, which is public
 * and mints no credential — the submission lands in the admin review queue and
 * a human issues a key. Copy, field order, the `· optional` markers and both
 * validation strings are verbatim from `submitRequest` (:2554-2566).
 *
 * The name + email/phone sign-up that generates a password (the design
 * package's `SCREENS.md` §01 second method) is still **not** ported: the API
 * issues keys through that review queue and has no password generation at all.
 * Owner ruling D4 (2026-09-18) confirmed `app.html`'s Request access is the
 * target here, overriding the standing "the package wins" rule for this one
 * screen, because the package describes something the API cannot do.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApi, useSession } from '../../api/hooks';
import { useActivity } from '../activity/useActivity';
import { Chroma, Input } from '../../components';
import {
  AccessRequestKey,
  accessRequestError,
  readRefCode,
  splitContact,
} from './accessRequest';
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
  const activity = useActivity();
  /* The team gate's "← Back to private access" arrives with `state.open`: in
     the old app that link switched `st.view` inside one already-open pop
     (app.html:2541), so landing on the closed landing would lose a step the
     original never had. */
  const openedFromTeamGate = (location.state as { open?: boolean } | null)?.open === true;
  const [open, setOpen] = useState(openedFromTeamGate);
  const [view, setView] = useState<'signin' | 'request'>('signin');
  const [firstName, setFirstName] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // "Request access" — the five fields of app.html:2546-2550, plus the
  // received panel that replaces the card on success (:2562-2565).
  const [rq, setRq] = useState({ name: '', contact: '', city: '', why: '', how: '' });
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [requestKey] = useState(() => new AccessRequestKey());

  if (isAuthenticated) {
    const to = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={to} replace />;
  }

  const close = () => {
    setOpen(false);
    setView('signin');
    setError(null);
    setSentTo(null);
    setRq({ name: '', contact: '', city: '', why: '', how: '' });
    requestKey.reset();
  };

  /* app.html:2555-2557 — both messages verbatim, checked in the same order,
     before anything is sent. */
  const sendRequest = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const name = rq.name.trim();
    const contact = rq.contact.trim();
    if (!name) return setError('Enter your first name.');
    if (!contact) return setError('Add an email or phone so Darz can reach you.');
    setPending(true);
    setError(null);
    const { email, phone } = splitContact(contact);
    const fields = {
      name,
      email,
      phone,
      city: rq.city.trim(),
      why: rq.why.trim(),
      referral_source: rq.how.trim(),
      ref_code: readRefCode(),
    };
    auth
      // A 201 (filed) and a 200 (the backend replaying the row this key already
      // filed) are both success here — G-P34-1.
      .requestAccess({ ...fields, client_req_id: requestKey.for(fields) })
      .then(() => {
        requestKey.reset();
        // :2563 — the panel greets the first word of what they typed.
        setSentTo(name.split(/\s+/)[0]);
      })
      .catch((err: unknown) => setError(accessRequestError(err)))
      .finally(() => setPending(false));
  };

  /* :2548-2550 — the optional fields carry the marker inside the label. */
  const optional = (text: string): ReactNode => (
    <>
      {text} <span className="opt">· optional</span>
    </>
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!accessKey || pending) return;
    setPending(true);
    setError(null);
    auth
      .loginCollector(accessKey)
      // app.html:2347 — "Signed in · Collector NNN". Fire-and-forget: the
      // gate never waits on it and never fails because of it.
      .then(() => activity.login())
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
                {view === 'signin'
                  ? 'Private Access'
                  : sentTo
                    ? /* :2562 */ 'Request received'
                    : 'Request access'}
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
            ) : sentTo ? (
              /* :2562-2565 — the card is replaced, not appended to. */
              <div className="gate-form">
                <div className="sub rcv">Thank you, {sentTo}. Darz will be in touch.</div>
                <button type="button" className="btn2" onClick={close}>
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={sendRequest} className="gate-form">
                <div className="sub">
                  darzmarket.art is a private collector network.
                  <br />
                  Tell us a little about you and Darz will be in touch.
                </div>
                <Input
                  label="First name"
                  name="rqName"
                  autoComplete="given-name"
                  autoCapitalize="words"
                  placeholder="Your first name"
                  value={rq.name}
                  onChange={(e) => setRq({ ...rq, name: e.target.value })}
                  autoFocus
                />
                <Input
                  label="Email or phone"
                  name="rqContact"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="How Darz can reach you"
                  value={rq.contact}
                  onChange={(e) => setRq({ ...rq, contact: e.target.value })}
                />
                <Input
                  label={optional('City')}
                  name="rqCity"
                  autoCapitalize="words"
                  placeholder="Where you are"
                  value={rq.city}
                  onChange={(e) => setRq({ ...rq, city: e.target.value })}
                />
                <Input
                  label={optional('What you collect')}
                  name="rqWhy"
                  placeholder="A line about how you collect"
                  value={rq.why}
                  onChange={(e) => setRq({ ...rq, why: e.target.value })}
                />
                <Input
                  label={optional('How you heard of Darz')}
                  name="rqHow"
                  placeholder="A gallery, a friend, Instagram…"
                  value={rq.how}
                  onChange={(e) => setRq({ ...rq, how: e.target.value })}
                />
                <button type="submit" className="btn2" disabled={pending}>
                  {pending ? 'Sending…' : 'Send request'}
                </button>
                <div className="e" role="alert">
                  {error ?? ''}
                </div>
                <div className="foot">
                  <a onClick={() => setView('signin')}>← Back to private access</a>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
