/**
 * ProfilePage — `/profile`. Port of `profileView()` (app.html:9802-9819): the
 * `.phead` (eyebrow "Collector · <tier>", the collector's name) over the
 * segmented anchor bar `.ptabs.seg4` and a body that swaps without rebuilding
 * the shell. The old anchors are Overview · Market · Auctions · Account; v0.1
 * hides Auctions (`features.profileAuctions`) and keeps the rest.
 *
 *   Overview — the numbers that matter as tiles (`profOverviewHTML`, :9527):
 *              Saved · Activity · Messages (Auctions tile hidden), the
 *              "Darz replied to you" banner, recent activity. The
 *              questionnaire ("Get to know you") card is behind
 *              `features.questionnaire` and opens /questionnaire; the
 *              "Curated for you" card is behind `.recommendations`.
 *   Market   — "Your acquisitions" (`dzAcqSectionHTML`, :9685) over Saved
 *              works and "Requests & activity" with filter chips
 *              (`profMarketHTML`, :9704). Buy / Offers chips only appear
 *              when such requests exist (as the old app did).
 *   Account  — the editable account details (`AccountForm`, saved through
 *              `PATCH /api/auth/me/`), the access key, "Your documents"
 *              (`Documents`, `GET /api/documents/`), Continue with Darz,
 *              "Leave the Room" — `profAccountHTML` (:9765-9797), in its order.
 *
 * Overview waits for its numbers: until the conversations and the saved list
 * have answered, the tiles would read "0" for a collector who has works and
 * requests, so the shared `.dz-state` loading line stands in for them.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useSession } from '../../api/hooks';
import type { CollectorRequest, SavedArtwork, SavedArtworkQuery } from '../../api/types';
import { ArtworkCard } from '../catalogue/ArtworkCard';
import '../catalogue/catalogue.css';
import { ConversationRow } from '../conversations/ConversationRow';
import { useConversations } from '../conversations/useConversations';
import { Button, Sheet } from '../../components';
import { AccountForm } from './AccountForm';
import { Acquisitions } from './Acquisitions';
import { Documents } from './Documents';
import { SavedListController } from '../saved/SavedListController';
import { useSaved } from '../saved/useSaved';
import { useListController } from '../shared/useListController';
import { features } from '../shell/features';
import { isQuestionnaireAnswered } from '../questionnaire/QuestionnaireController';
import '../questionnaire/questionnaire.css';
import './profile.css';

type Anchor = 'overview' | 'market' | 'auctions' | 'account';
type Filter = 'all' | 'replied' | 'buy' | 'offer' | 'inquire';

const FILTERS: Array<[Filter, string]> = [
  ['all', 'All'],
  ['replied', 'Replies'],
  ['buy', 'Buy'],
  ['offer', 'Offers'],
  ['inquire', 'Enquiries'],
];

/** `dzActFilterMatch` over the backend kinds. */
function filterMatch(r: CollectorRequest, f: Filter): boolean {
  switch (f) {
    case 'all':
      return true;
    case 'replied':
      return (r.unread_count || 0) > 0 || r.status === 'answered';
    case 'buy':
      return r.kind === 'purchase' || r.kind === 'hold';
    case 'offer':
      return r.kind === 'offer';
    case 'inquire':
      return r.kind === 'information' || r.kind === 'price' || r.kind === 'availability';
  }
}

function TierLabel({ tier }: { tier?: string | null }) {
  if (!tier) return null;
  return <> · {tier.charAt(0).toUpperCase() + tier.slice(1)}</>;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { me, session } = useSession();
  const { auth } = useApi();
  const { controller: conversations, status } = useConversations();

  const tabs: Array<[Anchor, string, boolean]> = [
    ['overview', 'Overview', false],
    ['market', 'Market', conversations.activity().some((r) => (r.unread_count || 0) > 0)],
    ['auctions', 'Auctions', false],
    ['account', 'Account', conversations.unreadTotal() > 0],
  ];
  const visible = tabs.filter(([k]) => k !== 'auctions' || features.profileAuctions);
  const requested = params.get('tab') as Anchor | null;
  const anchor: Anchor =
    requested && visible.some(([k]) => k === requested) ? requested : 'overview';
  const setAnchor = (a: Anchor) =>
    setParams(a === 'overview' ? {} : { tab: a }, { replace: true });

  const display = me?.display_name || me?.name || 'Your profile';

  return (
    <div className="dz-page">
      <div className="phead">
        <p className="eyebrow">
          Collector
          <TierLabel tier={me?.tier} />
        </p>
        <h1 id="pName">{display}</h1>
      </div>
      <div className="ptabs seg4" role="tablist">
        {visible.map(([k, label, dot]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={anchor === k}
            className={anchor === k ? 'on' : ''}
            onClick={() => setAnchor(k)}
          >
            {label}
            {dot && anchor !== k ? <span className="ptab-dot" /> : null}
          </button>
        ))}
      </div>
      <div className="profbody">
        {anchor === 'overview' && <Overview go={setAnchor} />}
        {anchor === 'market' && <Market />}
        {anchor === 'account' && (
          <Account
            onSignOut={() => {
              void auth.logout().finally(() => navigate('/login', { replace: true }));
            }}
            sessionPrincipal={session.principal}
          />
        )}
        {status === 'error' && anchor !== 'account' && (
          <p className="dz-state err">Your activity could not be loaded. Pull to refresh.</p>
        )}
      </div>
    </div>
  );
}

