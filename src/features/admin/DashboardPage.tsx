/**
 * DashboardPage — `/admin`, the desk an admin starts on (`dashboard()`,
 * `darz-studio.html:21332`).
 *
 * **The one rule this screen has to keep** is the old panel's own, stated in
 * capitals at `:21349` (v531): *"ONE source of truth for every request counter
 * — each number is computed with the SAME pipeline the Requests list uses, so a
 * counter ALWAYS equals the list that opens when it is tapped."*
 *
 * Here that is free and stronger: `DashboardService.summary()` counts
 * server-side from the same querysets the desks list from, so a tile cannot
 * disagree with its desk. What this file has to get right is the other half —
 * **tapping a tile must open exactly the rows it counted.** Each request tile
 * links to `/admin/requests` with that kind pre-filtered, and
 * `AdminRequestsPage` reads its opening filter from the URL for that reason.
 *
 * A tile whose desk is not built yet is **not a link**. The old panel had every
 * desk, so every tile was tappable; here a tile that looked tappable and did
 * nothing would be worse than a plain number.
 *
 * **Not ported, and listed rather than dropped** — backend Phase 29 scoped them
 * out deliberately and there is no endpoint behind either:
 *
 *  - the performance / analytics charts (no analytics API at all;
 *    `adminNav.ts` records Analytics as `api: 'none'`)
 *  - the cloud-sync banner and its "not connected" states, which diagnose the
 *    old app's client-local-snapshot architecture — one Postgres here, so the
 *    condition cannot arise (`docs/ADMIN_ARCHITECTURE.md` §1)
 *  - the owner-signature and exhibition pre-fetches the old `dashboard()` fires
 *    on open (`:21336-21342`); both belong to desks this phase has not built.
 */
import { Link } from 'react-router-dom';
import { useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { Choice, DashboardSummary } from '../../api/types';
import { DeskBanner, DeskPage } from './kit';
import { useDashboard } from './useDashboard';
import './admin.css';

export function DashboardPage() {
  const { summary, error, reload } = useDashboard();
  const options = useOptions();

  return (
    <DeskPage
      title="Dashboard"
      action={
        <button type="button" className="ad-action" onClick={reload}>
          Refresh
        </button>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}
      {!summary && !error && <p className="dz-state">Loading…</p>}
      {summary && <Tiles summary={summary} options={options} />}
    </DeskPage>
  );
}

function Tiles({
  summary,
  options,
}: {
  summary: DashboardSummary;
  options: OptionsMap | null;
}) {
  const { requests, today, collectors, catalogue, auctions, exhibitions } = summary;

  // Only the kinds that actually have something waiting, busiest first — the
  // old panel's own emphasis (a dashboard of zeroes tells you nothing).
  const waiting = Object.entries(requests.new_by_kind)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <>
      <Section
        title="Needs attention"
        note={
          requests.new_total === 0
            ? 'Nothing is waiting.'
            : `${requests.new_total} waiting · ${requests.resolved_total} resolved all-time`
        }
      >
        {waiting.length === 0 ? (
          <Tile label="Requests waiting" value={0} />
        ) : (
          waiting.map(([kind, n]) => (
            <Tile
              key={kind}
              label={kindLabel(options, kind)}
              value={n}
              to={attentionLink(options, kind)}
              accent
            />
          ))
        )}
      </Section>

      <Section title="Today">
        <Tile label="Requests" value={today.requests_created} to="/admin/requests" />
        <Tile label="New collectors" value={today.collectors_created} />
        <Tile label="Collector sign-ins" value={today.collector_logins} />
        <Tile label="Bids" value={today.bids_placed} />
      </Section>

      <Section title="Collectors">
        <Tile label="Total" value={collectors.total} to="/admin/collectors" />
        <Tile label="Active" value={collectors.active} to="/admin/collectors" />
      </Section>

      <Section title="Catalogue" note={`${catalogue.total} works`}>
        <Tile label="Available" value={catalogue.available} />
        <Tile label="On hold" value={catalogue.on_hold} />
        <Tile label="Reserved" value={catalogue.reserved} />
        <Tile label="Sold" value={catalogue.sold} />
      </Section>

      <Section title="Auctions">
        <Tile label="Live now" value={auctions.live_now} to="/admin/auctions" />
        <Tile label="Scheduled" value={auctions.scheduled} to="/admin/auctions" />
        <Tile
          label="Registrations pending"
          value={auctions.registrations_pending}
          to="/admin/auction-registrations"
          accent
        />
      </Section>

      <Section title="Exhibitions">
        <Tile
          label="Awaiting review"
          value={exhibitions.pending_review}
          to="/admin/sources?view=exhibitions"
          accent
        />
      </Section>
    </>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">{title}</h2>
        {note && <span className="ad-dsec-n">{note}</span>}
      </div>
      <div className="ad-tiles">{children}</div>
    </section>
  );
}

function Tile({
  label,
  value,
  to,
  accent,
}: {
  label: string;
  value: number;
  /** Omitted when the desk behind this number is not built — see the header. */
  to?: string;
  /** A number that means someone is waiting, rather than a plain total. */
  accent?: boolean;
}) {
  const cls = `ad-tile${accent && value > 0 ? ' is-attn' : ''}`;
  const body = (
    <>
      <span className="ad-tile-v">{value.toLocaleString('en-GB')}</span>
      <span className="ad-tile-l">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className={`${cls} is-link`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Where an attention tile opens — `/admin/requests` filtered to **the rows the
 * tile counted** (:21349's rule): this kind, at its "just arrived" status.
 *
 * The status half leans on an inference, recorded as **G-DASH-1**
 * (`docs/ADMIN_ARCHITECTURE.md` §2): the server counts at
 * `KIND_INITIAL_STATUS[kind]`, which `/api/options/` does not publish. What it
 * does publish is `crm.request_status_by_kind`, whose per-kind list puts the
 * machine's source states in definition order — and every machine is written
 * initial-first — so `[0]` is that status today. If the backend ever reorders
 * a machine, this filters to a wrong status **visibly** (the desk shows the
 * status select set to it), which is why the inference is taken instead of
 * silently dropping the status and letting the count disagree with the list.
 */
function attentionLink(options: OptionsMap | null, kind: string): string {
  const byKind = options?.['crm.request_status_by_kind'] as
    Record<string, Choice[]> | undefined;
  const initial = byKind?.[kind]?.[0]?.value;
  const status = initial ? `&status=${encodeURIComponent(initial)}` : '';
  return `/admin/requests?kind=${encodeURIComponent(kind)}${status}`;
}

/** A request kind's human label, from `GET /api/options/` — never a hardcoded
 * lookup (CLAUDE.md). Falls back to the raw key with underscores opened up. */
function kindLabel(options: OptionsMap | null, kind: string): string {
  const kinds = options?.['crm.request_kind'] as Choice[] | undefined;
  const hit = kinds?.find((c) => c.value === kind);
  return hit?.label ?? kind.charAt(0).toUpperCase() + kind.slice(1).replace(/_/g, ' ');
}
