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
 *              questionnaire ("Get to know you") and "Curated for you" cards
 *              are behind `features.questionnaire` / `.recommendations`.
 *   Market   — Saved works + "Requests & activity" with filter chips
 *              (`profMarketHTML`, :9704). Buy / Offers chips only appear
 *              when such requests exist (as the old app did).
 *   Account  — account details, access key, "Leave the Room"
 *              (`profAccountHTML`, :9738). Read-only: the backend has no
 *              profile-update endpoint yet (flagged in docs/V0_1_SCOPE.md).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useSession } from '../../api/hooks';
import type { CollectorRequest, SavedArtwork, SavedArtworkQuery } from '../../api/types';
import { ArtworkCard } from '../catalogue/ArtworkCard';
import { useArtworks } from '../catalogue/useArtworkCache';
import '../catalogue/catalogue.css';
import { ConversationRow } from '../conversations/ConversationRow';
import { useConversations } from '../conversations/useConversations';
import { SavedListController } from '../saved/SavedListController';
import { useSaved } from '../saved/useSaved';
import { useListController } from '../shared/useListController';
import { features } from '../shell/features';
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
            accessStatus={me?.access_status ?? null}
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
  const { controller } = useConversations();
  const saved = useSavedList();
  const acts = controller.activity();
  const unseen = controller.unreadTotal();
  const recent = useMemo(
    () => [...controller.conversations(), ...acts].sort(byNewest).slice(0, 3),
    [controller, acts],
  );
  const lookup = useArtworks(recent.map((r) => r.artwork));
  const sv = saved.state.pagination?.total_count ?? saved.state.results.length;

  return (
    <>
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
      {recent.length > 0 && (
        <>
          <div className="ov-grp">
            <span className="t">Recent activity</span>
            <button type="button" className="a" onClick={() => go('market')}>
              View all →
            </button>
          </div>
          <div className="actlist">
            {recent.map((r) => (
              <ConversationRow
                key={r.id}
                request={r}
                artwork={lookup(r.artwork)}
                to={rowTo(r)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ---- Market (profMarketHTML, app.html:9704-9735) -------------------------- */
function Market() {
  const { controller } = useConversations();
  const saved = useSavedList();
  const [filter, setFilter] = useState<Filter>('all');
  const all = useMemo(
    () => [...controller.conversations(), ...controller.activity()].sort(byNewest),
    [controller],
  );
  const counts = Object.fromEntries(
    FILTERS.map(([f]) => [f, all.filter((r) => filterMatch(r, f)).length]),
  ) as Record<Filter, number>;
  const active: Filter = counts[filter] ? filter : 'all';
  const shown = all.filter((r) => filterMatch(r, active));
  const lookup = useArtworks(shown.map((r) => r.artwork));
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
        <div className="pe-s">Save a work or send an inquiry — it all gathers here.</div>
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
          </div>
          <div className="actlist">
            {shown.map((r) => (
              <ConversationRow
                key={r.id}
                request={r}
                artwork={lookup(r.artwork)}
                to={rowTo(r)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ---- Account (profAccountHTML, app.html:9738-9772) ------------------------ */
function Account({
  onSignOut,
  accessStatus,
  sessionPrincipal,
}: {
  onSignOut: () => void;
  accessStatus: string | null;
  sessionPrincipal: string | null;
}) {
  const { me } = useSession();
  return (
    <>
      <div className="pf-grp">Account details</div>
      <div className="pf-card">
        <span className="pf-lab">Name</span>
        <span className="pf-val">{me?.display_name || me?.name || '—'}</span>
        <span className="pf-lab">Membership</span>
        <span className="pf-val">
          {me?.tier ? me.tier.charAt(0).toUpperCase() + me.tier.slice(1) : '—'}
          {accessStatus ? ` · ${accessStatus}` : ''}
        </span>
        <div className="pf-note">
          To change your name or contact details, write to Darz in Chat — the details are
          updated for you.
        </div>
      </div>

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

/** Conversations open in Chat; other requests are read-only rows for now. */
function rowTo(r: CollectorRequest): string {
  return r.kind === 'information' || r.kind === 'message'
    ? `/chat/${r.id}`
    : '/profile?tab=market';
}
