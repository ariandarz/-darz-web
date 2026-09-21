/**
 * SettingsPage — `/admin/settings` (Owner group, owner-only).
 *
 * The old panel's Settings tab (`darz-studio.html:16876`, `settingsView`) is
 * two things bolted together: a large **feature-and-role control room** (show /
 * hide / lock any tab per role, force-dark, desktop mode, a personal passkey),
 * and an **audit log** of every change made in it (`psAuditSec`, `:17084`).
 *
 * Only the second half has a backend, and this desk is that half — which makes
 * the scope statement the first thing on screen rather than a silent omission.
 * The first half is not ported and must not be faked:
 *
 *  - the per-tab / per-role visibility matrix has no API. This codebase
 *    replaced the old panel's single `admin` role + parallel `teamAccess`
 *    grants with two real roles (`owner` / `standard_admin`, backend Phase 31),
 *    so the matrix has nothing to write to and nothing to read from.
 *  - **force-dark** is the old workspace's own switch; `admin.css` maps the
 *    panel onto this app's Paper/Black tokens, so there is no second toggle.
 *  - the **Settings passkey** is the same client-side device lock the
 *    Accounting desk had. `IsOwner` on the server is the real gate now
 *    (see `AccountingPage`'s header for the same decision).
 *  - what a *collector* sees is set on **App Design** (`/admin/design`),
 *    through `theme.features` — so the one genuinely portable half of the old
 *    control room already has a home, and this page points at it.
 *
 * The log itself is `GET /api/admin/audit-log/` (backend Phase 33, `IsOwner`):
 * append-only, written by `apps.core.audit.record_audit` on every privileged
 * mutation — not just settings changes, which makes it strictly more than the
 * old log held. Each row keeps the old rendering: **what**, *from → to*,
 * *who · when* (`:17085`).
 *
 * Two deliberate differences from the old log's controls (`:17087`):
 *  - **Export CSV is kept** (`auditCsv`), but exports the page on screen, since
 *    the server paginates and the old log was one local array.
 *  - **"Clear log" is not ported.** An append-only server record that any admin
 *    could erase from the UI would be worth less than no record at all, and the
 *    API offers no delete. Said on screen rather than left as a missing button.
 */
import { useMemo, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { AuditLogEntry, AuditLogQuery, Paginated } from '../../api/types';
import type { CoreAdminService } from '../../api/services';
import { ListController } from '../shared/ListController';
import { useListController } from '../shared/useListController';
import { auditCsv, changeLines, entityLabel, fieldLabel } from './auditLog';
import { DeskList, DeskPage, SearchFilter, type Column } from './kit';
import './admin.css';

class AuditLogController extends ListController<AuditLogEntry, AuditLogQuery> {
  private readonly core: CoreAdminService;
  constructor(core: CoreAdminService, initial: AuditLogQuery = {}) {
    super(initial);
    this.core = core;
  }
  protected fetchPage(query: AuditLogQuery): Promise<Paginated<AuditLogEntry>> {
    return this.core.auditLog(query);
  }
}

export function SettingsPage() {
  const { coreAdmin } = useApi();
  const { state, setQuery, setPage } = useListController<AuditLogEntry, AuditLogQuery>(
    () => new AuditLogController(coreAdmin),
  );
  const [exportError, setExportError] = useState<string | null>(null);

  /** `?action=` and `?entity_type=` are **exact** matches server-side
   * (`AuditLogFilterSet`) — there is no search. So these are text boxes that
   * filter exactly, and the hint says so rather than letting someone type half
   * a word and read the empty result as "nothing happened". */
  const columns: ReadonlyArray<Column<AuditLogEntry>> = useMemo(
    () => [
      {
        key: 'at',
        header: 'When',
        className: 'ad-when',
        cell: (e) =>
          new Date(e.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
      },
      {
        key: 'what',
        header: 'What changed',
        cell: (e) => (
          <>
            <span className="ad-cellmain">
              {e.action} · {entityLabel(e.entity_type)}
            </span>
            <span className="ad-cellsub ad-id">{e.entity_id}</span>
          </>
        ),
      },
      {
        key: 'changes',
        header: 'From → to',
        cell: (e) => {
          const lines = changeLines(e.changes);
          if (lines.length === 0) return <span className="ad-cellsub">—</span>;
          return (
            <span className="ad-chglist">
              {lines.map((l) => (
                <span key={l.field} className="ad-chg">
                  <span className="ad-chg-f">{fieldLabel(l.field)}</span>
                  <span className="ad-chg-v">
                    {l.from} → {l.to}
                  </span>
                </span>
              ))}
            </span>
          );
        },
      },
      {
        key: 'by',
        header: 'By',
        cell: (e) => e.actor?.name ?? <span className="ad-cellsub">system</span>,
      },
    ],
    [],
  );

  const exportCsv = () => {
    setExportError(null);
    try {
      const blob = new Blob([auditCsv(state.results)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `darz-audit-log-page-${state.pagination?.page ?? 1}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'The file could not be written.');
    }
  };

  return (
    <DeskPage
      title="Settings"
      toolbar={
        <>
          <SearchFilter
            label="Action"
            value={state.query.action}
            placeholder="create, update, delete…"
            onChange={(action) => setQuery({ action })}
          />
          <SearchFilter
            label="Entity"
            value={state.query.entity_type}
            placeholder="catalog.Artwork"
            onChange={(entity_type) => setQuery({ entity_type })}
          />
        </>
      }
    >
      <p className="ad-deskintro">
        The audit log — every privileged change in the system, newest first. Both filters match
        <strong> exactly</strong>, not by substring: an entity is its full{' '}
        <code>app.Model</code>, as the rows show it.
      </p>

      <div className="ad-noteblock">
        <p>
          The rest of the old Settings tab is not here, and is not coming as-is. Who may see
          which desk is decided by two real roles now — owner and admin — set on{' '}
          <a href="/admin/team">Team</a>, not by a per-tab matrix. What a <em>collector</em>{' '}
          sees is on <a href="/admin/design">App Design</a>. The old workspace's force-dark
          switch and its Settings passkey were device-local locks; the server's own owner
          permission is the gate.
        </p>
      </div>

      <div className="ad-rowacts ad-deskacts">
        <button
          type="button"
          className="ad-rowbtn"
          onClick={exportCsv}
          disabled={state.results.length === 0}
          title="Export the rows on this page"
        >
          Export CSV
        </button>
        <span className="ad-cellsub">
          The log cannot be cleared from here — it is append-only, and the API offers no
          delete.
        </span>
      </div>

      <DeskList
        label="Audit log"
        status={state.status}
        error={state.error}
        actionError={exportError}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(e) => e.id}
        empty="Nothing recorded yet — or nothing matches these filters."
      />
    </DeskPage>
  );
}