/* ---- Overview (profOverviewHTML, app.html:9527-9608) ---------------------- */
function Overview({ go }: { go: (a: Anchor) => void }) {
  const navigate = useNavigate();
  const { controller, status } = useConversations();
  const saved = useSavedList();
  const acts = controller.activity();
  const unseen = controller.unreadTotal();
  // Derived on every render, deliberately: these lists are a handful of rows,
  // and a `useMemo` keyed on the controller (which never changes) would never
  // recompute — a poll landing while Profile is open would not reach the list.
  const recent = [...controller.conversations(), ...controller.activity()]
    .sort(byNewest)
    .slice(0, 3);
  const sv = saved.state.pagination?.total_count ?? saved.state.results.length;
  // Loading until both reads have answered (an error ends the wait too — the
  // page's own error line covers the conversations, and a saved list that
  // failed simply counts what it has).
  const loading =
    status === 'idle' ||
    status === 'loading' ||
    (saved.state.status === 'loading' && saved.state.pagination === null);

  return (
    <>
      {/* "Get to know you" LEADS the Overview (v927, app.html:9566-9587) —
          deliberately, so Darz can curate around the collector's taste before
          anything else is shown. `theme.showQ` there; `features.questionnaire`
          here. The card's two copy pairs switch on whether a profile has
          already been sent, which is what `useQuestionnaireSent` answers. */}
      {features.questionnaire && <GetToKnowYou />}
      {unseen > 0 && (
        <button type="button" className="ov-pending" onClick={() => navigate('/chat')}>
          <span className="pd" />
          <span className="pb">
            <span className="pt">Darz replied to you</span>
            <span className="ps">
              {unseen} new {unseen === 1 ? 'reply' : 'replies'} · tap to read
            </span>
          </span>
          <span className="pchev">›</span>
        </button>
      )}
      {loading ? (
        <p className="dz-state">Loading…</p>
      ) : (
        <div className="ov">
          <div className="ov-tiles">
            <button type="button" className="ov-tile" onClick={() => go('market')}>
              <span className="n">{sv}</span>
              <span className="l">Saved</span>
              <span className="s">{sv ? 'Works you’re keeping' : 'Tap a heart to save'}</span>
              <span className="chev">›</span>
            </button>
            {features.profileAuctions && (
              <button type="button" className="ov-tile" onClick={() => go('auctions')}>
                <span className="n">0</span>
                <span className="l">Auctions</span>
                <span className="s">Not yet joined</span>
                <span className="chev">›</span>
              </button>
            )}
            <button type="button" className="ov-tile" onClick={() => go('market')}>
              <span className="n">{acts.length}</span>
              <span className="l">Activity</span>
              <span className="s">
                {acts.length ? 'Requests & enquiries' : 'No requests yet'}
              </span>
              <span className="chev">›</span>
            </button>
            <button type="button" className="ov-tile" onClick={() => navigate('/chat')}>
              <span className="n">{unseen || controller.conversations().length}</span>
              <span className="l">Messages</span>
              <span className="s">{unseen ? `${unseen} new from Darz` : 'Talk to Darz'}</span>
              <span className="chev">›</span>
            </button>
          </div>
        </div>
      )}
      {!loading && recent.length > 0 && (
        <>
          <div className="ov-grp">
            <span className="t">Recent activity</span>
            <button type="button" className="a" onClick={() => go('market')}>
              View all →
            </button>
          </div>
          <div className="actlist">
            {recent.map((r) => (
              <ConversationRow key={r.id} request={r} to={rowTo(r)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** The Overview's questionnaire prompt (app.html:9579-9587). Its heading, body
 * and button all change once the collector has sent a profile, which the old
 * app read from its local `qdone` flag; here the server is asked, because the
 * answers live there and a cleared browser must not make a sent profile look
 * unsent. A failed read shows the "not yet" copy — the honest degraded state,
 * and the card still opens the flow either way. */
function GetToKnowYou() {
  const navigate = useNavigate();
  const { recommendations } = useApi();
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    // A never-submitted collector reads 200 `answered: false` (G-P25-1), so the
    // flag decides, not the status; a rejection (an older backend's 404, or a
    // failed read) is simply `false`.
    recommendations.questionnaire().then(
      (saved) => alive && setSent(isQuestionnaireAnswered(saved)),
      () => alive && setSent(false),
    );
    return () => {
      alive = false;
    };
  }, [recommendations]);

  return (
    <div className="qcta-wrap">
      <div className="qcta">
        <div className="qcta-seam" />
        <div className="qcta-lab">Get to know you</div>
        <div className="qcta-h">
          {sent ? 'Your taste, on file.' : 'Help Darz get to know your taste'}
        </div>
        <div className="qcta-p">
          {sent
            ? 'Darz curates around your profile — update it whenever your taste shifts.'
            : 'A few questions about how you collect, so every work Darz prepares feels right for you.'}
        </div>
        <Button block onClick={() => navigate('/questionnaire')}>
          {sent ? 'Review your profile →' : 'Begin your profile →'}
        </Button>
      </div>
    </div>
  );
}

/* ---- Market (profMarketHTML, app.html:9704-9735) -------------------------- */
function Market() {
  const { controller } = useConversations();
  const saved = useSavedList();
  const [filter, setFilter] = useState<Filter>('all');
  const [clearing, setClearing] = useState(false);
  // derived per render — see the note in Overview
  const all = [...controller.conversations(), ...controller.activity()].sort(byNewest);
  const counts = Object.fromEntries(
    FILTERS.map(([f]) => [f, all.filter((r) => filterMatch(r, f)).length]),
  ) as Record<Filter, number>;
  const active: Filter = counts[filter] ? filter : 'all';
  const shown = all.filter((r) => filterMatch(r, active));
  const items = saved.state.results;
  const savedReady = saved.state.status === 'idle' && saved.state.pagination !== null;

  if (savedReady && items.length === 0 && all.length === 0) {
    return (
      <div className="prof-empty">
        <div className="pe-ic">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </div>
        <div className="pe-t">Nothing here yet</div>
        {/* app.html:9733 when the commerce actions are on, the v0.1 line when
            Send Inquiry is the only CTA there is (owner decision D9). */}
        <div className="pe-s">
          {features.commerceActions
            ? 'Save a work, request a price, or make an offer — it all gathers here.'
            : 'Save a work or send an inquiry — it all gathers here.'}
        </div>
        <div className="pe-b">
          <Link to="/" className="btn primary">
            Browse the collection →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Acquisitions requests={all} to={rowTo} />
      {items.length > 0 && (
        <>
          <div className="prof-sech">
            <span className="t">Saved works</span>
            <span className="c">{saved.state.pagination?.total_count ?? items.length}</span>
          </div>
          <div className="grid">
            {items.map((row: SavedArtwork) =>
              row.artwork ? <ArtworkCard key={row.id} artwork={row.artwork} /> : null,
            )}
          </div>
          {saved.state.pagination && saved.state.pagination.has_next && (
            <div className="prof-sech">
              <Link to="/saved" className="t">
                All saved works →
              </Link>
            </div>
          )}
        </>
      )}
      {all.length > 0 && (
        <>
          <div className="prof-sech" style={{ marginTop: 4 }}>
            <span className="t">Requests &amp; activity</span>
          </div>
          <div className="actfil">
            {FILTERS.filter(([f]) => f === 'all' || counts[f] > 0).map(([f, label]) => (
              <button
                key={f}
                type="button"
                className={active === f ? 'on' : ''}
                onClick={() => setFilter(f)}
              >
                {label}
                <span className="n">{counts[f]}</span>
              </button>
            ))}
          </div>
          <div className="acthd">
            <span className="c">
              {shown.length} {shown.length === 1 ? 'item' : 'items'}
            </span>
            {controller.activity().length > 0 && (
              <button type="button" className="clr" onClick={() => setClearing(true)}>
                Clear activity
              </button>
            )}
          </div>
          <div className="actlist">
            {shown.map((r) => (
              <ConversationRow key={r.id} request={r} to={rowTo(r)} />
            ))}
          </div>
        </>
      )}
      {clearing && (
        <ClearActivitySheet
          onClose={() => setClearing(false)}
          onClear={() => {
            controller.clearActivity();
            setClearing(false);
          }}
        />
      )}
    </>
  );
}

/**
 * `DZ.actClearAsk` (app.html:11355-11360) — the title, the line, and the two
 * `.actsh-btn` buttons (danger + quiet) in the original's own chrome.
 *
 * One sentence is deliberately not ported. The old app closed with "This
 * can't be undone."; here the clear is this session's view only, because the
 * backend has no collector-side delete, archive or hide
 * (`docs/PHASE_5_API_GAPS.md` G-P5-4), so that line would be false. It says
 * what actually happens instead. Owner decision D4 (2026-09-17): build the
 * control, record the gap.
 */
function ClearActivitySheet({
  onClose,
  onClear,
}: {
  onClose: () => void;
  onClear: () => void;
}) {
  return (
    <Sheet open onClose={onClose} title="Clear activity">
      <div className="dz-clear">
        <p>
          This clears your artwork request &amp; reply history. Your saved works and your
          conversation with Darz are kept. Darz keeps its own record, and the list returns when
          you reload.
        </p>
        <button type="button" className="actsh-btn danger" onClick={onClear}>
          Clear all activity
        </button>
        <button type="button" className="actsh-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

/* ---- Account (profAccountHTML, app.html:9765-9797) ------------------------ */
function Account({
  onSignOut,
  sessionPrincipal,
}: {
  onSignOut: () => void;
  sessionPrincipal: string | null;
}) {
  const { me } = useSession();
  return (
    <>
      {/* keyed on the principal, so the form re-seeds once `me` arrives on a
          cold load, and never while the collector is typing */}
      <AccountForm key={me?.id ?? 'pending'} />

      <div className="pf-grp">Access key</div>
      <div className="pf-card">
        <span className="pf-val key" aria-label="Your access key">
          ••••••••
        </span>
        <div className="pf-note">
          This key is your private pass into Darz. Only you and the Darz team can use it —{' '}
          <b>never share it with anyone</b>. It cannot be changed here; contact Darz if you
          ever need a new one.
        </div>
      </div>

      {/* :9793 — invoices, certificates & provenance; hidden when none */}
      <Documents />

      <div className="dz-cbx-wrap">
        <div className="dz-cbx-lab">Continue with Darz</div>
        <div className="dz-cbx-row">
          <Link to="/chat" className="dz-cbx">
            <span className="tt">Continue in Chat</span>
            <span className="ss">Keep the conversation inside your private Darz room.</span>
            <span className="cta">Open chat →</span>
          </Link>
        </div>
      </div>

      <div style={{ padding: '6px 0 24px' }}>
        <button type="button" className="pf-row" onClick={onSignOut}>
          <span className="ic">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </span>
          <span>Leave the Room</span>
          <span className="go">›</span>
        </button>
        {sessionPrincipal === 'team' && (
          <p className="pf-note" style={{ margin: '10px 18px 0' }}>
            You are signed in with a team account.
          </p>
        )}
      </div>
    </>
  );
}

/** The collector's saved works as the paginated `/saved` list (upstream's
 * `SavedListController` seam), reloaded when a save/unsave lands anywhere. */
function useSavedList() {
  const { crm } = useApi();
  const list = useListController<SavedArtwork, SavedArtworkQuery>(
    () => new SavedListController(crm, { per_page: 12 }),
  );
  const { lastAction } = useSaved();
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (!lastAction || lastAction.at === seen.current) return;
    seen.current = lastAction.at;
    void list.reload();
  }, [lastAction, list]);
  return list;
}

function byNewest(a: CollectorRequest, b: CollectorRequest): number {
  return b.created_at.localeCompare(a.created_at);
}

/** Every request opens its own detail at `/chat/:id` — a conversation as the
 * chat it is, any other kind as the old app's request card (owner decision
 * D10). Until step 3 the non-conversation rows led back to this same page. */
function rowTo(r: CollectorRequest): string {
  return `/chat/${r.id}`;
}
