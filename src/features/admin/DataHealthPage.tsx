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
 * **Compared against `19-data-health` / `-full`, 2026-09-22.** The claim
 * above is about the old desk's SYSTEM CHECKS section, and it holds. What it
 * does not cover — and what the capture makes obvious — is the panel ABOVE
 * that section:
 *
 *  - **"Data Health & Counts"**, twelve tiles in three bands (Storage &
 *    visibility · Where artworks come from · Quality & lifecycle). Four of
 *    them ARE this architecture's (Active artworks in cloud · Synced
 *    artworks · Sync issues · Admin database artworks "on this device") and
 *    correctly gone. **The other eight are not**: Market App artworks,
 *    Gallery- / Dealer- / Artist-Sourced, Incomplete records, Duplicate
 *    artworks, Deleted (permanent), Recently added, Archived / unavailable —
 *    every one a count over the catalogue this backend holds. They are
 *    absent with no reason recorded anywhere, which is the gap. Building
 *    them is not a polish pass (it is eight counts, most needing their own
 *    read — the Sales desk's `per_page=1` trick ×8, or one aggregate
 *    endpoint), so it goes to the owner as **G-HEALTH-1**, with the backend
 *    half noted: `GET /catalog/admin/data-health/` already computes two of
 *    the eight and could carry the rest for one call instead of eight.
 *  - **"Repair & maintenance"** (owner-only, five buttons) and **"Recovery"**
 *    (this device's daily backups) are correctly absent — every one of them
 *    repairs or restores the client-local snapshot.
 *  - **"Reading the live cloud…"** — same, the sync banner.
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
