/**
 * PortalWorks — the "Your works" section: the cards, the per-work update
 * panel, and the sticky submit bar (gallery-update.html:607-647,
 * :1228-1467). One submission per work per send, `kind` = the dominant
 * change (`portalForm.ts`).
 *
 * Where this section knowingly differs from the old page, the reason is a
 * backend fact, recorded in docs/ADMIN_ARCHITECTURE.md §2:
 *  - every card shows the no-image state — the snapshot carries no image
 *    (G-PORT-1); the "image needs updating" check still submits kind=image.
 *  - "Sent to Darz" marks live for this tab only — no portal-readable
 *    pending list (G-PORT-2).
 *  - the whole list renders (no 30-per-page client pager): `portal_state`
 *    serves every assigned work in one read, and a portal is a curated set.
 *  - "What collectors can do" + the offer floor ride the work's one
 *    Send update as payload for Darz to apply on review — there is no
 *    direct write or auto-decline engine behind them here (G-PORT-8).
 */
import { useState, useSyncExternalStore, useCallback } from 'react';
import type { OptionsMap } from '../../api/services';
import type { PortalWork } from '../../api/types';
import type { PortalSession } from './PortalSession';
import {
  blankNewWork,
  buildNewWorkPayload,
  buildUpdatePayload,
  choiceLabel,
  choices,
  fmtDateTime,
  fmtThousands,
  funnelMeta,
  hasChange,
  prettyMedium,
  updateKind,
  type NewWorkDraft,
  type PortalDraft,
} from './portalForm';

type Filter = 'all' | 'available' | 'reserved' | 'sold' | 'new';
type Sort = 'recent' | 'oldest';

interface WorksProps {
  session: PortalSession;
  options: OptionsMap | null;
  staff: string;
  notify: (m: string) => void;
}

