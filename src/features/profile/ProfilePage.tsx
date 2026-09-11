/**
 * ProfilePage — the Profile tab (SCREENS.md §11, captures 15–18). Ported from
 * `app.html` `profileView()` (:9802) + `profBodyRender()`: the head (eyebrow
 * "COLLECTOR" · name) · four segment pills **Overview · Market · Auctions ·
 * Account** · the tab body.
 *
 *   - **Overview** — the four count tiles **Saved · Auctions · Activity ·
 *     Messages** with their hint lines, and the pending-request strip.
 *   - **Market** — saved works (cards) and the activity list (holds, viewings,
 *     offers, price requests) with status pills and unseen-reply dots.
 *   - **Auctions** — paddle registrations and the auction notices.
 *   - **Account** — "Account details" (read-only: the API has no profile-edit
 *     endpoint yet), **Membership** (tier + redeem code), **Leave the Room**.
 *
 * Not ported, flagged rather than faked: the collector questionnaire card
 * ("Get to know you", no backend model — docs/TASKLIST.md Phase 12+), the
 * **Access key** card (the API's `Me` does not return the key), **Continue in
 * Chat / on WhatsApp** (no chat API, no number), and **Documents** (issued
 * documents are not exposed to collectors yet).
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi, useSession } from '../../api/hooks';
import type { CollectorRequest } from '../../api/types';
import { Button, Input, Toast } from '../../components';
import { ArtworkCard } from '../catalogue/ArtworkCard';
import '../catalogue/catalogue.css';
import { primaryImage } from '../catalogue/format';
import { notificationLine, notificationPill } from '../auctions/status';
import '../auctions/auctions.css';
import './profile.css';
import { useProfile } from './useProfile';

type Tab = 'overview' | 'market' | 'auctions' | 'account';
const TABS: Array<[Tab, string]> = [
  ['overview', 'Overview'],
  ['market', 'Market'],
  ['auctions', 'Auctions'],
  ['account', 'Account'],
];

/** app.html activity row labels for the request kinds. */
const KIND_LABEL: Record<string, string> = {
  purchase: 'Purchase',
  hold: '24h hold',
  viewing: 'Viewing request',
  offer: 'Offer',
  price: 'Price request',
  information: 'Enquiry',
};

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (/accept|approved|confirmed|complete|won/.test(s)) return 's-ok';
  if (/declin|reject|cancel|expired|lost/.test(s)) return 's-no';
  if (/closed|archived/.test(s)) return 's-cl';
  return 's-rev';
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

const CHEV = (
  <span className="actli-chev" aria-hidden="true">
    ›
  </span>
);

