/**
 * PortalHistory — the History tab (G-PORT-2): everything this portal has sent
 * Darz, newest first, and where each one got to. A port of the old
 * `historyPanelHtml` + `historyDetailHtml` (packages/domain/
 * collaboration-agreement.js:406-523, driven from gallery-update.html:
 * 2122-2150): 25 at a time with "Show n more", every row opens a drawer.
 *
 * Read from `portal_state.updates[]` (`PortalUpdateSerializer`). What differs
 * from the old panel, for a data reason:
 *  - the kind and the status read their words from `/api/options/`
 *    (`gallery.update_kind`, `gallery.update_status`), not the old local
 *    `HISTORY_KIND` / `HISTORY_STATE` maps (house rule) — so "Pending" where
 *    the old pill read "With Darz". The one-line meaning under each state
 *    (`HISTORY_STATE_NOTE`) is kept, as copy;
 *  - "Reviewed by Darz" has no date (the portal tier trims `reviewed_at`);
 *    Darz's `review_note` is shown instead, which the old row never had.
 */
import { useState } from 'react';
import type { OptionsMap } from '../../api/services';
import type { PortalState, PortalUpdate } from '../../api/types';
import {
  choiceLabel,
  fmtDateTime,
  historyNote,
  historyRows,
  historyStateNote,
  historyTitle,
  historyWhat,
} from './portalForm';

const STEP = 25; // old HIST_STEP (gallery-update.html:2128)

export function PortalHistory({
  data,
  options,
}: {
  data: PortalState;
  options: OptionsMap | null;
}) {
  const rows = historyRows(data.updates);
  const [shown, setShown] = useState(STEP);
  const [openId, setOpenId] = useState('');

  const head = (
    <div className="exh-card">
      <div className="exh-h">History</div>
      <div className="exh-seam" />
      <div className="exh-sub">
        Everything this portal has sent Darz, newest first — what it was, who sent it, and
        where it got to. Read-only; nothing here can be changed or removed.
      </div>
    </div>
  );
  if (!rows.length) {
    return (
      <>
        {head}
        <div className="exh-card" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div className="exh-sub" style={{ margin: 0 }}>
            Nothing sent yet.
          </div>
        </div>
      </>
    );
  }
  const list = rows.slice(0, shown);
  const rest = rows.length - list.length;
  return (
    <>
      {head}
      <div className="exh-card">
        <div className="hs-list">
          {list.map((u) => (
            <HistoryItem
              key={u.id}
              u={u}
              data={data}
              options={options}
              open={openId === u.id}
              onToggle={() => setOpenId((cur) => (cur === u.id ? '' : u.id))}
            />
          ))}
        </div>
        <div className="sec-note" style={{ marginTop: 12 }}>
          Showing {list.length} of {rows.length}.
        </div>
        {rest > 0 && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="btn" type="button" onClick={() => setShown((n) => n + STEP)}>
              Show {Math.min(STEP, rest)} more
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function HistoryItem({
  u,
  data,
  options,
  open,
  onToggle,
}: {
  u: PortalUpdate;
  data: PortalState;
  options: OptionsMap | null;
  open: boolean;
  onToggle: () => void;
}) {
  const payload = (u.payload ?? {}) as Record<string, unknown>;
  const staff = typeof payload.staff === 'string' ? payload.staff : '';
  const kind = choiceLabel(options, 'gallery.update_kind', u.kind);
  const status = choiceLabel(options, 'gallery.update_status', u.status);
  const title = historyTitle(u, data.assigned_artworks);
  const what = historyWhat(u, options);
  const note = historyNote(u);
  const detail: Array<[string, string]> = (
    [
      ['What', kind],
      ['Detail', what !== kind ? what : ''],
      ['Artwork', u.artwork ? title : ''],
      ['Sent', `${fmtDateTime(u.created_at)}${staff ? ` · by ${staff}` : ''}`],
      ['Status', status],
      ['Darz’s note', u.review_note ? `“${u.review_note}”` : ''],
      [u.kind === 'ask' ? 'Your question' : 'Your note', note ? `“${note}”` : ''],
    ] as Array<[string, string]>
  ).filter(([, v]) => v.trim() !== '');
  const next = historyStateNote(u);
  return (
    <div className={`hs-item${open ? ' open' : ''}`}>
      <div
        className="hs-row"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onToggle();
        }}
      >
        <span className="hs-chev" />
        <div className="hs-main">
          <div className="hs-k">{kind}</div>
          <div className="hs-t">{title}</div>
          <div className="hs-w">{what}</div>
          {note && <div className="hs-n">“{note}”</div>}
        </div>
        <div className="hs-side">
          <div className="hs-when">
            {fmtDateTime(u.created_at)}
            {staff ? ` · ${staff}` : ''}
          </div>
          <div className={`hs-st ${u.status}`}>{status}</div>
        </div>
      </div>
      <div className="hs-draw">
        <div className="hs-din">
          {detail.map(([k, v]) => (
            <div className="hs-dr" key={k}>
              <span className="hs-dk">{k}</span>
              <span className="hs-dv">{v}</span>
            </div>
          ))}
          {next && <div className="hs-next">{next}</div>}
        </div>
      </div>
    </div>
  );
}
