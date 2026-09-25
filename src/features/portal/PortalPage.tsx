/**
 * PortalPage — `/portal/:token`, the no-login partner surface, ported from
 * `../DarzStudio/gallery-update.html` (the "Darz · Gallery Update Portal",
 * build 914). Own world: no collector shell, no team guard — the token in
 * the URL plus the six-digit code IS the door, checked server-side on every
 * request (`apps/gallery/views.py`, token+PIN).
 *
 * Flow (old :818-895): entry gate (always-dark welcome card, access code) →
 * the portal. The old page probed the link before the code to greet by name;
 * the new backend has no unauthenticated probe, so the gate greets
 * generically and the name arrives with the first load (G-PORT-10). Wrong
 * code stays on the gate (:891 copy); a dead/expired link gets the terminal
 * card (:560-563); a transport failure gets the retry card (:813 — "the
 * link is fine, so offer a retry rather than blaming the link").
 *
 * Sections (old portnav, v766, and `passport-v1.js::tabs`): Your works ·
 * Status (only with `feat_funnel`, v923) · Pricelists · Messages (unread dot
 * when Darz spoke last, :935) · Exhibitions (§78) · History (§83 — shown
 * once the portal has sent something, the old non-V1 rule). The header
 * carries the cover (`renderCover`, :852-856; `cover` in the state, G-PORT-9)
 * and the dashboard's fourth tile, "Pending review" (:1140), both from the
 * server's own state (G-PORT-2). Tabs the old page grew that still have no
 * backend are ABSENT, not dead: Share/referral (G-PORT-5) and the signed
 * collaboration Agreement (G-PORT-7).
 *
 * Theme: the portal follows ITS LINK's `theme` (old :707/:824), never the
 * app's ThemeController — a gallery's portal looks the same on every device
 * it opens.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { PortalState } from '../../api/types';
import { Toast } from '../../components';
import { PortalSession } from './PortalSession';
import { PortalExhibitions } from './PortalExhibitions';
import { PortalHistory } from './PortalHistory';
import { PortalMessages } from './PortalMessages';
import { PortalPricelists } from './PortalPricelists';
import { PortalStatus } from './PortalStatus';
import { PortalWorks } from './PortalWorks';
import { coverOf, pendingCount, portalIsDark, srcLabels } from './portalForm';
import './portal.css';

const PIN_LENGTH = 6; // apps/gallery/keys.py::PIN_LENGTH (the old page drew 4)

type Section = 'artworks' | 'status' | 'pricelists' | 'messages' | 'exhibition' | 'history';

export function PortalPage() {
  const { token = '' } = useParams();
  const { portal } = useApi();
  const options = useOptions();
  const [session] = useState(() => new PortalSession(portal, token));
  const state = useSyncExternalStore(
    useCallback((fn) => session.subscribe(fn), [session]),
    () => session.getSnapshot(),
  );
  const [toast, setToast] = useState('');
  const notify = useCallback((m: string) => setToast(m), []);

  if (!token) return <DeadCard />;

  if (state.phase === 'gate' || state.phase === 'opening') {
    return (
      <Gate
        busy={state.phase === 'opening'}
        error={state.pinError}
        enterLabel={srcLabels(state.data?.source_type).enter}
        onEnter={(pin) => void session.enter(pin)}
      />
    );
  }
  if (state.phase === 'dead') return <DeadCard />;
  if (state.phase === 'unreachable')
    return <UnreachableCard onRetry={() => session.retry()} />;

  return (
    <Shell
      session={session}
      options={options}
      notify={notify}
      toast={toast}
      onToastDone={() => setToast('')}
    />
  );
}

/* ── entry surfaces ─────────────────────────────────────────────────────── */

/** The shared brand lockup (old .dlock, :371) — "darzmarket" light + ".art"
 * bold is this surface's own mark, a different lockup than the app
 * `<Wordmark>` ("darz" + suffix), so it is drawn here rather than reusing a
 * component that would re-weight it. */
function Dlock({ label }: { label: string }) {
  return (
    <div className="dlock">
      <div className="wm">
        <span>darzmarket</span>
        <b>.art</b>
      </div>
      <span className="seam" />
      <div className="pglabel">{label}</div>
    </div>
  );
}

