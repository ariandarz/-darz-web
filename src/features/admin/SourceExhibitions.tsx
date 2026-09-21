/**
 * SourceExhibitions — the partner-page halves of the gallery loop that talk
 * to the portal: the shows this partner has with Darz (each opening the
 * composer) and the Q&A thread (the admin side of the portal's Messages
 * tab, `admin_link_messages` — sender `admin` renders as Darz there).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { ExhibitionAdmin, PortalMessage } from '../../api/types';
import { DeskBanner } from './kit';
import { choiceLabel, fmtDateTime } from '../portal/portalForm';
import { money, lineTotals, seedLines } from './exhibitionForm';

export function ExhibitionsSection({
  linkId,
  options,
  onRows,
}: {
  linkId: string;
  options: OptionsMap | null;
  /** The loaded shows, handed up so the page's documents section can gather
   * each show's documents without fetching the shows a second time. */
  onRows?: (rows: ExhibitionAdmin[]) => void;
}) {
  const { galleryAdmin } = useApi();
  const [rows, setRows] = useState<ExhibitionAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    galleryAdmin.exhibitions({ link: linkId, per_page: 50 }).then(
      (p) => {
        setRows(p.results);
        onRows?.(p.results);
      },
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the shows.'),
    );
  }, [galleryAdmin, linkId, onRows]);
  useEffect(load, [load]);

  const create = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await galleryAdmin.createExhibitionForLink(linkId, { title: title.trim() });
      setTitle('');
      setCreating(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the show.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Exhibition Services</h2>
        <span className="ad-dsec-n">
          the partner requests; Darz composes, prices and publishes
        </span>
      </div>

      {error && <DeskBanner>{error}</DeskBanner>}
      {!rows && !error && <p className="dz-state">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="dz-state">
          No shows yet — the partner can start one from the portal, or start one here.
        </p>
      )}

      {rows &&
        rows.map((ev) => {
          const t = lineTotals(seedLines(ev, []), ev.discount);
          return (
            <Link
              key={ev.id}
              to={`/admin/sources/${linkId}/exhibitions/${ev.id}`}
              className="ad-card ad-updrow ad-exhrow"
            >
              <div className="ad-updmain">
                <span className="ad-cellmain">{ev.title || 'Untitled show'}</span>
                <span className="ad-cellsub">
                  {[ev.event_date, ev.venue, ev.artists].filter(Boolean).join(' · ') || '—'}
                  {' · '}
                  {ev.service_lines.length
                    ? `${ev.service_lines.length} line${ev.service_lines.length === 1 ? '' : 's'} · ${money(ev.currency, t.tot)}`
                    : `${ev.gallery_selected.length} ticked`}
                </span>
              </div>
              <span className="ad-rowacts">
                {ev.published && <span className="ad-stpill is-ok">on the portal</span>}
                <span
                  className={`ad-stpill is-${ev.request_status === 'approved' ? 'ok' : ev.request_status === 'rejected' ? 'gone' : ev.request_status === 'requested' ? 'res' : 'neut'}`}
                >
                  {choiceLabel(
                    options,
                    'gallery.exhibition_request_status',
                    ev.request_status,
                  )}
                </span>
              </span>
            </Link>
          );
        })}

      {creating ? (
        <div className="ad-card ad-exhnew">
          <input
            aria-label="Exhibition title"
            placeholder="Exhibition title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void create();
            }}
          />
          <button
            type="button"
            className="ad-action"
            disabled={busy || !title.trim()}
            onClick={() => void create()}
          >
            Start
          </button>
          <button type="button" className="ad-rowbtn" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="ad-rowacts ad-exhacts">
          <button type="button" className="ad-rowbtn" onClick={() => setCreating(true)}>
            ＋ Start a show for this partner
          </button>
        </div>
      )}
    </section>
  );
}

/** The thread — chronological, the portal's own bubble idiom re-used from
 * the desk's side (`.msg.darz` is us here). Sending reloads the thread. */
export function MessagesSection({ linkId }: { linkId: string }) {
  const { galleryAdmin } = useApi();
  const [msgs, setMsgs] = useState<PortalMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    galleryAdmin.linkMessages(linkId, { per_page: 100 }).then(
      (p) => setMsgs(p.results),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the thread.'),
    );
  }, [galleryAdmin, linkId]);
  useEffect(load, [load]);

  useEffect(() => {
    threadRef.current?.scrollTo(0, threadRef.current.scrollHeight);
  }, [msgs?.length]);

  const send = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await galleryAdmin.sendLinkMessage(linkId, text);
      setBody('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  };

  const waiting = msgs && msgs.length > 0 && msgs[msgs.length - 1].sender === 'portal';

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Messages</h2>
        <span className="ad-dsec-n">
          {waiting ? 'the partner spoke last — a reply is owed' : 'the portal’s Q&A thread'}
        </span>
      </div>

      {error && <DeskBanner>{error}</DeskBanner>}
      {!msgs && !error && <p className="dz-state">Loading…</p>}
      {msgs && msgs.length === 0 && <p className="dz-state">No messages yet.</p>}

      {msgs && msgs.length > 0 && (
        <div className="ad-msgthread" ref={threadRef}>
          {msgs.map((m) => (
            <div
              className={`ad-msg ${m.sender === 'admin' ? 'is-darz' : 'is-partner'}`}
              key={m.id}
            >
              <span className="ad-msgwho">{m.sender === 'admin' ? 'Darz' : 'Partner'}</span>
              {m.body}
              <span className="ad-msgtm">{fmtDateTime(m.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="ad-msgbox">
        <textarea
          aria-label="Reply to the partner"
          placeholder="Write to the partner…"
          value={body}
          disabled={busy}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="button"
          className="ad-action"
          disabled={busy || !body.trim()}
          onClick={() => void send()}
        >
          Send
        </button>
      </div>
    </section>
  );
}
