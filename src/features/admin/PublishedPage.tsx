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
 *  - the stats strip (`:553`): Live for collectors · Hidden by a gap (the
 *    published-with-no-image count — Data Health's own `published_but_
 *    hidden` check, the same fact the old `_appMissing` computed);
 *  - the search box ("Search published works…", `:548`) — the collector
 *    list's real `search` param;
 *  - the card actions (`:559`): "Remove from Market App" verbatim; "Edit"
 *    opens the Database editor. "Confirm available" is the Phase-10
 *    freshness loop and waits with it (G-CAT-9);
 *  - the toolbar links (`:549-551`): App Design, and "Open the Market App ↗"
 *    — here the collector app is this same site, opened in a new tab;
 *  - the empty copy (`:562`), trimmed of the gallery/artist sources that
 *    are later phases.
 *
 * The list endpoint is the COLLECTOR catalogue — the PUBLIC published slice,
 * with images and resolved artists. Found live: this is `visible_all` works
 * only — a published work with Selected/Private-selection visibility reaches
 * its collectors through the Club's grants and is absent here, so the tile
 * says "in the public catalogue", not "published". The old desk's
 * every-published-work number stays unavailable until G-CAT-2's
 * `is_published` filter exists; the sub-line says where the private layer
 * lives.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { Artwork, CatalogueQuery, DataHealthReport } from '../../api/types';
import { useListController } from '../shared/useListController';
import { ListController } from '../shared/ListController';
import type { CatalogService } from '../../api/services';
import type { Paginated } from '../../api/types';
import { ConfirmDialog, DeskBanner, DeskPage, Pager, SearchFilter } from './kit';
import './admin.css';

class PublishedController extends ListController<Artwork, CatalogueQuery> {
  private readonly catalog: CatalogService;
  constructor(catalog: CatalogService) {
    super({ per_page: 24 });
    this.catalog = catalog;
  }
  protected fetchPage(query: CatalogueQuery): Promise<Paginated<Artwork>> {
    return this.catalog.artworks(query);
  }
}

export function PublishedPage() {
  const { catalog, catalogAdmin } = useApi();
  const navigate = useNavigate();

  const { state, setQuery, setPage, reload } = useListController<Artwork, CatalogueQuery>(
    () => new PublishedController(catalog),
  );

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

  const [removing, setRemoving] = useState<Artwork | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (w: Artwork) => {
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
        <SearchFilter
          label="Search"
          value={state.query.search}
          onChange={(search) => setQuery({ search })}
          placeholder="Search published works…"
        />
      }
    >
      <p className="ad-desksub">
        The works collectors see in the public catalogue. Publication is its own layer — a work
        joins from the Database's ✓ APP toggle and is live the moment it is set. A published
        work with Selected / Private-selection visibility reaches its collectors through the{' '}
        <Link to="/admin/club">Collector Club</Link>, not this public list.
      </p>

      <div className="ad-tiles ad-tiles-sales">
        <Stat label="In the public catalogue" value={total} />
        <Stat
          label="Hidden by a gap"
          value={health ? health.published_but_hidden.count : undefined}
          tone={health && health.published_but_hidden.count > 0 ? 'attn' : undefined}
          hint="published with zero images — collectors can never see them (Data Health)"
        />
      </div>

      {error && <DeskBanner>{error}</DeskBanner>}
      {state.status === 'loading' && !state.results.length && (
        <p className="dz-state">Loading…</p>
      )}
      {state.status === 'error' && <DeskBanner>{state.error}</DeskBanner>}

      {state.results.length > 0 && (
        <div className="ad-pubgrid">
          {state.results.map((w) => (
            <figure key={w.id} className="ad-pubcard">
              {w.images.length > 0 ? (
                <img
                  src={w.images[0].image_url}
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
                <span className="ad-cellmain">{w.artist?.display_name || '—'}</span>
                <span className="ad-cellsub">
                  {w.title}
                  {w.year ? `, ${w.year}` : ''}
                </span>
                <span className="ad-rowacts">
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
          {state.query.search
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
