/**
 * TeamLoginPage — `/admin/login`. The team's own sign-in, a faithful port of
 * app.html's `st.view === 'legacy'` gate card (app.html:2537-2542):
 *
 *   "Darz team sign-in" · **Email** (`you@email.com`) · **Password** (`••••`) ·
 *   **Enter the Room** · the `.e` error line · "← Back to private access".
 *
 * Heading, labels, placeholders, field order and the CTA are verbatim from that
 * block, and every class it uses (`#dzGate`, `.pop`, `.popc`, `.x`, `.h`,
 * `.gate-form`, `.btn2`, `.e`, `.foot`) is one the collector gate already ports,
 * so this screen adds **no CSS at all**.
 *
 * **Why a route, and why no link on the collector gate.** In app.html this card
 * is reachable only by setting `st.view='legacy'`, and nothing in the shipped
 * file ever does: the only `data-act` values present anywhere in it are `signin`
 * and `request` (checked against `darzstudio.art` `development`). The comment at
 * app.html:2227 says the team sign-in "stays behind the small 'Darz team
 * sign-in' link" — but no such link is rendered. So the *card* is approved and
 * exact; its *entry point* is not, and there is nothing to copy. This repo has
 * real URLs (CLAUDE.md § Routing), so the port gives it a route — the same call
 * the owner made in D10 for the request detail — and deliberately does **not**
 * add a link to the collector gate, which would be inventing UI and advertising
 * the admin entrance to collectors at once. Owner: say so if you want the link.
 *
 * The landing (wordmark / "Enter the Room" / beta) is not rendered behind this
 * card. Its whole purpose is the button that opens the collector pop, and a
 * landing stripped of its button would be a thing the old app never had; the
 * card sits on `#dzGate`'s own black instead.
 */
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useApi, useSession } from '../../api/hooks';
import { Input } from '../../components';
import './auth.css';

export function TeamLoginPage() {
  const { auth } = useApi();
  const { isAuthenticated, principal } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Already a team session: straight on to wherever RequireTeam turned them
  // away from, else the desk. Same shape as LoginPage's own redirect.
  if (isAuthenticated && principal === 'team') {
    // Default to the desk index, which clamps to the first page this role can
    // open (the Dashboard now that it exists) — not a hardcoded desk.
    const to = (location.state as { from?: string } | null)?.from ?? '/admin';
    return <Navigate to={to} replace />;
  }

  /* The old gate had two different exits from this card, and they are not the
     same gesture:
       · the × is `closePop` — it shuts the pop and leaves you on the landing;
       · "← Back to private access" is `data-act="signin"`, which switched
         `st.view` *inside* the still-open pop (app.html:2541).
     So the × lands on the collector gate closed, and the footer link lands on
     it with the Private Access card already open. */
  const closeToLanding = () => navigate('/login');
  const backToPrivateAccess = () => navigate('/login', { state: { open: true } });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password || pending) return;
    setPending(true);
    setError(null);
    auth
      .loginTeam(email, password)
      // No activity row here: `POST /api/crm/activity/` is the *collector*
      // activity log (ActivityLogger), and a team principal has no collector
      // to log against — it would 403. Flagged rather than faked.
      .catch((err: Error) => setError(err.message))
      .finally(() => setPending(false));
  };

  return (
    <div id="dzGate">
      <div className="pop">
        <div className="popc" role="dialog" aria-modal="true" aria-label="Darz team sign-in">
          <button type="button" className="x" aria-label="Close" onClick={closeToLanding}>
            ×
          </button>
          <div className="ph">
            <div className="h">Darz team sign-in</div>
          </div>

          <form onSubmit={onSubmit} className="gate-form">
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" className="btn2" disabled={pending || !email || !password}>
              {pending ? 'Entering…' : 'Enter the Room'}
            </button>
            <div className="e" role="alert">
              {error ?? ''}
            </div>
            <div className="foot">
              <a onClick={backToPrivateAccess}>← Back to private access</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
