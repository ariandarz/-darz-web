/**
 * PublishedPage — `/admin/published`, the Market App group's "Published
 * works" tab (`marketView()`, `workspaces-runtime.js:533`; the tab at
 * `darz-studio.html:11729`).
 *
 * Ported content:
 *  - the page title "Market App" and the sub-line's surviving fact:
 *    *"The works collectors see. Publication is its own layer"* (`:560`) —
 *    the rest of that sentence described the old device-selection +
 *    Publish-to-App snapshot, which does not exist here: a work's ✓ APP is
 *    live the moment it is set (per-work `publish/`), so the "Selected on
 *    this device vs live in cloud" pair of stats collapses into ONE number;
 *  - the stats strip (`workspaces-runtime.js:747-750`): Live for collectors
 *    (every published work) · Need reconfirmation (G-CAT-9: published works
 *    whose source has not confirmed them in 30 days — due + stale + risky,
 *    three `per_page: 1` reads) · Hidden by a gap (the
 *    published-with-no-image count — Data Health's own `published_but_
 *    hidden` check, the same fact the old `_appMissing` computed);
 *  - the reconfirmation alert under it (`:751`), verbatim, its "Review
 *    them →" switching the list to the old filter "Availability needs
 *    reconfirmation" (`:742`, `?needs_reconfirmation=true`). The filter's
 *    other two options (Reserved · sold · withdrawn / Missing image, size or
 *    price) are not ported — the published list has no such server slice;
 *  - the search box ("Search published works…", `:743`) — the admin list's
 *    `search` param;
 *  - the card actions (`:559`, `:752`): "Confirm available" (stamps today,
 *    the same `spConfirm` and toast as the Sources tile) and "Remove from
 *    Market App" verbatim; "Edit" opens the Database editor. The freshness
 *    pill rides above them. Both appear only on a SOURCE-LINKED work that is
 *    still active — the server's loop counts nothing else, so on a
 *    Darz-inventory work they would stamp a date no count reads. The pill
 *    prints the server's label (the Sources desk's words, "Confirmed 12d
 *    ago" / "Needs update" / …); the old Market card used the workspace's
 *    shorter set ("Fresh / Review soon / Needs update", `:52-53`) for the
 *    same bands — one vocabulary here, flagged;
 *  - the toolbar links (`:549-551`): App Design, and "Open the Market App ↗"
 *    — here the collector app is this same site, opened in a new tab;
 *  - the empty copy (`:562`), trimmed of the gallery/artist sources that
 *    are later phases.
 *
 * **The list is the ADMIN catalogue filtered `?published=true`** (V1 Phase 4)
 * — every published work, whatever its visibility, as the old desk listed
 * every `inApp` work (`:729`). It used to read the collector catalogue, which
 * serves `visible_all` works only, so published Selected / Private-selection
 * works were missing and the tile had to say "in the public catalogue". The
 * rows carry `thumb` and `artist_name` (G-CAT-1). A non-public card names its
 * visibility, so an admin can tell who actually sees it (an addition, flagged).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type {
  ArtworkAdmin,
  ArtworkAdminQuery,
  Choice,
  DataHealthReport,
} from '../../api/types';
import { useListController } from '../shared/useListController';
import { ArtworksController } from './ArtworksController';
import {
  ConfirmDialog,
  DeskBanner,
  DeskPage,
  DeskToast,
  Pager,
  SearchFilter,
  SelectFilter,
  useDeskToast,
} from './kit';
import { FreshPill } from './FreshnessControls';
import { isSourceLinked, marketRemindParts, takesPart } from './freshness';
import { useConfirmAvailable } from './useConfirmAvailable';
import './admin.css';

export function PublishedPage() {
  const { catalogAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  // The Database's own controller, fixed to the published slice.
  const { state, setQuery, setPage, reload } = useListController<
    ArtworkAdmin,
    ArtworkAdminQuery
  >(() => new ArtworksController(catalogAdmin, { published: true, per_page: 24 }));
  const visibilities = (options?.['catalog.visibility'] as Choice[] | undefined) ?? [];

  // "Hidden by a gap" — Data Health's published_but_hidden count (:557's
  // fact on this backend)
  const [health, setHealth] = useState<DataHealthReport | null>(null);
  const loadHealth = useCallback(() => {
    catalogAdmin.dataHealth().then(
      (r) => setHealth(r),
      () => setHealth(null),
    );
  }, [catalogAdmin]);
  useEffect(loadHealth, [loadHealth]);

  // "Need reconfirmation" (:749) — the published works in each overdue band,
  // one `per_page: 1` read per band; `null` until known
  const [bands, setBands] = useState<{ due: number; stale: number; risky: number } | null>(
    null,
  );
  const loadBands = useCallback(() => {
    const count = (freshness: 'due' | 'stale' | 'risky') =>
      catalogAdmin
        .artworks({ published: true, freshness, per_page: 1 })
        .then((p) => p.pagination.total_count);
    Promise.all([count('due'), count('stale'), count('risky')]).then(
      ([due, stale, risky]) => setBands({ due, stale, risky }),
      () => setBands(null),
    );
  }, [catalogAdmin]);
  useEffect(loadBands, [loadBands]);
  const needs = bands ? bands.due + bands.stale + bands.risky : undefined;

  const [removing, setRemoving] = useState<ArtworkAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { say, message } = useDeskToast();
  const { busyId, confirm } = useConfirmAvailable({
    say,
    setError,
    onDone: () => {
      void reload();
      loadBands();
    },
  });

  const remove = async (w: ArtworkAdmin) => {
    setError(null);
    try {
      await catalogAdmin.unpublishArtwork(w.id);
      await reload();
      loadHealth();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove it from the app.');
    }
  };

  const total = state.pagination?.total_count;

  return (
    <DeskPage
      wide
      title="Market App"
      action={
        <span className="ad-rowacts">
          <Link className="ad-ghostbtn" to="/admin/design">
            App Design
          </Link>
          <a className="ad-ghostbtn" href="/" target="_blank" rel="noreferrer">
            Open the Market App ↗
          </a>
        </span>
      }
      toolbar={
        <>
          <SearchFilter
            label="Search"
            value={state.query.search}
            onChange={(search) => setQuery({ search })}
            placeholder="Search published works…"
          />
          {/* :742 — the old filter, cut to the slice the server serves */}
          <SelectFilter
            label="Show"
            anyLabel="All published works"
            value={state.query.needs_reconfirmation ? 'attention' : undefined}
            onChange={(v) => setQuery({ needs_reconfirmation: v ? true : undefined })}
            choices={[{ value: 'attention', label: 'Availability needs reconfirmation' }]}
          />
        </>
      }
      subtitle={
        <>
          The works collectors see. Publication is its own layer — a work joins from the
          Database's ✓ APP toggle and is live the moment it is set. A published work with
          Selected / Private-selection visibility reaches only the collectors the{' '}
          <Link to="/admin/club">Collector Club</Link> grants it to.
        </>
      }
      strip={
        <>
          <div className="ad-tiles ad-tiles-sales">
            <Stat label="Live for collectors" value={total} />
            <Stat
              label="Need reconfirmation"
              value={needs}
              tone={needs ? 'attn' : undefined}
              hint={
                needs
                  ? 'availability not confirmed inside the review period'
                  : 'every published work is current'
              }
            />
            <Stat
              label="Hidden by a gap"
              value={health ? health.published_but_hidden.count : undefined}
              tone={health && health.published_but_hidden.count > 0 ? 'attn' : undefined}
              hint="published with zero images — collectors can never see them (Data Health)"
            />
          </div>
        </>
      }
    >
      {/* :751 — the reconfirmation alert, verbatim */}
      {bands && needs ? (
        <div className="ad-remind">
          <span>
            <b>
              {needs} published work{needs === 1 ? '' : 's'}
            </b>{' '}
            need{needs === 1 ? 's' : ''} availability reconfirmation —{' '}
            {marketRemindParts(bands)}. Nothing is removed automatically; ask the sources, then
            confirm.
          </span>
          <button type="button" onClick={() => setQuery({ needs_reconfirmation: true })}>
            Review them →
          </button>
        </div>
      ) : null}
      {error && <DeskBanner>{error}</DeskBanner>}
      {state.status === 'loading' && !state.results.length && (
        <p className="dz-state">Loading…</p>
      )}
      {state.status === 'error' && <DeskBanner>{state.error}</DeskBanner>}

      {state.results.length > 0 && (
        <div className="ad-pubgrid">
          {state.results.map((w) => (
            <figure key={w.id} className="ad-pubcard">
              {w.thumb ? (
                <img
                  src={w.thumb}
                  alt={w.title}
                  loading="lazy"
                  onClick={() => navigate(`/admin/artworks/${w.id}`)}
                />
              ) : (
                <div
                  className="ad-pubnoimg"
                  title="No image — collectors never see this work"
                  onClick={() => navigate(`/admin/artworks/${w.id}`)}
                >
                  no image
                </div>
              )}
              <figcaption>
                <span className="ad-cellmain">
                  {w.artist_name || w.artist_name_raw || '—'}
                </span>
                <span className="ad-cellsub">
                  {w.title}
                  {w.year ? `, ${w.year}` : ''}
                </span>
                {w.visibility && w.visibility !== 'visible_all' && (
                  <span className="ad-cellsub">
                    {visibilities.find((c) => c.value === w.visibility)?.label ?? w.visibility}
                  </span>
                )}
                {isSourceLinked(w) && takesPart(w) && <FreshPill f={w.freshness} />}
                <span className="ad-rowacts">
                  {isSourceLinked(w) && takesPart(w) && (
                    <button
                      type="button"
                      className="ad-rowbtn"
                      disabled={busyId === w.id}
                      onClick={() => void confirm(w)}
                    >
                      Confirm available
                    </button>
                  )}
                  <button
                    type="button"
                    className="ad-rowbtn"
                    onClick={() => navigate(`/admin/artworks/${w.id}`)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ad-rowbtn is-danger"
                    onClick={() => setRemoving(w)}
                  >
                    Remove from Market App
                  </button>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {state.status === 'idle' && state.results.length === 0 && (
        <p className="dz-state">
          {state.query.search || state.query.needs_reconfirmation
            ? 'No published works match.'
            : 'Nothing is in the Market App yet — add works from the Artworks Database.'}
        </p>
      )}

      {state.pagination && <Pager pagination={state.pagination} onPage={setPage} />}

      {removing && (
        <ConfirmDialog
          message={`Remove “${removing.title}” from the Market App? Collectors stop seeing it immediately; the record stays in the Database.`}
          okLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const w = removing;
            setRemoving(null);
            void remove(w);
          }}
        />
      )}
      <DeskToast message={message} />
    </DeskPage>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | null | undefined;
  tone?: 'attn';
  hint?: string;
}) {
  return (
    <div className={`ad-tile${tone ? ` is-${tone}` : ''}`} title={hint}>
      <span className="ad-tile-v">{value == null ? '…' : value}</span>
      <span className="ad-tile-l">{label}</span>
    </div>
  );
}
