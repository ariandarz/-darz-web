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
 *    threads here are server records;
 *  - the client-side **search** box — this list is paginated server-side and
 *    `GET /api/crm/admin/requests/` has no text-search param (a gap worth
 *    raising with the backend when Chat gets heavy use).
 */
import { Link } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { AdminRequest, AdminRequestQuery } from '../../api/types';
import { useListController } from '../shared/useListController';
import { AdminRequestsController } from './AdminRequestsController';
import { DeskBanner, DeskPage, Pager, SelectFilter, deskBanner, resolveDeskView } from './kit';
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
        <SelectFilter
          label="Show"
          anyLabel="All conversations"
          value={state.query.kind}
          onChange={(kind) => setQuery({ kind })}
          choices={KIND_CHOICES}
        />
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
