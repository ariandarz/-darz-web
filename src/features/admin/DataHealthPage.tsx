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
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { DataHealthReport } from '../../api/types';
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
          Three checks. The old desk's other five diagnosed the old app's device-sync
          architecture, which does not exist here — one database, nothing to drift.
        </>
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
        <p className="dz-state">Clean.</p>
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
