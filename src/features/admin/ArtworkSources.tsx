/**
 * ArtworkSources — the "Artwork Sources" tab of Galleries & Sources
 * (`spSharedBody`, `darz-studio.html:27426-27442`; the tab is `shared` in the
 * old list at `:27293`), over the source-freshness API (G-CAT-9, backend
 * 2026-10-01).
 *
 * Ported content:
 *  - the toolbar (`:27431-27435`): the search, "All sources" (Galleries ·
 *    Dealers · Artists → `source_type`), the confirmation select verbatim
 *    (`freshness.ts::FRESHNESS_FILTERS`) and "Market App: all / In the app /
 *    Not in the app" (`published`);
 *  - the reminder banner (`spRemindBanner`, `:27444-27453`) from the server's
 *    summary, its "Review them →" switching the list to "Needs attention";
 *  - the intro line (`:27437`), trimmed of "Use the dropdowns on any card to
 *    assign or change its source" — a work's source is set in its editor here;
 *  - the tiles (`spArtTile`, `:27182-27196`): image (opens the work),
 *    artist, "title, year", "<type> · <source>", the In app / status tags,
 *    and under every work that takes part the confirm row
 *    (`FreshnessControls.tsx`);
 *  - "✓ Confirm all available" per source (`:27362`, `spConfirmAll`
 *    `:38157-38158`) with its confirm and toasts verbatim;
 *  - the owner card "Protect the Market App from outdated works"
 *    (`spHideSettingsCard`, `:27454-27463`) over
 *    `GET/PATCH …/sources/freshness-settings/`, with its toasts (`:38159`).
 *
 * Built differently, and why:
 *  - **The summary strip is new on this tab.** The old tab had the banner only;
 *    the strip borrows the Market App desk's "Need reconfirmation" tile
 *    (`workspaces-runtime.js:749`) and adds one tile per band, each labelled
 *    with the old confirmation select's own words and opening that filter;
 *  - **per-source "Confirm all" is a table**, not a picked-source header: the
 *    server's rollup (`freshness-summary.by_source`) is keyed by the work's
 *    free-text `source_name` (trimmed, case-folded), which is not the same
 *    thing as a partner record, so it gets its own list instead of riding the
 *    Partners cards. A row with a type and no name cannot be confirmed in
 *    bulk — `sources/confirm/` by type alone would also stamp every NAMED
 *    source of that type — so its button is withheld and says why;
 *  - the old search matched the source name too; the admin list's `search`
 *    covers artist / title / medium / dimensions only, so the placeholder
 *    says what it does. "Show works" on a rollup row filters by the source
 *    name (an exact `source`) instead;
 *  - the old list sorted most-overdue first under a confirmation filter
 *    (`:27428`); the API has no freshness ordering, so it pages in the
 *    Database's order;
 *  - "Needs attention" is the server's `needs_reconfirmation`, which does not
 *    drop sold / withdrawn / archived works the way the summary counts do —
 *    such a work can appear under it, with its status tag and no confirm row;
 *  - the old fourth select (All works · Recently added · Incomplete ·
 *    Archived) and the v1230 "Review periods" row are not ported: the first
 *    is the Database's job, the second has nothing to write (the bands are
 *    server constants).
 *
 * Editing the hide setting is OWNER-only here, as the brief and the backend's
 * own docstring call it the owner's toggle; a standard admin reads it.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useOptions, useSession } from '../../api/hooks';
import type {
  ArtworkAdmin,
  ArtworkAdminQuery,
  Choice,
  FreshnessSummary,
  SourceFreshnessSettings,
  SourceRollup,
} from '../../api/types';
import { useListController } from '../shared/useListController';
import { asAdminRole } from './adminNav';
import { ArtworksController } from './ArtworksController';
import { ConfirmRow } from './FreshnessControls';
import {
  FRESHNESS_FILTERS,
  freshnessFilterOf,
  freshnessQuery,
  hideDayChoices,
  remindParts,
  takesPart,
  type FreshnessFilter,
} from './freshness';
import {
  ConfirmDialog,
  DataTable,
  DeskBanner,
  DeskToast,
  FilterChips,
  Pager,
  SearchFilter,
  SelectFilter,
  useDeskToast,
  type Column,
} from './kit';
import { useConfirmAvailable } from './useConfirmAvailable';
import './admin.css';

/** `:27432` — the source kinds, onto `Artwork.SOURCE_TYPE_CHOICES`. */
const SOURCE_KINDS = [
  { value: 'gallery', label: 'Galleries' },
  { value: 'dealer', label: 'Dealers' },
  { value: 'artist', label: 'Artists' },
];