function Gate({
  busy,
  error,
  enterLabel,
  onEnter,
}: {
  busy: boolean;
  error: string;
  enterLabel: string;
  onEnter: (pin: string) => void;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array<string>(PIN_LENGTH).fill(''));
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const submit = (all: string[]) => {
    const pin = all.join('');
    if (pin.length < PIN_LENGTH) return;
    onEnter(pin);
  };
  // wrong code → clear the boxes (:891). Render-time adjust keyed on the
  // error text (the React "derived reset" pattern), never an effect —
  // only the DOM focus is an external system and stays in one.
  const [seenError, setSeenError] = useState('');
  if (error && error !== seenError) {
    setSeenError(error);
    setDigits(Array<string>(PIN_LENGTH).fill(''));
  }
  useEffect(() => {
    if (error) refs.current[0]?.focus();
  }, [error]);

  return (
    <div className="gp-root dark">
      <div className="land-wrap">
        <div className="land-card">
          <Dlock label="Gallery Update Portal" />
          <h1>Welcome</h1>
          <p className="land-welcome">
            Welcome to your private space with Darz. Confirm which works are still available,
            refine anything that has changed, and share new works — calmly, whenever it suits
            you.
          </p>
          <div className="land-pinwrap">
            <span className="land-pinlab">Your access code</span>
            <div className="pin-row">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  inputMode="numeric"
                  maxLength={1}
                  autoComplete="off"
                  aria-label={`Access code digit ${i + 1}`}
                  value={d}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 1);
                    const next = [...digits];
                    next[i] = v;
                    setDigits(next);
                    if (v && i < PIN_LENGTH - 1) refs.current[i + 1]?.focus();
                    if (next.every(Boolean)) submit(next);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !digits[i] && i > 0)
                      refs.current[i - 1]?.focus();
                    if (e.key === 'Enter') submit(digits);
                  }}
                />
              ))}
            </div>
            <div className="pin-err">{error}</div>
          </div>
          <button
            className="land-btn"
            type="button"
            disabled={busy}
            onClick={() => submit(digits)}
          >
            {busy ? 'Opening…' : enterLabel}
          </button>
          <div className="land-foot">Private link · darzmarket.art</div>
        </div>
      </div>
    </div>
  );
}

function DeadCard() {
  return (
    <div className="gp-root dark">
      <div className="entry-dark">
        <div className="entry-card">
          <Dlock label="Gallery Update Portal" />
          <h1 className="entry-h1">This link is no longer active</h1>
          <p className="entry-msg">
            The update link could not be opened. It may have been deactivated or replaced.
            Please contact Darz for a current link.
          </p>
          <div className="entry-foot">Private link · darzmarket.art</div>
        </div>
      </div>
    </div>
  );
}

function UnreachableCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="gp-root dark">
      <div className="entry-dark">
        <div className="entry-card">
          <Dlock label="Gallery Update Portal" />
          <h1 className="entry-h1">We couldn’t reach the portal</h1>
          <p className="entry-msg">
            This is a connection issue on our side, not your link. Please check your internet
            and try again in a moment.
          </p>
          <button className="entry-btn" type="button" onClick={onRetry}>
            Try again
          </button>
          <div className="entry-foot">Private link · darzmarket.art</div>
        </div>
      </div>
    </div>
  );
}

/* ── the portal proper ──────────────────────────────────────────────────── */

