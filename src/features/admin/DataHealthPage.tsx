/**
 * DataHealthPage — `/admin/data-health` (Operations group), `healthView()`
 * (`darz-studio.html:26360`) over `GET /api/catalog/admin/data-health/`.
 *
 * **Three checks, and the desk says three.** The old desk ran ~8, but five of
 * them diagnose the old app's own client-local-snapshot architecture —
 * tombstone gaps, device-vs-cloud drift, publish-stamp mismatches (`:26374`'s
 * "deleted artworks stay deleted" check is entirely about cloud tombstones).
 * One Postgres here; the condition cannot arise. Backend Phase 23 made that
 * call and this desk keeps it visible rather than quietly shrinking.
 *
 * The three that survive are real: duplicate images (same object_key across
 * artworks — "the only safe duplicate signal", the old check's own words),
 * incomplete records, and published-but-hidden (published with zero images —
 * collectors can never see them). Items are capped at 50 per check
 * server-side; the count is the true total.
 *
 * **The panel ABOVE the checks** is the old "Data Health & Counts" grid —
 * nine catalogue boxes in its three bands, each count from this backend
 * (`healthCounts.ts` has the table; V1 Phase 4 built the five that waited on
 * G-HEALTH-2/3/4). Compared against `19-data-health-full`. Still correctly
 * absent: the four device-sync boxes, "Repair & maintenance" and "Recovery"
 * (every one of them repairs or restores the client-local snapshot), and the
 * "Reading the live cloud…" sync banner.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { ArtworkAdminQuery, DataHealthReport } from '../../api/types';
import { recentlyAddedSince } from './artworkQuery';
import {
  EMPTY_HEALTH_COUNTS,
  SOURCED,
  healthBands,
  healthCountQueries,
  type HealthCounts,
} from './healthCounts';
import { DeskAction, DeskBanner, DeskPage } from './kit';
import './admin.css';

export function DataHealthPage() {
  const { catalogAdmin } = useApi();
  const [report, setReport] = useState<DataHealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    catalogAdmin.dataHealth().then(
      (r) => setReport(r),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not run the checks.'),
    );
  }, [catalogAdmin]);
  useEffect(load, [load]);

  /* The counts panel above the checks (`healthCounts.ts`): `per_page: 1`
     list reads for Market App, the three sourced kinds, Recently Added and the
     three archival statuses; the other three tiles come out of the report.
     `since` is fixed once, so the Recently Added count and its link agree. */
  const [since] = useState(() => recentlyAddedSince(new Date()));
  const [counts, setCounts] = useState<HealthCounts>(EMPTY_HEALTH_COUNTS);
  useEffect(() => {
    let alive = true;
    const count = (query: ArtworkAdminQuery) =>
      catalogAdmin
        .artworks({ ...query, per_page: 1 })
        .then((page) => page.pagination.total_count)
        .catch(() => null);
    const q = healthCountQueries(since);
    void Promise.all([
      count(q.published),
      count(q.recent),
      Promise.all(SOURCED.map((src) => count(q.sourced[src.key]))),
      Promise.all(q.archived.map(count)),
    ]).then(([published, recent, sourcedParts, archivedParts]) => {
      if (!alive) return;
      // One failed status read makes the whole archived total unknowable —
      // reporting the other two as "Archived" would be a number that is
      // quietly short. `—` is the honest answer.
      const archived = archivedParts.some((n) => n === null)
        ? null
        : archivedParts.reduce((a, b) => (a ?? 0) + (b ?? 0), 0);
      const [gallery, dealer, artist] = sourcedParts;
      setCounts({ published, recent, archived, sourced: { gallery, dealer, artist } });
    });
    return () => {
      alive = false;
    };
  }, [catalogAdmin, since]);

  return (
    <DeskPage
      title="Data Health"
      action={
        <DeskAction
          onClick={() => {
            // clearing the error belongs to the click, not the effect
            setError(null);
            load();
          }}
        >
          Run again
        </DeskAction>
      }
      subtitle={
        <>
          The catalogue's counts, then three checks. The old desk's other five checks diagnosed
          the old app's device-sync architecture, which does not exist here — one database,
          nothing to drift.
        </>
      }
      strip={
        /* `:26316`'s "Data Health & Counts" grid — see `healthCounts.ts`. The
           old panel puts it ABOVE the system checks, which is what the
           `strip` slot is. Its own grid, NOT the `.ad-tiles-sales` strip other
           desks use: the old panel gives it `.dz-ovgrid` / `.dz-ovbox`
           (`:9427-9448`), a wider auto-fill cell with a three-line box and the
           band headings (`.dz-ovsec`) spanning the grid. */
        <div className="ad-ovgrid">
          {healthBands(counts, report, since).map((band) => (
            <HealthBandView key={band.title} title={band.title} tiles={band.tiles} />
          ))}
        </div>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}
      {!report && !error && <p className="dz-state">Running the checks…</p>}

      {report?.healthy && <p className="ad-sent">Everything checks out — no findings.</p>}

      {report && (
        <>
          <Check
            title="Duplicate images"
            note="the same stored image on two or more artworks — the only safe duplicate signal"
            data={report.duplicate_images}
            line={(it) =>
              `${String(it.object_key ?? it.id ?? '?')} — on ${String(it.n ?? '?')} artworks`
            }
          />
          <Check
            title="Incomplete records"
            note="missing image, dimensions, medium, artist, title — or priced with no price"
            data={report.incomplete_records}
            line={(it) =>
              `${String(it.title ?? it.id ?? '?')}${
                Array.isArray(it.missing)
                  ? ` — missing ${(it.missing as string[]).join(', ')}`
                  : ''
              }`
            }
          />
          <Check
            title="Published but hidden"
            note="published with zero images — collectors can never see them"
            data={report.published_but_hidden}
            line={(it) => String(it.title ?? it.id ?? '?')}
          />
        </>
      )}
    </DeskPage>
  );
}

