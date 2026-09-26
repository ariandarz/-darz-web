/**
 * DocumentHistory — one document's audit trail (G-DOC-2,
 * `GET /documents/admin/documents/{id}/activity/`, newest first), as a section
 * of `DocumentDetailPage`.
 *
 * **Where the old History lived.** The old Documents group had no History tab
 * of its own: its fourth tab is "Library & history" (`darz-studio.html:11735`),
 * and `_docTab` sends a stray `'history'` to it (`workspaces-runtime.js:522`).
 * Under the library it drew a "History" heading (`:703`), then "Issued
 * documents" and an **"Activity"** list — each row the entry's text, the user
 * after a "·", and `_spAgo` on the right; empty: "No document activity
 * recorded yet." (`docsHistoryBody`, `:705-731`). That activity was the
 * panel-wide log filtered by a regex on its text. This backend serves the
 * trail **per document**, so the section sits on the document itself, and each
 * row reads like the Settings audit log (`SettingsPage`, the same
 * `{field: [from, to]}` map): the action, its from → to, who, and when.
 *
 * C-15: the actor is flat (`actor` uuid + `actor_name`), typed as served.
 */
import { useEffect, useMemo } from 'react';
import type { DocumentsAdminService } from '../../api/services';
import type { DocumentActivity, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';
import { useListController } from '../shared/useListController';
import { changeLines, fieldLabel } from './auditLog';
import { activityAction, activityWho, spAgo } from './documentRules';
import { DeskList, type Column } from './kit';

interface HistoryQuery {
  page?: number;
  per_page?: number;
}

class DocumentHistoryController extends ListController<DocumentActivity, HistoryQuery> {
  private readonly docs: DocumentsAdminService;
  private readonly id: string;
  constructor(docs: DocumentsAdminService, id: string) {
    super({ per_page: 25 });
    this.docs = docs;
    this.id = id;
  }
  protected fetchPage(query: HistoryQuery): Promise<Paginated<DocumentActivity>> {
    return this.docs.activity(this.id, query);
  }
}

export function DocumentHistory({
  docs,
  id,
  version,
}: {
  docs: DocumentsAdminService;
  id: string;
  /** The document's lock counter — every recorded action bumps it, so a
   * change means the trail has a new row to show. */
  version: number;
}) {
  const { state, setPage, reload } = useListController<DocumentActivity, HistoryQuery>(
    () => new DocumentHistoryController(docs, id),
  );

  // re-read after this page changes the document (share, confirm, …); the
  // first render's read is the controller's own
  useEffect(() => {
    if (state.pagination) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new version
  }, [version]);

  const columns: ReadonlyArray<Column<DocumentActivity>> = useMemo(
    () => [
      {
        key: 'at',
        header: 'When',
        className: 'ad-when',
        cell: (a) => <span title={new Date(a.at).toLocaleString('en-GB')}>{spAgo(a.at)}</span>,
      },
      {
        key: 'what',
        header: 'What',
        cell: (a) => <span className="ad-cellmain">{activityAction(a.action)}</span>,
      },
      {
        key: 'changes',
        header: 'From → to',
        cell: (a) => {
          const lines = changeLines(a.changes);
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
      { key: 'by', header: 'Who', cell: (a) => activityWho(a) },
    ],
    [],
  );

  return (
    <section className="ad-dsec" aria-label="History">
      <div className="ad-dsec-h">
        {/* `:703` — the old section's own heading; the count is its "Activity <n>" */}
        <h2 className="ad-dsec-t">History</h2>
        <span className="ad-dsec-n">
          {state.pagination ? `${state.pagination.total_count} · ` : ''}every action on this
          document, newest first
        </span>
      </div>
      <DeskList
        label="Document history"
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(a) => a.id}
        empty="No document activity recorded yet."
      />
    </section>
  );
}