export function ProfilePage() {
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { me } = useSession();
  const { auth } = useApi();
  const { state, reload } = useProfile();
  const tab: Tab = (TABS.find(([t]) => t === tabParam)?.[0] ?? 'overview') as Tab;

  const name = me?.display_name ?? me?.name ?? me?.email ?? 'Your profile';
  const pendingCount = state.requests.filter((r) =>
    /submitted|pending|open|new/i.test(r.status),
  ).length;
  const hasNewActivity = state.unreadReplies > 0;

  return (
    <div className="dz-page profile">
      <div className="phead">
        <div className="eyebrow">Collector</div>
        <h1 id="pName">{name}</h1>
      </div>
      <div className="ptabs seg4">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'on' : ''}
            onClick={() => navigate(t === 'overview' ? '/profile' : `/profile/${t}`)}
          >
            {label}
            {t === 'market' && hasNewActivity && tab !== 'market' && (
              <span className="ptab-dot" />
            )}
          </button>
        ))}
      </div>

      <div className="profbody">
        {tab === 'overview' && (
          <Overview
            savedCount={state.savedCount}
            registrations={state.registrations.length}
            requestsCount={state.requestsCount}
            unreadReplies={state.unreadReplies}
            pendingCount={pendingCount}
          />
        )}
        {tab === 'market' && <MarketTab />}
        {tab === 'auctions' && <AuctionsTab />}
        {tab === 'account' && (
          <AccountTab onLeave={() => void auth.logout()} onRedeemed={() => void reload()} />
        )}
      </div>
    </div>
  );

  function Overview(props: {
    savedCount: number | null;
    registrations: number;
    requestsCount: number | null;
    unreadReplies: number;
    pendingCount: number;
  }) {
    const n = (v: number | null) => (v == null ? '–' : String(v));
    return (
      <>
        <div className="ov-tiles">
          <Link to="/saved" className="ov-tile">
            <span className="n">{n(props.savedCount)}</span>
            <span className="l">Saved</span>
            <span className="s">
              {props.savedCount ? 'Works you have kept' : 'Tap a heart to save'}
            </span>
            <span className="chev">›</span>
          </Link>
          <Link to="/profile/auctions" className="ov-tile">
            <span className="n">{props.registrations}</span>
            <span className="l">Auctions</span>
            <span className="s">
              {props.registrations ? 'Paddles registered' : 'Not yet joined'}
            </span>
            <span className="chev">›</span>
          </Link>
          <Link to="/profile/market" className="ov-tile">
            <span className="n">{n(props.requestsCount)}</span>
            <span className="l">Activity</span>
            <span className="s">
              {props.requestsCount ? 'Requests with Darz' : 'No requests yet'}
            </span>
            <span className="chev">›</span>
          </Link>
          <Link to="/profile/market" className="ov-tile">
            <span className="n">{props.unreadReplies}</span>
            <span className="l">Messages</span>
            <span className="s">
              {props.unreadReplies ? 'Replies from Darz' : 'No new replies'}
            </span>
            <span className="chev">›</span>
          </Link>
        </div>
        {props.pendingCount > 0 && (
          <Link to="/profile/market" className="ov-pending">
            <span className="pd" />
            <span className="pb">
              <span className="pt">
                {props.pendingCount} request{props.pendingCount === 1 ? '' : 's'} with Darz
              </span>
              <span className="ps">Darz is reviewing — replies arrive here.</span>
            </span>
            <span className="pchev">›</span>
          </Link>
        )}
      </>
    );
  }

  function MarketTab() {
    const rows = state.requests;
    return (
      <>
        <div className="prof-sech">
          <span className="t">Saved works</span>
          <span className="c">{state.savedCount ?? ''}</span>
        </div>
        {state.saved.length > 0 ? (
          <>
            <div className="grid">
              {state.saved.map((row) =>
                row.artwork ? <ArtworkCard key={row.id} artwork={row.artwork} /> : null,
              )}
            </div>
            {(state.savedCount ?? 0) > state.saved.length && (
              <div className="prof-more">
                <Link to="/saved" className="dz-back">
                  All saved works
                </Link>
              </div>
            )}
          </>
        ) : (
          state.status === 'ok' && (
            <div className="prof-empty">
              <div className="pe-t">No saved works yet.</div>
              <div className="pe-s">Tap a heart on any work and it will be kept here.</div>
              <div className="pe-b">
                <Link to="/" className="btn primary dzpb">
                  Browse the collection
                </Link>
              </div>
            </div>
          )
        )}

        <div className="prof-sech">
          <span className="t">Activity</span>
          <span className="c">{state.requestsCount ?? ''}</span>
        </div>
        {rows.length === 0 && state.status === 'ok' && (
          <div className="prof-empty">
            <div className="pe-t">No requests yet.</div>
            <div className="pe-s">
              Holds, viewings, offers and price requests you send appear here.
            </div>
          </div>
        )}
        {rows.length > 0 && (
          <div className="actlist">
            {rows.map((r) => (
              <ActivityRow key={r.id} r={r} />
            ))}
          </div>
        )}
      </>
    );
  }

  function ActivityRow({ r }: { r: CollectorRequest }) {
    const w = r.artwork ? state.artworks[r.artwork] : undefined;
    const img = w ? primaryImage(w) : null;
    const detail = (r.detail ?? {}) as { amount?: string; currency?: string };
    const to = w ? `/artwork/${w.id}` : '/profile/market';
    return (
      <Link to={to} className={`actli${r.unread_count ? ' actli--rep' : ''}`}>
        <span className="actli-th">{img ? <img src={img} alt="" /> : null}</span>
        <span className="actli-b">
          <span className="actli-k">{KIND_LABEL[r.kind] ?? r.kind}</span>
          <span className="actli-t">
            {w
              ? `${w.artist?.display_name ?? 'Unknown artist'} — ${w.title || 'Untitled'}`
              : 'Darz'}
          </span>
          <span className="actli-d">
            {new Date(r.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </span>
        <span className="actli-r">
          <span className="actli-meta">
            {detail.amount && (
              <span className="actli-amt">
                {Number(detail.amount).toLocaleString('en-US')}
                <span>{detail.currency ?? w?.currency ?? ''}</span>
              </span>
            )}
            <span className={`actli-stat ${statusClass(r.status)}`}>
              {statusLabel(r.status)}
            </span>
          </span>
          {r.unread_count > 0 && <span className="actli-dot" aria-label="New reply" />}
          {CHEV}
        </span>
      </Link>
    );
  }

  function AuctionsTab() {
    return (
      <>
        <div className="prof-sech">
          <span className="t">Registrations</span>
          <span className="c">{state.registrations.length || ''}</span>
        </div>
        {state.registrations.length === 0 && state.status === 'ok' && (
          <div className="prof-empty">
            <div className="pe-t">Not yet joined.</div>
            <div className="pe-s">
              Register a paddle on an auction to bid; your paddles appear here.
            </div>
            <div className="pe-b">
              <Link to="/auctions" className="btn primary dzpb">
                See the auctions
              </Link>
            </div>
          </div>
        )}
        {state.registrations.length > 0 && (
          <div className="actlist">
            {state.registrations.map((reg) => (
              <Link key={reg.id} to={`/auctions/${reg.auction}`} className="actli">
                <span className="actli-b">
                  <span className="actli-k">Paddle</span>
                  <span className="actli-t">
                    {state.auctionTitles[reg.auction] ?? 'Auction'}
                    {reg.paddle_number != null ? ` · No. ${reg.paddle_number}` : ''}
                  </span>
                  <span className="actli-d">
                    {new Date(reg.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </span>
                <span className="actli-r">
                  <span
                    className={`actli-stat ${
                      reg.status === 'approved'
                        ? 's-ok'
                        : reg.status === 'rejected'
                          ? 's-no'
                          : 's-rev'
                    }`}
                  >
                    {reg.status}
                  </span>
                  {CHEV}
                </span>
              </Link>
            ))}
          </div>
        )}

        <div className="prof-sech">
          <span className="t">Auction notices</span>
          <span className="c">{state.unreadNotices ? `${state.unreadNotices} new` : ''}</span>
        </div>
        {state.notifications.length === 0 && state.status === 'ok' && (
          <div className="prof-empty">
            <div className="pe-t">Nothing to report.</div>
            <div className="pe-s">
              Outbid, closing soon, won and lost notices for your lots appear here.
            </div>
          </div>
        )}
        {state.notifications.length > 0 && (
          <div className="actlist">
            {state.notifications.slice(0, 6).map((n) => {
              const pill = notificationPill(n.kind);
              return (
                <Link
                  key={n.id}
                  to={n.lot ? `/auctions/lots/${n.lot}` : '/auctions/notifications'}
                  className={`actli${n.read_at == null ? ' actli--rep' : ''}`}
                >
                  <span className="actli-b">
                    <span className="actli-k">{pill.label}</span>
                    <span className="actli-t">{notificationLine(n)}</span>
                    <span className="actli-d">
                      {new Date(n.created_at).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                  <span className="actli-r">{CHEV}</span>
                </Link>
              );
            })}
            <div className="prof-more">
              <Link to="/auctions/notifications" className="dz-back">
                All auction notices
              </Link>
            </div>
          </div>
        )}
      </>
    );
  }
}

function AccountTab({ onLeave, onRedeemed }: { onLeave: () => void; onRedeemed: () => void }) {
  const { me } = useSession();
  const { auth } = useApi();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const redeem = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    try {
      const r = await auth.redeemMembership(code.trim());
      setToast(`Membership ${r.tier} active.`);
      setCode('');
      await auth.me();
      onRedeemed();
    } catch (err) {
      setToast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="pf-grp">Account details</div>
      <div className="pf-card">
        <Input
          label="Full name"
          name="name"
          readOnly
          value={me?.display_name ?? me?.name ?? ''}
        />
        <Input
          label="Email"
          name="email"
          readOnly
          value={me?.email ?? ''}
          placeholder="Not on file"
        />
        <Input label="Phone" name="phone" readOnly value="" placeholder="Not on file" />
        <Input label="City" name="city" readOnly value="" placeholder="Not on file" />
        <div className="pf-note">Details are kept by Darz. Contact Darz to change them.</div>
      </div>

      <div className="pf-grp">Membership</div>
      <div className="pf-card">
        <div className="pf-member">
          <span className={`aucpill ${me?.tier ? 'good' : 'neutral'}`}>
            {me?.tier ? 'Active' : 'None'}
          </span>
          <span className="pf-member-t">
            {me?.tier ? me.tier : 'No membership on this account.'}
          </span>
        </div>
        <form onSubmit={redeem} className="pf-redeem">
          <Input
            label="Redeem a membership code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code"
            autoComplete="off"
          />
          <Button type="submit" variant="primary" disabled={busy || !code.trim()}>
            {busy ? 'Redeeming…' : 'Redeem'}
          </Button>
        </form>
      </div>

      <div className="pf-leave">
        <button type="button" className="pf-row" onClick={onLeave}>
          <span className="pf-row-ic">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </span>
          <span className="pf-row-t">Leave the Room</span>
          <span className="pf-row-chev">›</span>
        </button>
      </div>
      <Toast message={toast ?? ''} open={Boolean(toast)} onClose={() => setToast(null)} />
    </>
  );
}
