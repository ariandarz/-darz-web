/**
 * ChatPage — `/chat`. v0.1: collector ↔ Darz Admin only.
 *
 * The one general conversation ("Chat with Darz", the old app's `DZ_CHAT_X`
 * thread opened by the `#dzChatFab` pill and Profile's "Open chat with Darz",
 * app.html:9634-9652 / :11572) sits first as the `.dz-cbx` contact box
 * (`dzContactBoxes`, :9655-9668), followed by every artwork inquiry as a
 * conversation row. AI chat ("Ask Darz AI", :7027) and gallery/artist chat
 * are not rendered — `features.aiChat` / `features.galleryChat` are off.
 */
import { useNavigate } from 'react-router-dom';
import { useConversations } from '../conversations/useConversations';
import { ConversationRow } from '../conversations/ConversationRow';
import { useArtworks } from '../catalogue/useArtworkCache';
import '../catalogue/catalogue.css';
import './chat.css';

export function ChatPage() {
  const navigate = useNavigate();
  const { status, error, controller } = useConversations();
  const general = controller.general();
  const inquiries = controller.inquiries();
  const lookup = useArtworks(inquiries.map((r) => r.artwork));
  const generalUnread = general?.unread_count ?? 0;

  const openGeneral = async () => {
    try {
      const row = await controller.ensureGeneral();
      navigate(`/chat/${row.id}`);
    } catch {
      /* the list's error state shows the reason on the next poll */
    }
  };

  return (
    <div className="dz-page dz-chatlist">
      <div className="hero compact">
        <p className="eyebrow">Private room</p>
        <h1>Chat</h1>
      </div>

      <div className="dz-cbx-wrap">
        <div className="dz-cbx-lab">Continue with Darz</div>
        <div className="dz-cbx-row">
          <button type="button" className="dz-cbx" onClick={() => void openGeneral()}>
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
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </span>
            <span className="tt">
              Chat with Darz
              {generalUnread > 0 && (
                <span className="dz-cbx-badge">
                  {generalUnread > 9 ? '9+' : generalUnread}
                </span>
              )}
            </span>
            <span className="ss">Keep the conversation inside your private Darz room.</span>
            <span className="cta">Open chat →</span>
          </button>
        </div>
      </div>

      {status === 'loading' && inquiries.length === 0 && <p className="dz-state">Loading…</p>}
      {status === 'error' && <p className="dz-state err">{error}</p>}

      {inquiries.length > 0 && (
        <>
          <div className="prof-sech">
            <span className="t">Your inquiries</span>
            <span className="c">{inquiries.length}</span>
          </div>
          <div className="actlist">
            {inquiries.map((r) => (
              <ConversationRow
                key={r.id}
                request={r}
                artwork={lookup(r.artwork)}
                to={`/chat/${r.id}`}
              />
            ))}
          </div>
        </>
      )}

      {status === 'ready' && inquiries.length === 0 && (
        <div className="prof-empty">
          <div className="pe-t">No inquiries yet</div>
          <div className="pe-s">
            Send an inquiry from any work in the Market and the conversation gathers here.
          </div>
        </div>
      )}
    </div>
  );
}