/** `:27434` — the Market App select. */
const IN_APP = [
  { value: 'shown', label: 'In the app' },
  { value: 'hidden', label: 'Not in the app' },
];

function isFilter(v: string | null): v is FreshnessFilter {
  return !!v && FRESHNESS_FILTERS.some((f) => f.value === v);
}

export function ArtworkSources({ sourceTypes }: { sourceTypes: Choice[] }) {
  const { catalogAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();
  const { me } = useSession();
  const isOwner = asAdminRole(me?.role) === 'owner';
  const [params, setParams] = useSearchParams();
  const { say, message } = useDeskToast();
  const [error, setError] = useState<string | null>(null);
  const statuses = (options?.['catalog.availability_status'] as Choice[] | undefined) ?? [];

  // `?fresh=attention` — the Partners tab's banner arrives with the filter on
  const fromUrl = params.get('fresh');
  const { state, setQuery, setPage, reload } = useListController<
    ArtworkAdmin,
    ArtworkAdminQuery
  >(
    () =>
      new ArtworksController(catalogAdmin, {
        ...freshnessQuery(isFilter(fromUrl) ? fromUrl : undefined),
        per_page: 24,
      }),
  );
  const q = state.query;
  const filter = freshnessFilterOf(q);
  const setFilter = (f: FreshnessFilter | undefined) => {
    setQuery(freshnessQuery(f));
    const next = new URLSearchParams(params);
    if (f) next.set('fresh', f);
    else next.delete('fresh');
    setParams(next, { replace: true });
  };

  const [summary, setSummary] = useState<FreshnessSummary | null>(null);
  const loadSummary = useCallback(() => {
    catalogAdmin.freshnessSummary().then(
      (s) => setSummary(s),
      () => setSummary(null),
    );
  }, [catalogAdmin]);
  useEffect(loadSummary, [loadSummary]);

  const refresh = () => {
    void reload();
    loadSummary();
  };
  const { busyId, confirm, confirmAs } = useConfirmAvailable({
    say,
    setError,
    onDone: refresh,
  });

  // ---- "✓ Confirm all available" per source (:27362, :38157-38158) ----
  const [confirming, setConfirming] = useState<SourceRollup | null>(null);
  const confirmSource = async (r: SourceRollup) => {
    setError(null);
    try {
      const out = await catalogAdmin.confirmSource({ source_name: r.source_name });
      const n = out.confirmed;
      say(n ? `${n} work${n === 1 ? '' : 's'} confirmed` : 'No active works to confirm');
      refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not confirm the source.');
    }
  };

  const typeLabel = (v: string | null | undefined) =>
    sourceTypes.find((c) => c.value === v)?.label ?? (v || '');
  const statusLabel = (v: string | null | undefined) =>
    statuses.find((c) => c.value === v)?.label ?? (v || '');

  const rollupCols: ReadonlyArray<Column<SourceRollup>> = [
    {
      key: 'source',
      header: 'Source',
      cell: (r) => (
        <>
          <span className="ad-cellmain">{r.source_name || '—'}</span>
          {r.source_type && <span className="ad-cellsub">{typeLabel(r.source_type)}</span>}
        </>
      ),
    },
    { key: 'total', header: 'Active works', cell: (r) => r.total.toLocaleString('en-US') },
    {
      key: 'needs',
      header: 'Need confirmation',
      cell: (r) =>
        r.needs_reconfirmation > 0 ? (
          <span className="sp-needs">{r.needs_reconfirmation} need confirmation</span>
        ) : (
          <span className="ad-cellsub">all current</span>
        ),
    },
    {
      key: 'acts',
      header: '',
      cell: (r) => (
        <span className="ad-rowacts">
          <button
            type="button"
            className="ad-rowbtn"
            onClick={() =>
              setQuery(
                r.source_name
                  ? { source: r.source_name, source_type: undefined }
                  : { source: undefined, source_type: r.source_type || undefined },
              )
            }
          >
            Show works
          </button>
          {r.source_name ? (
            <button
              type="button"
              className="ad-rowbtn"
              title="Mark every active work from this source as confirmed available today"
              disabled={r.total === 0}
              onClick={() => setConfirming(r)}
            >
              ✓ Confirm all available
            </button>
          ) : (
            <span
              className="ad-cellsub"
              title="Works with a source type and no source name can only be confirmed one by one — confirming by type would also stamp every named source of that type."
            >
              confirm one by one
            </span>
          )}
        </span>
      ),
    },
  ];

  const total = summary?.needs_reconfirmation ?? 0;

  return (
    <>
      {/* the strip — see the header: new on this tab, worded from the old
          confirmation select, each tile opening its filter */}
      <div className="ad-tiles ad-tiles-sales sp-freshtiles">
        <FreshTile
          label="Need reconfirmation"
          value={summary?.needs_reconfirmation}
          tone={total > 0 ? 'attn' : undefined}
          hint="due, stale or risky — not confirmed by their source in the last 30 days"
          on={filter === 'attention'}
          onClick={() => setFilter('attention')}
        />
        {(['risky', 'stale', 'due', 'new', 'fresh'] as const).map((s) => (
          <FreshTile
            key={s}
            label={FRESHNESS_FILTERS.find((f) => f.value === s)?.label ?? s}
            value={summary?.[s]}
            on={filter === s}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      <div className="ad-toolbar">
        <SearchFilter
          label="Search"
          value={q.search}
          onChange={(search) => setQuery({ search })}
          placeholder="Search shared artworks — artist, title…"
        />
        <SelectFilter
          label="Source"
          anyLabel="All sources"
          value={q.source_type}
          onChange={(source_type) => setQuery({ source_type })}
          choices={SOURCE_KINDS}
        />
        <SelectFilter
          label="Confirmation"
          anyLabel="Confirmation: all"
          value={filter}
          onChange={(f) => setFilter(isFilter(f ?? null) ? (f as FreshnessFilter) : undefined)}
          choices={FRESHNESS_FILTERS}
        />
        <SelectFilter
          label="Market App"
          anyLabel="Market App: all"
          value={q.published === undefined ? undefined : q.published ? 'shown' : 'hidden'}
          onChange={(v) =>
            setQuery({ published: v === undefined ? undefined : v === 'shown' })
          }
          choices={IN_APP}
        />
      </div>

      {q.source && (
        /* the Database desk's own chip for the same filter ("Source: …") */
        <FilterChips
          chips={[
            {
              key: 'source',
              label: `Source: ${q.source}`,
              onClear: () => setQuery({ source: undefined }),
            },
          ]}
          onClearAll={() => setQuery({ source: undefined })}
        />
      )}

      {/* :27444-27453 — spRemindBanner */}
      {total > 0 && summary && (
        <div className="ad-remind">
          <span>
            <b>
              {total} artwork{total === 1 ? '' : 's'}
            </b>{' '}
            need source confirmation — {remindParts(summary)}. Reach out to the galleries, then
            mark each one confirmed.
          </span>
          <button type="button" onClick={() => setFilter('attention')}>
            Review them →
          </button>
        </div>
      )}

      {error && <DeskBanner>{error}</DeskBanner>}

      {/* :27437, trimmed — see the header */}
      <p className="ad-cellsub sp-intro">
        Every artwork attributed to a gallery, dealer or artist. <b>Confirm</b> records that a
        source has re-checked a work is still available — that keeps the Market App a trusted,
        current inventory.
      </p>

      {summary && summary.by_source.length > 0 && (
        <section className="ad-dsec">
          <div className="ad-dsec-h">
            <h2 className="ad-dsec-t">By source</h2>
            <span className="ad-dsec-n">
              active works only — sold, withdrawn and archived ones need no confirming
            </span>
          </div>
          <DataTable
            label="Sources"
            rows={summary.by_source}
            columns={rollupCols}
            rowKey={(r) => `${r.source_name.toLowerCase()}|${r.source_type}`}
          />
        </section>
      )}

      {state.status === 'loading' && !state.results.length && (
        <p className="dz-state">Loading…</p>
      )}
      {state.status === 'error' && <DeskBanner>{state.error}</DeskBanner>}
      {state.status === 'idle' && state.results.length === 0 && (
        /* :27439 — the first half verbatim; the second ("Assign a source with
           the Gallery / Dealer / Artist dropdown on any artwork card") names
           a control this port does not have */
        <p className="dz-state">
          {filter
            ? 'No works match this confirmation filter.'
            : 'No works attributed yet. Give a work a source in its editor and it appears here.'}
        </p>
      )}

      {state.results.length > 0 && (
        <div className="sp-artgrid">
          {state.results.map((w) => (
            <div key={w.id} className="sp-artcard">
              <div
                className="sp-artimg"
                title="Open this artwork"
                onClick={() => navigate(`/admin/artworks/${w.id}`)}
              >
                {w.thumb ? <img loading="lazy" src={w.thumb} alt={w.title} /> : 'No image'}
              </div>
              <div className="sp-artb">
                <div className="sp-arta">{w.artist_name || w.artist_name_raw || '—'}</div>
                <div className="sp-artt">
                  {w.title || 'Untitled'}
                  {w.year ? `, ${w.year}` : ''}
                </div>
                <div className="sp-artsrc">
                  {[typeLabel(w.source_type), w.source_name].filter(Boolean).join(' · ')}
                </div>
                <div className="sp-arttags">
                  {w.is_published && <span className="sp-tag app">In app</span>}
                  {!takesPart(w) && (
                    <span className="sp-tag arch">{statusLabel(w.availability_status)}</span>
                  )}
                </div>
                {takesPart(w) && (
                  <ConfirmRow
                    work={w}
                    busy={busyId === w.id}
                    onConfirm={() => void confirm(w)}
                    onConfirmAs={(as) => void confirmAs(w, as)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {state.pagination && <Pager pagination={state.pagination} onPage={setPage} />}

      <HideSettingsCard isOwner={isOwner} say={say} onSaved={loadSummary} />

      {confirming && (
        <ConfirmDialog
          message={`Mark all ${confirming.total} active work${confirming.total === 1 ? '' : 's'} from ${confirming.source_name || 'this source'} as confirmed available today?`}
          okLabel="Confirm"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const r = confirming;
            setConfirming(null);
            void confirmSource(r);
          }}
        />
      )}
      <DeskToast message={message} />
    </>
  );
}

function FreshTile({
  label,
  value,
  tone,
  hint,
  on,
  onClick,
}: {
  label: string;
  value: number | undefined;
  tone?: 'attn';
  hint?: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ad-tile${tone ? ` is-${tone}` : ''}${on ? ' is-on' : ''}`}
      title={hint}
      aria-pressed={on}
      onClick={onClick}
    >
      <span className="ad-tile-v">{value == null ? '…' : value}</span>
      <span className="ad-tile-l">{label}</span>
    </button>
  );
}

/**
 * `spHideSettingsCard` (`:27454-27463`) — the owner's hide-stale switch,
 * copy verbatim. The day select is disabled while the switch is off, as in
 * the old card. Not version-locked server-side, so a save is a plain PATCH.
 */
function HideSettingsCard({
  isOwner,
  say,
  onSaved,
}: {
  isOwner: boolean;
  say: (m: string) => void;
  onSaved: () => void;
}) {
  const { catalogAdmin } = useApi();
  const [settings, setSettings] = useState<SourceFreshnessSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    catalogAdmin.freshnessSettings().then(
      (s) => alive && setSettings(s),
      (err: unknown) =>
        alive && setError(err instanceof Error ? err.message : 'Could not read the setting.'),
    );
    return () => {
      alive = false;
    };
  }, [catalogAdmin]);

  const save = async (body: { hide_unconfirmed?: boolean; hide_after_days?: number }) => {
    if (!settings) return;
    const before = settings;
    // the switch moves on the click; a failed save puts it back
    setSettings({ ...settings, ...body });
    setBusy(true);
    setError(null);
    try {
      setSettings(await catalogAdmin.updateFreshnessSettings(body));
      // :38159 — the switch toasts; the day select does not (:38160)
      if (body.hide_unconfirmed !== undefined)
        say(
          body.hide_unconfirmed
            ? 'Stale works will be hidden from collectors until reconfirmed'
            : 'Stale works stay visible (marked internally only)',
        );
      onSaved();
    } catch (err: unknown) {
      setSettings(before);
      setError(err instanceof Error ? err.message : 'Could not save the setting.');
    } finally {
      setBusy(false);
    }
  };

  const on = !!settings?.hide_unconfirmed;
  const days = settings?.hide_after_days ?? 90;
  const locked = !isOwner || busy || !settings;

  return (
    <div className="sp-setcard">
      <div className="sp-set-t">Protect the Market App from outdated works</div>A work that
      hasn’t been confirmed by its source for a long time stays in the catalogue but is always
      flagged here. You can also hide such works from collectors until a source reconfirms them
      — they are never deleted, and reappear the moment they’re confirmed again.
      <div className="sp-set-row">
        <label className="sp-set-l">
          <input
            type="checkbox"
            checked={on}
            disabled={locked}
            onChange={(e) => void save({ hide_unconfirmed: e.target.checked })}
          />
          Hide unconfirmed works from collectors
        </label>
        <span>
          after{' '}
          <select
            aria-label="Hide after"
            value={days}
            disabled={locked || !on}
            onChange={(e) => void save({ hide_after_days: Number(e.target.value) })}
          >
            {hideDayChoices(days).map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </span>
      </div>
      {!isOwner && (
        <div className="sp-set-note">Only the owner login changes this setting.</div>
      )}
      {error && (
        <p className="dz-state err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