function Check({
  title,
  note,
  data,
  line,
}: {
  title: string;
  note: string;
  data: { count: number; items: Array<Record<string, unknown>> };
  line: (item: Record<string, unknown>) => string;
}) {
  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">
          {title}
          {data.count > 0 && <span className="ad-badge-attn">{data.count}</span>}
        </h2>
        <span className="ad-dsec-n">{note}</span>
      </div>
      {data.count === 0 ? (
        /* NOT `.dz-state`: that is the app's centred empty-state block —
           40px of padding, italic, centred — which is right for a whole
           screen with nothing on it and wrong for one check out of three.
           Against `19-data-health-full` the old desk's System Checks are
           compact ROWS in a card (a dot, the title, a one-line note), and
           this desk was rendering three centred blocks with a screenful of
           whitespace between them. Found 2026-09-22 by looking. */
        <p className="ad-dsec-clean">Clean.</p>
      ) : (
        <div className="ad-card ad-logins">
          {data.items.map((it, i) => (
            <div key={String(it.id ?? it.object_key ?? i)} className="ad-recrow">
              <span className="ad-recv">{line(it)}</span>
            </div>
          ))}
          {data.count > data.items.length && (
            <div className="ad-recrow">
              <span className="ad-recv ad-cellsub">
                …and {data.count - data.items.length} more (the server lists the first{' '}
                {data.items.length}).
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function HealthBandView({
  title,
  tiles,
}: {
  title: string;
  tiles: ReturnType<typeof healthBands>[number]['tiles'];
}) {
  return (
    <>
      <div className="ad-ovsec">{title}</div>
      {tiles.map((t) => {
        const cls = `ad-ovbox${t.tone === 'warn' ? ' is-warn' : ''}`;
        const body = (
          <>
            <span className="ad-ovbox-num">{t.value}</span>
            <span className="ad-ovbox-title">{t.title}</span>
            {/* The old box's one-line explanation (`dz-ovbox-exp`) — the half
                that tells an admin what the number MEANS (`:26279`). */}
            <span className="ad-ovbox-exp">{t.exp}</span>
          </>
        );
        return t.to ? (
          <Link key={t.key} to={t.to} className={cls}>
            {body}
            <span className="ad-ovbox-go" aria-hidden="true">
              →
            </span>
          </Link>
        ) : (
          <div key={t.key} className={cls}>
            {body}
          </div>
        );
      })}
    </>
  );
}
