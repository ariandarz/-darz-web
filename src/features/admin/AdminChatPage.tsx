/**
 * AdminChatPage — `/admin/chat`, the team's end of every collector
 * conversation. The old panel's Chat Dashboard (`DarzAdmin.chatView`,
 * `darz-studio.html:40528`), read over this backend's model: a conversation
 * **is** a request (`kind=message`, no artwork, for the general "Chat with
 * Darz"; any other kind for an artwork inquiry), the same unified surface the
 * collector's own Chat lists. One list, so the two ends can never disagree
 * about what exists.
 *
 * Ported from the old row (`_chatDashConvos`, `:40448-40453`): the avatar
 * initial, the collector's name, the context line, the unread badge and the
 * date. The unread badge is `unread_count` — collector messages the team has
 * not seen, the exact set `_chatSeen` marked (`:40547`).
 *
 * **Not ported, no backend for any of it** (`docs/ADMIN_ARCHITECTURE.md` §2;
 * flagged, not dropped):
 *  - the **AI Monitor** pill and the per-conversation AI/Human/Member mode —
 *    there is no AI anywhere in this backend, and `features.aiChat` is off;
 *  - the per-conversation **status** (new/active/resolved) and **assignee** —
 *    a conversation here is a request, whose real status/assignee live on the
 *    request itself (the Requests desk);
 *  - **Clear**, which deleted the thread from the old client-local store —
 *    threads here are server records.
 *
 * **The search box is built** (`:40446`, "Search collectors by name or key…").
 * It was listed above as unbuildable — "no text-search param, a gap worth
 * raising with the backend" — and that stopped being true when **G-5** landed
 * `?search=` on this very endpoint (backend 2026-09-21, wired into the
 * Requests desk by #65). This desk reads the same list through the same
 * controller and nobody came back for it; found 2026-09-22 comparing against
 * `17-chat`. It searches the collector's name, the artwork title and its
 * artist — not message bodies, which is the backend's own decision
 * (`AdminRequestQuery`), so the old placeholder's "or key" is not promised.
 *
 * **Also compared against `17-chat`, recorded rather than built:**
 *  - **The heading.** The old desk's is "💬 Chat Dashboard"; this one takes
 *    its nav label, for the same reason Live Auctions does — the old panel
 *    separates its two chat views with an in-desk pill row this port has no
 *    counterpart for.
 *  - **The 4-tile strip** (New · Active · Waiting · Resolved) and the
 *    **Conversations / AI Monitor pills**. Both count things listed above as
 *    having no backend: the per-conversation status does not exist here, and
 *    there is no AI anywhere in this backend. A strip of four tiles reading
 *    zero would be worse than none.
 *  - **The two-pane layout** — list left, thread right. Here the thread is
 *    its own route (`/admin/chat/:id`), which is the routing change §6.2
 *    covers, and it is what makes a conversation linkable.
 *  - **"Conversation renewal"** (Keep · daily · weekly, and "Archive all &
 *    start fresh"). Not ported and not buildable: it writes `chatRenew` /
 *    `chatArchiveBefore` into the old THEME (`:40259-40260`) and the app
 *    hides older messages client-side. Nothing here archives a message —
 *    `RequestMessage` has no archived flag and no endpoint sweeps one.
 *    Backend gap **G-CHAT-2**.
 */
import { Link } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { AdminRequest, AdminRequestQuery } from '../../api/types';
import { useListController } from '../shared/useListController';
import { AdminRequestsController } from './AdminRequestsController';
import {
  DeskBanner,
  DeskPage,
  Pager,
  SearchFilter,
  SelectFilter,
  deskBanner,
  resolveDeskView,
} from './kit';
import './admin.css';

/** All conversations, or just the general chats (`kind=message`). */
const KIND_CHOICES = [{ value: 'message', label: 'General chat only' }];

export function AdminChatPage() {
  const { crm } = useApi();
  const { state, setQuery, setPage } = useListController<AdminRequest, AdminRequestQuery>(
    () => new AdminRequestsController(crm),
  );

  const view = resolveDeskView(state.status, state.results.length);
  const banner = deskBanner(state.status, state.error);

  return (
    <DeskPage
      title="Chat"
      toolbar={
        <>
          {/* `:40446` — the old desk's own box. Its placeholder said "name or
              key"; the server searches names and the artwork/artist, never the
              access key, so this one says what it does. */}
          <SearchFilter
            label="Search"
            value={state.query.search}
            placeholder="Collector, artwork or artist…"
            onChange={(search) => setQuery({ search })}
          />
          <SelectFilter
            label="Show"
            anyLabel="All conversations"
            value={state.query.kind}
            onChange={(kind) => setQuery({ kind })}
            choices={KIND_CHOICES}
          />
        </>
      }
    >
      {banner && <DeskBanner>{banner}</DeskBanner>}
      {view === 'loading' && <p className="dz-state">Loading…</p>}
      {view === 'empty' && (
        /* :40458's shape — nothing yet is a fact, not an error */
        <p className="dz-state">No conversations yet.</p>
      )}

      {view === 'rows' && (
        <div className="ad-card ad-convos">
          {state.results.map((r) => (
            <ConversationRow key={r.id} row={r} />
          ))}
        </div>
      )}

      {state.pagination && <Pager pagination={state.pagination} onPage={setPage} />}
    </DeskPage>
  );
}

function ConversationRow({ row }: { row: AdminRequest }) {
  const name = row.collector?.display_name || 'Collector';
  const context =
    row.kind === 'message'
      ? 'Chat with Darz'
      : [titleCase(row.kind), artworkLine(row.artwork)].filter(Boolean).join(' · ');

  // The row rides along as router state so the thread can name the collector —
  // there is no admin request-detail endpoint (G-CHAT-1).
  return (
    <Link to={`/admin/chat/${row.id}`} state={row} className="ad-convo">
      {/* :40450 — the avatar is the name's initial */}
      <span className="ad-cav">{(name.trim().charAt(0) || '#').toUpperCase()}</span>
      <span className="ad-cbody">
        <span className="ad-cname">{name}</span>
        <span className="ad-csub">{context}</span>
      </span>
      <span className="ad-cmeta">
        {row.unread_count > 0 && <span className="ad-unread">{row.unread_count}</span>}
        <span className="ad-cdate">
          {new Date(row.created_at).toLocaleDateString('en-GB')}
        </span>
      </span>
    </Link>
  );
}

function artworkLine(artwork: AdminRequest['artwork']): string {
  if (!artwork) return '';
  return artwork.artist ? `${artwork.artist.display_name} — ${artwork.title}` : artwork.title;
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s;
}