export function PortalWorks({ session, options, staff, notify }: WorksProps) {
  const state = useSyncExternalStore(
    useCallback((fn) => session.subscribe(fn), [session]),
    () => session.getSnapshot(),
  );
  const works = state.data?.assigned_artworks ?? [];
  const [drafts, setDrafts] = useState<Record<string, PortalDraft>>({});
  const [openAdv, setOpenAdv] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [newWorks, setNewWorks] = useState<NewWorkDraft[]>([]);
  const [nseq, setNseq] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [query, setQuery] = useState('');
  const [allBusy, setAllBusy] = useState(false);

  const draftOf = (id: string): PortalDraft => drafts[id] ?? {};
  const patchDraft = (id: string, patch: Partial<PortalDraft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const origOf = (w: PortalWork) => w.snapshot.availability_status || 'available';
  const isDirty = (w: PortalWork) =>
    hasChange(draftOf(w.artwork), origOf(w)) && !state.sentAt[w.artwork];

  const q = query.trim().toLowerCase();
  const matches = (w: PortalWork) =>
    !q ||
    (w.snapshot.artist ?? '').toLowerCase().includes(q) ||
    (w.snapshot.title ?? '').toLowerCase().includes(q);

  const filtered = works.filter((w) => {
    if (filter === 'new') return false;
    if (filter !== 'all' && (w.snapshot.availability_status ?? 'available') !== filter)
      return false;
    return matches(w);
  });
  const sorted = [...filtered].sort((a, b) => {
    const ka = new Date(a.created_at).getTime();
    const kb = new Date(b.created_at).getTime();
    return sort === 'oldest' ? ka - kb : kb - ka;
  });
  const shownNew = newWorks.filter(
    (n) =>
      (filter === 'all' || filter === 'new') &&
      (!q || n.artist.toLowerCase().includes(q) || n.title.toLowerCase().includes(q)),
  );

  const submitOne = async (w: PortalWork): Promise<boolean> => {
    const draft = draftOf(w.artwork);
    setBusy((b) => ({ ...b, [w.artwork]: true }));
    try {
      await session.submitUpdate({
        kind: updateKind(draft, origOf(w)),
        artwork: w.artwork,
        payload: buildUpdatePayload(w, draft, staff),
      });
      session.markSent(w.artwork);
      return true;
    } catch (err) {
      if (!session.noteAuthFailure(err)) notify('Could not send. Please try again.');
      return false;
    } finally {
      setBusy((b) => ({ ...b, [w.artwork]: false }));
    }
  };

  const sendOne = async (w: PortalWork) => {
    if (await submitOne(w)) {
      // "RECORDED in the provider lane, not live to collectors" (v1163, :1434)
      notify('Update sent to Darz.');
      await session.reload();
    }
  };

  const sendNew = async (n: NewWorkDraft, silent = false): Promise<boolean> => {
    if (!n.artist.trim()) {
      if (!silent) notify('Please enter the artist’s name for the new work.');
      return false;
    }
    try {
      await session.submitUpdate({ kind: 'new', payload: buildNewWorkPayload(n, staff) });
      setNewWorks((list) =>
        list.map((x) => (x.tid === n.tid ? { ...x, submitted: true } : x)),
      );
      if (!silent) notify('New artwork sent to Darz.');
      return true;
    } catch (err) {
      if (!session.noteAuthFailure(err) && !silent)
        notify('Could not submit. Please try again.');
      return false;
    }
  };

  const dirtyWorks = works.filter(isDirty);
  const pendingNew = newWorks.filter((n) => !n.submitted && n.artist.trim());
  const toSubmit = dirtyWorks.length + pendingNew.length;

  const submitAll = async () => {
    if (!toSubmit) {
      notify('Nothing to submit yet — set a status, edit a work, or add one.');
      return;
    }
    setAllBusy(true);
    let ok = 0;
    for (const w of dirtyWorks) if (await submitOne(w)) ok++;
    for (const n of pendingNew) if (await sendNew(n, true)) ok++;
    setAllBusy(false);
    notify(`${ok} of ${toSubmit} update${toSubmit === 1 ? '' : 's'} sent to Darz.`);
    await session.reload();
  };

  const confirmAll = async () => {
    const targets = works.filter(
      (w) =>
        (w.snapshot.availability_status ?? 'available') === 'available' &&
        !state.sentAt[w.artwork],
    );
    if (!targets.length) {
      notify('No available works to confirm.');
      return;
    }
    setAllBusy(true);
    let ok = 0;
    for (const w of targets) if (await submitOne(w)) ok++;
    setAllBusy(false);
    notify(`${ok} work${ok === 1 ? '' : 's'} confirmed available.`);
    await session.reload();
  };

  const addNew = () => {
    const tid = nseq + 1;
    setNseq(tid);
    setNewWorks((list) => [blankNewWork(tid), ...list]);
    if (filter !== 'all' && filter !== 'new') setFilter('all');
  };

  const chips: Array<[Filter, string]> = [
    ['all', 'All'],
    ['available', 'Available'],
    ['reserved', 'Reserved'],
    ['sold', 'Sold'],
    ['new', 'New'],
  ];

  return (
    <div>
      <div className="tbar">
        <div className="tbar-row">
          <input
            className="search"
            placeholder="Search your works — artist or title…"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="btn"
            type="button"
            title="Confirm every available work is still available"
            disabled={allBusy}
            onClick={() => void confirmAll()}
          >
            Confirm all available
          </button>
          <button className="btn btn--primary" type="button" onClick={addNew}>
            + Add artwork
          </button>
        </div>
        <div className="filter-row">
          <div className="chips">
            {chips.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`chip${filter === id ? ' on' : ''}`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="sortbox">
            <select
              className="statussel"
              style={{
                width: 'auto',
                padding: '7px 30px 7px 12px',
                borderRadius: 20,
                fontSize: 13,
              }}
              aria-label="Sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              <option value="recent">Recently added</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
      </div>

      {/* v1166 — assignment is the curation; the note names it plainly */}
      <div className="modenote">
        Darz has selected the artworks included in this portal. Updates submitted here will
        apply only to this selection.
      </div>

      <div className="count">
        {works.length} work{works.length === 1 ? '' : 's'} assigned
        {newWorks.length ? ` · ${newWorks.length} new added` : ''}
      </div>

      <div className="list">
        {shownNew.map((n) => (
          <NewCard
            key={n.tid}
            n={n}
            options={options}
            onSet={(patch) =>
              setNewWorks((list) =>
                list.map((x) => (x.tid === n.tid ? { ...x, ...patch } : x)),
              )
            }
            onSend={() => void sendNew(n)}
            onRemove={() => setNewWorks((list) => list.filter((x) => x.tid !== n.tid))}
          />
        ))}
        {sorted.map((w) => (
          <WorkCard
            key={w.id}
            w={w}
            options={options}
            draft={draftOf(w.artwork)}
            dirty={isDirty(w)}
            sentAt={state.sentAt[w.artwork]}
            advOpen={!!openAdv[w.artwork]}
            busy={!!busy[w.artwork]}
            showActivity={!!state.data?.feat_funnel_activity}
            onToggleAdv={() => setOpenAdv((o) => ({ ...o, [w.artwork]: !o[w.artwork] }))}
            onPatch={(patch) => patchDraft(w.artwork, patch)}
            onSend={() => void sendOne(w)}
          />
        ))}
        {!sorted.length && !shownNew.length && (
          <div className="empty">
            {works.length || newWorks.length
              ? 'No works match this filter.'
              : 'Darz has not selected any artworks for this portal yet. You can still add new works with “Add artwork”.'}
          </div>
        )}
      </div>

      {toSubmit > 0 && (
        <div className="sticky-bar">
          <div className="wrap inner">
            <span className="cnt">
              {toSubmit} item{toSubmit === 1 ? '' : 's'} to submit
            </span>
            <button
              className="btn btn--primary"
              type="button"
              disabled={allBusy}
              onClick={() => void submitAll()}
            >
              {allBusy ? 'Sending…' : 'Submit all updates'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── one existing work (old card(), :1303) ──────────────────────────────── */

function WorkCard({
  w,
  options,
  draft,
  dirty,
  sentAt,
  advOpen,
  busy,
  showActivity,
  onToggleAdv,
  onPatch,
  onSend,
}: {
  w: PortalWork;
  options: OptionsMap | null;
  draft: PortalDraft;
  dirty: boolean;
  sentAt?: string;
  advOpen: boolean;
  busy: boolean;
  showActivity: boolean;
  onToggleAdv: () => void;
  onPatch: (patch: Partial<PortalDraft>) => void;
  onSend: () => void;
}) {
  const s = w.snapshot;
  const original = s.availability_status || 'available';
  const spec = [s.year, prettyMedium(s.medium), s.dimensions].filter(Boolean).join(' · ');
  const price = s.price_amount
    ? `${fmtThousands(s.price_amount)}${s.currency ? ` ${s.currency}` : ''}`
    : 'Price on request';
  const stage = w.funnel?.stage;
  const meta = stage ? funnelMeta(stage) : null;
  const statusOpts = choices(options, 'catalog.availability_status');
  const currencies = choices(options, 'currency');
  const actions = choices(options, 'crm.collector_action');
  // old actAllows (:1409): the snapshot carries no allowed-actions, so the
  // untouched grid shows the old "empty = all four" default.
  const acts = draft.offerActions ?? actions.map((a) => a.value);
  const toggleAct = (value: string, on: boolean) =>
    onPatch({
      offerActions: on
        ? [...acts.filter((a) => a !== value), value]
        : acts.filter((a) => a !== value),
    });

  return (
    <div className={`awc${dirty ? ' dirty' : ''}`}>
      <div className="awc-top">
        {/* G-PORT-1 — no image in the snapshot yet; the old no-image state */}
        <div className="awc-img">
          <span className="noimg">No image</span>
        </div>
        <div className="awc-body">
          <div className="awc-artist">{s.artist || '—'}</div>
          <div className="awc-title">{s.title || 'Untitled'}</div>
          {spec && <div className="awc-spec">{spec}</div>}
          <div className="awc-spec">
            <b>{price}</b>
          </div>
          <div className="awc-srow">
            {stage && stage !== 'listed' && meta && (
              <span
                className={`fn-badge ${meta.c}`}
                style={{ fontSize: 9, padding: '3px 8px' }}
              >
                {choiceLabel(options, 'gallery.funnel_stage', stage)}
              </span>
            )}
            <span className={`pill ${original}`}>
              {choiceLabel(options, 'catalog.availability_status', original)}
            </span>
            {sentAt && <span className="pill pending">Sent {fmtDateTime(sentAt)}</span>}
          </div>
          {showActivity && w.funnel?.activity && (
            <div className="awc-spec">{activityLine(w.funnel.activity)}</div>
          )}
        </div>
      </div>
      <div className="awc-ctrl">
        <label className="ctrl-lab" htmlFor={`st_${w.id}`}>
          Your availability
        </label>
        {/* the old v885 `.dzsel` panel is a JS-placed popover; the same
            page's `.statussel` native select carries the control here */}
        <select
          id={`st_${w.id}`}
          className="statussel"
          value={draft.status ?? original}
          onChange={(e) => onPatch({ status: e.target.value })}
        >
          {statusOpts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {/* v1163 · §75 — the provider lane: what YOU tell Darz. Darz reviews
            the update and decides what collectors see. */}
        <div className="ctrl-sub">
          Darz reviews your update and decides what collectors see.
        </div>

        <button
          type="button"
          className={`more-link${advOpen ? ' open' : ''}`}
          onClick={onToggleAdv}
        >
          <span className="ml-lab">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add a price change or note
          </span>
          <span className="ml-cw">
            <svg className="chev" width="12" height="8" viewBox="0 0 12 8">
              <path d="M1 1l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        <div className={`adv${advOpen ? ' show' : ''}`}>
          <div className="row2">
            <div className="fld">
              <label htmlFor={`pr_${w.id}`}>New price</label>
              <input
                id={`pr_${w.id}`}
                inputMode="decimal"
                placeholder="e.g. 12,000"
                value={draft.price ?? ''}
                onChange={(e) => onPatch({ price: e.target.value })}
                onBlur={(e) => onPatch({ price: fmtThousands(e.target.value) })}
              />
            </div>
            <div className="fld">
              <label htmlFor={`cur_${w.id}`}>Currency</label>
              <select
                id={`cur_${w.id}`}
                value={draft.currency ?? ''}
                onChange={(e) => onPatch({ currency: e.target.value })}
              >
                <option value="">—</option>
                {currencies.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="fld">
            <label htmlFor={`city_${w.id}`}>City / location</label>
            <input
              id={`city_${w.id}`}
              placeholder="Where the work is located"
              value={draft.city ?? ''}
              onChange={(e) => onPatch({ city: e.target.value })}
            />
          </div>
          <div className="fld">
            <label htmlFor={`ship_${w.id}`}>Shipping &amp; delivery note</label>
            <textarea
              id={`ship_${w.id}`}
              placeholder="Crating, lead time, who arranges delivery…"
              value={draft.shippingNote ?? ''}
              onChange={(e) => onPatch({ shippingNote: e.target.value })}
            />
          </div>
          <div className="fld">
            <label htmlFor={`prov_${w.id}`}>Provenance</label>
            <textarea
              id={`prov_${w.id}`}
              placeholder="Ownership history, if any — one entry per line"
              value={draft.provenance ?? ''}
              onChange={(e) => onPatch({ provenance: e.target.value })}
            />
          </div>
          <div className="checks">
            <label className="chk">
              <input
                type="checkbox"
                checked={!!draft.needsCorrection}
                onChange={(e) => onPatch({ needsCorrection: e.target.checked })}
              />
              Some details need correcting
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={!!draft.imageNeedsUpdate}
                onChange={(e) => onPatch({ imageNeedsUpdate: e.target.checked })}
              />
              The image needs updating
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={!!draft.viewing}
                onChange={(e) => onPatch({ viewing: e.target.checked })}
              />
              Available for a private viewing
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={!!draft.hold2w}
                onChange={(e) => onPatch({ hold2w: e.target.checked })}
              />
              Can hold this work for two weeks
            </label>
          </div>
          <div className="fld">
            <label htmlFor={`note_${w.id}`}>Note for Darz</label>
            <textarea
              id={`note_${w.id}`}
              placeholder="Anything we should know…"
              value={draft.note ?? ''}
              onChange={(e) => onPatch({ note: e.target.value })}
            />
          </div>

          {/* v1135 — rides this card's Send update; Darz applies it on
              review (G-PORT-8: no direct write, no auto-decline engine) */}
          <div className="offblk">
            <div className="offblk-seam" />
            <div className="offblk-h">What collectors can do</div>
            <div className="offblk-sub">
              Choose which actions appear on this work in the Darz app.
            </div>
            <div className="offact-grid">
              {actions.map((a) => (
                <label className="offact" key={a.value}>
                  <input
                    type="checkbox"
                    checked={acts.includes(a.value)}
                    onChange={(e) => toggleAct(a.value, e.target.checked)}
                  />
                  {a.label}
                </label>
              ))}
            </div>
            <div className="offblk-div" />
            <div className="offblk-h">Minimum offer you’ll accept</div>
            <div className="offlock">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>
                Private — never shown to collectors. Darz uses it when handling offers for you.
              </span>
            </div>
            <div className="offfloor-row">
              <div className="fld">
                <input
                  inputMode="decimal"
                  aria-label="Minimum offer"
                  placeholder="e.g. 10,000"
                  value={draft.offerFloor ?? ''}
                  onChange={(e) => onPatch({ offerFloor: e.target.value })}
                  onBlur={(e) => onPatch({ offerFloor: fmtThousands(e.target.value) })}
                />
              </div>
              <select
                className="off-cur"
                aria-label="Offer currency"
                value={draft.offerCurrency ?? s.currency ?? ''}
                onChange={(e) => onPatch({ offerCurrency: e.target.value })}
              >
                {currencies.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="awc-foot">
          {/* an untouched card's send IS the old page's availability
              confirmation (kind availability, no status key) — label it as
              what it does, the plainest "artwork availability" action */}
          <button className="btn btn--primary" type="button" disabled={busy} onClick={onSend}>
            {busy
              ? 'Sending…'
              : sentAt
                ? 'Send again'
                : dirty
                  ? 'Send update'
                  : 'Confirm available'}
          </button>
          {sentAt && <span className="sent-tag">Sent to Darz</span>}
        </div>
      </div>
    </div>
  );
}

function activityLine(a: NonNullable<NonNullable<PortalWork['funnel']>['activity']>): string {
  const p: string[] = [];
  if (a.views > 0) p.push(`${a.views} views`);
  if (a.saves > 0) p.push(`${a.saves} saved`);
  if (a.requests > 0) p.push(`${a.requests} request${a.requests > 1 ? 's' : ''}`);
  if (a.offers > 0) p.push(`${a.offers} offer${a.offers > 1 ? 's' : ''}`);
  if (a.holds > 0) p.push(`${a.holds} hold`);
  return p.length ? p.join(' · ') : 'No collector activity yet.';
}

/* ── the new-work card (old newCard(), :1378) ───────────────────────────── */

function NewCard({
  n,
  options,
  onSet,
  onSend,
  onRemove,
}: {
  n: NewWorkDraft;
  options: OptionsMap | null;
  onSet: (patch: Partial<NewWorkDraft>) => void;
  onSend: () => void;
  onRemove: () => void;
}) {
  const statusOpts = choices(options, 'catalog.availability_status');
  const currencies = choices(options, 'currency');
  if (n.submitted) {
    return (
      <div className="awc isnew">
        <div className="awc-top">
          <div className="awc-img">
            <span className="noimg">No image</span>
          </div>
          <div className="awc-body">
            <div className="awc-srow" style={{ margin: '0 0 6px' }}>
              <span className="newbadge">New · sent</span>
            </div>
            <div className="awc-artist">{n.artist || '—'}</div>
            <div className="awc-title">{n.title || 'Untitled'}</div>
            <div className="awc-spec">
              {[n.year, prettyMedium(n.medium), n.dimensions].filter(Boolean).join(' · ')}
            </div>
            <div className="awc-spec">
              <b>{n.price ? `${fmtThousands(n.price)} ${n.currency}` : 'Price on request'}</b>
            </div>
            <div className="newhint" style={{ color: 'var(--green)' }}>
              Submitted to Darz for review.
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="awc isnew">
      <div className="awc-top">
        <div className="awc-img">
          <span className="noimg">No image</span>
        </div>
        <div className="awc-body">
          <div className="awc-srow" style={{ margin: '0 0 8px' }}>
            <span className="newbadge">New</span>
          </div>
          <div className="fld">
            <label htmlFor={`na_${n.tid}`}>Artist *</label>
            <input
              id={`na_${n.tid}`}
              value={n.artist}
              onChange={(e) => onSet({ artist: e.target.value })}
            />
          </div>
          <div className="fld">
            <label htmlFor={`nt_${n.tid}`}>Title</label>
            <input
              id={`nt_${n.tid}`}
              value={n.title}
              onChange={(e) => onSet({ title: e.target.value })}
            />
          </div>
          <div className="row2">
            <div className="fld">
              <label htmlFor={`ny_${n.tid}`}>Year</label>
              <input
                id={`ny_${n.tid}`}
                inputMode="numeric"
                value={n.year}
                onChange={(e) => onSet({ year: e.target.value })}
              />
            </div>
            <div className="fld">
              <label htmlFor={`nm_${n.tid}`}>Medium</label>
              <input
                id={`nm_${n.tid}`}
                value={n.medium}
                onChange={(e) => onSet({ medium: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="awc-ctrl">
        <div className="fld">
          <label htmlFor={`nd_${n.tid}`}>Size (cm)</label>
          <input
            id={`nd_${n.tid}`}
            placeholder="e.g. 120 x 150 cm"
            value={n.dimensions}
            onChange={(e) => onSet({ dimensions: e.target.value })}
          />
        </div>
        <div className="row2">
          <div className="fld">
            <label htmlFor={`np_${n.tid}`}>Price</label>
            <input
              id={`np_${n.tid}`}
              inputMode="decimal"
              placeholder="e.g. 12,000"
              value={n.price}
              onChange={(e) => onSet({ price: e.target.value })}
              onBlur={(e) => onSet({ price: fmtThousands(e.target.value) })}
            />
          </div>
          <div className="fld">
            <label htmlFor={`nc_${n.tid}`}>Currency</label>
            <select
              id={`nc_${n.tid}`}
              value={n.currency}
              onChange={(e) => onSet({ currency: e.target.value })}
            >
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="fld">
          <label htmlFor={`ns_${n.tid}`}>Availability</label>
          <select
            id={`ns_${n.tid}`}
            className="statussel"
            value={n.status}
            onChange={(e) => onSet({ status: e.target.value })}
          >
            {statusOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="fld" style={{ marginTop: 11 }}>
          <label htmlFor={`nn_${n.tid}`}>Note for Darz (optional)</label>
          <textarea
            id={`nn_${n.tid}`}
            placeholder="Edition, provenance, anything we should know…"
            value={n.note}
            onChange={(e) => onSet({ note: e.target.value })}
          />
        </div>
        <div className="awc-foot">
          <button className="btn btn--primary" type="button" onClick={onSend}>
            Submit this work
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            style={{ color: 'var(--red)' }}
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