function Shell({
  session,
  options,
  notify,
  toast,
  onToastDone,
}: {
  session: PortalSession;
  options: OptionsMap | null;
  notify: (m: string) => void;
  toast: string;
  onToastDone: () => void;
}) {
  const state = useSyncExternalStore(
    useCallback((fn) => session.subscribe(fn), [session]),
    () => session.getSnapshot(),
  );
  const data = state.data!;
  const L = srcLabels(data.source_type);
  const [section, setSection] = useState<Section>('artworks');
  const staffKey = `darz_portal_staff_${session.token}`;
  // staff name — per-device convenience, exactly the old page (:904); read
  // once at mount in the initializer (storage may be unavailable → empty)
  const [staff, setStaff] = useState(() => {
    try {
      return localStorage.getItem(staffKey) ?? '';
    } catch {
      return '';
    }
  });
  const storeStaff = (v: string) => {
    setStaff(v);
    try {
      localStorage.setItem(staffKey, v);
    } catch {
      /* same */
    }
  };

  useEffect(() => {
    document.title = `${data.name || L.noun} · Darz update portal`;
  }, [data.name, L.noun]);

  // Messages dot: Darz spoke last and the source hasn't answered (:935)
  const msgs = data.messages ?? [];
  const unanswered = msgs.length > 0 && msgs[msgs.length - 1].sender === 'admin';

  const tabs: Array<[Section, string, boolean]> = [
    ['artworks', 'Your works', false],
    ['status', 'Status', false],
    ['pricelists', 'Pricelists', false],
    ['messages', 'Messages', unanswered],
    ['exhibition', 'Exhibitions', false],
    ['history', 'History', false],
  ];
  const visible = tabs.filter(
    ([id]) =>
      (id !== 'status' || data.feat_funnel) && (id !== 'history' || data.updates.length > 0),
  );
  const cover = coverOf(data);

  return (
    <div className={`gp-root${portalIsDark(data.theme) ? ' dark' : ''}`}>
      <header className="top">
        <div className="chroma" />
        <div className="wrap top-inner">
          <div className="mark">
            <span className="wm">
              <span>darzmarket</span>
              <b>.art</b>
            </span>
          </div>
          <div className="top-seam" />
          <div className="eyebrow">{L.eyebrow}</div>
          <h1>{data.name || `Your ${L.noun.toLowerCase()}`}</h1>
          {/* v1166: assignment IS the curation in the new backend — every
              portal is "Chosen by Darz" (there is no all-inventory mode). */}
          <div className="modetag">Chosen by Darz</div>
          {cover && (
            <div className="top-cover">
              <img src={cover.url} alt="" />
              <span className="top-cover-cap">{cover.caption}</span>
            </div>
          )}
          <p className="lede">
            Confirm which works are still available, update anything that has changed, and add
            new works for Darz to consider. Nothing is published — every update is reviewed by
            Darz first.
          </p>
          <p className="lede lede--quiet">
            Works shared with Darz stay available through your own channels. When one is sold,
            reserved or withdrawn, mark it here so it is not presented to a collector.
          </p>
          <div className="who">
            <div className="namebox">
              <label htmlFor="gp-staff">Your name</label>
              <input
                id="gp-staff"
                placeholder="Optional"
                autoComplete="name"
                value={staff}
                onChange={(e) => storeStaff(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="wrap">
        <Dash data={data} />
        <div className="portnav">
          {visible.map(([id, label, dot]) => (
            <button
              key={id}
              type="button"
              className={section === id ? 'on' : ''}
              onClick={() => {
                setSection(id);
                // opening Messages or History refetches the state — a desk
                // reply or review made mid-session must show without a page
                // reload (Exhibitions forces its own fetch the same way)
                if (id === 'messages' || id === 'history') void session.reload();
              }}
            >
              {label}
              {dot && <span className="dot" />}
            </button>
          ))}
        </div>

        {section === 'artworks' && (
          <PortalWorks session={session} options={options} staff={staff} notify={notify} />
        )}
        {section === 'status' && <PortalStatus data={data} options={options} />}
        {section === 'pricelists' && (
          <PortalPricelists session={session} options={options} notify={notify} />
        )}
        {section === 'messages' && <PortalMessages session={session} notify={notify} />}
        {section === 'exhibition' && (
          <PortalExhibitions session={session} options={options} notify={notify} />
        )}
        {section === 'history' && <PortalHistory data={data} options={options} />}
      </div>

      <footer className="ft">darzmarket.art · Private portal</footer>
      <Toast message={toast} open={!!toast} onClose={onToastDone} />
    </div>
  );
}

/** The KPI strip (old renderDash, :1136-1143) — all four tiles; "Pending
 * review" counts the pending rows of the server's `updates[]` (G-PORT-2). */
function Dash({ data }: { data: PortalState }) {
  const works = data.assigned_artworks ?? [];
  const avail = works.filter(
    (w) => (w.snapshot.availability_status ?? 'available') === 'available',
  ).length;
  const gone = works.filter((w) =>
    ['sold', 'withdrawn', 'archived'].includes(w.snapshot.availability_status ?? ''),
  ).length;
  const k: Array<[string, number]> = [
    ['Works assigned', works.length],
    ['Available', avail],
    ['Sold / unavailable', gone],
    ['Pending review', pendingCount(data.updates)],
  ];
  return (
    <div className="dash">
      {k.map(([label, n]) => (
        <div className="kpi" key={label}>
          <div className="n">{n}</div>
          <div className="l">{label}</div>
        </div>
      ))}
    </div>
  );
}
