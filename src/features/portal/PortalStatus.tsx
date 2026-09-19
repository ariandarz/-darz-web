/**
 * PortalStatus — the sales-funnel tab (gallery-update.html:979-1032, v923;
 * shown only when the link has `feat_funnel`). Overview cells, then every
 * shared work ranked by how live it is, each opening a drawer with the old
 * status-and-next-step copy — and the activity counts only when the link
 * also has `feat_funnel_activity` ("never a collector identity").
 *
 * Stage labels come from `gallery.funnel_stage` in `/api/options/`; the old
 * page's 'In Discussion' has no server stage and does not appear.
 */
import { useState } from 'react';
import type { OptionsMap } from '../../api/services';
import type { PortalState, PortalWork } from '../../api/types';
import { FUNNEL_ORDER, agoLabel, choiceLabel, funnelMeta, workStage } from './portalForm';

const OVERVIEW_STAGES = [
  'listed',
  'saved',
  'requested',
  'offer_received',
  'on_hold',
  'reserved',
  'sold',
];

export function PortalStatus({
  data,
  options,
}: {
  data: PortalState;
  options: OptionsMap | null;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const works = data.assigned_artworks ?? [];
  const showAct = data.feat_funnel_activity;

  const counts: Record<string, number> = {};
  for (const w of works) counts[workStage(w)] = (counts[workStage(w)] ?? 0) + 1;

  const sorted = [...works].sort(
    (a, b) => (FUNNEL_ORDER[workStage(a)] ?? 6) - (FUNNEL_ORDER[workStage(b)] ?? 6),
  );

  return (
    <div>
      <div className="sec-note">
        The live status of every work you’ve shared with Darz — it updates automatically as
        collectors act. Tap any work to see its status and the right next step.
      </div>
      <div className="fn-ov">
        {OVERVIEW_STAGES.map((s) => (
          <div className="fn-cell" key={s}>
            <div className="fn-n">{counts[s] ?? 0}</div>
            <div className="fn-l">
              <span className={`fn-dot ${funnelMeta(s).c}`} />
              {choiceLabel(options, 'gallery.funnel_stage', s)}
            </div>
          </div>
        ))}
      </div>
      <div className="fn-list">
        {sorted.length ? (
          sorted.map((w) => (
            <FunnelRow
              key={w.id}
              w={w}
              options={options}
              showAct={showAct}
              open={!!open[w.id]}
              onToggle={() => setOpen((o) => ({ ...o, [w.id]: !o[w.id] }))}
            />
          ))
        ) : (
          <div className="empty">No works shared yet.</div>
        )}
      </div>
    </div>
  );
}

function FunnelRow({
  w,
  options,
  showAct,
  open,
  onToggle,
}: {
  w: PortalWork;
  options: OptionsMap | null;
  showAct: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const stage = workStage(w);
  const m = funnelMeta(stage);
  const a = w.funnel?.activity;
  const parts: Array<[number, string]> = a
    ? [
        [a.views, 'views'],
        [a.saves, 'saved'],
        [a.requests, a.requests > 1 ? 'requests' : 'request'],
        [a.offers, a.offers > 1 ? 'offers' : 'offer'],
        [a.holds, 'hold'],
      ]
    : [];
  const shown = parts.filter(([n]) => n > 0);
  const ago = a?.last_activity_at ? agoLabel(a.last_activity_at) : '';

  return (
    <>
      <button type="button" className="fn-row" onClick={onToggle}>
        <div className="fn-th">{(w.snapshot.artist || '?').slice(0, 1)}</div>
        <div>
          <div className="fn-ar">{w.snapshot.artist || '—'}</div>
          <div className="fn-ti">{w.snapshot.title || 'Untitled'}</div>
        </div>
        <span className={`fn-badge ${m.c}`}>
          {choiceLabel(options, 'gallery.funnel_stage', stage)}
        </span>
      </button>
      <div className={`fn-drawer${open ? ' open' : ''}`}>
        <div className="fn-din">
          {showAct && (
            <div className="fn-acts">
              {shown.length ? (
                shown.map(([n, label]) => (
                  <span key={label}>
                    <b>{n}</b> {label}
                  </span>
                ))
              ) : (
                <span>No collector activity yet.</span>
              )}
              {ago && <span>last activity {ago}</span>}
            </div>
          )}
          <div className="fn-next">
            <div className="fn-nl">Status &amp; next step</div>
            <div className="fn-nt">
              {m.n} {m.nx}
            </div>
          </div>
          {!showAct && (
            <div className="fn-priv">
              <span>·</span>
              <span>
                Darz shares the collector activity behind this when it’s the right moment.
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
