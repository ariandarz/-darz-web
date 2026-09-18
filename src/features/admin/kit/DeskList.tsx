/**
 * DeskList — a list desk's whole body in one component: the four-way view from
 * `resolveDeskView`, the banner from `deskBanner`, the table, and the pager.
 *
 * This is the piece that makes a new desk assembly rather than invention. A
 * desk supplies a `ListController` snapshot, its columns and its empty-state
 * sentence; everything about *how* a loading, failed, empty or populated list
 * looks is decided here, once, for the whole panel.
 *
 * It takes the snapshot rather than the controller so a desk that filters or
 * decorates its rows before display can still use it.
 */
import type { ReactNode } from 'react';
import type { Paginated } from '../../../api/types';
import type { LoadStatus } from '../../shared/ListController';
import { Pager } from '../../catalogue/Pager';
import { DataTable, type Column } from './DataTable';
import { DeskBanner } from './DeskPage';
import { deskBanner, resolveDeskView } from './deskState';
import '../admin.css';

export function DeskList<T>({
  status,
  error,
  rows,
  pagination,
  onPage,
  columns,
  rowKey,
  empty,
  loading = 'Loading…',
  actionError,
  busyKey,
  label,
}: {
  status: LoadStatus;
  error: string | null;
  rows: readonly T[];
  pagination: Paginated<unknown>['pagination'] | null;
  onPage: (page: number) => void;
  columns: ReadonlyArray<Column<T>>;
  rowKey: (row: T) => string;
  /** The desk's own empty sentence — its wording is the desk's, not the kit's. */
  empty: ReactNode;
  loading?: ReactNode;
  /** A failed row action, shown above the table without replacing it. */
  actionError?: string | null;
  busyKey?: string | null;
  label?: string;
}) {
  const view = resolveDeskView(status, rows.length);
  const banner = deskBanner(status, error, actionError);

  return (
    <>
      {banner && <DeskBanner>{banner}</DeskBanner>}

      {view === 'loading' && <p className="dz-state">{loading}</p>}
      {view === 'empty' && <p className="dz-state">{empty}</p>}
      {/* `view === 'error'` needs no body of its own — the banner above is the
          whole message, and adding a second line would say it twice. */}

      {view === 'rows' && (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          busyKey={busyKey}
          label={label}
        />
      )}

      {pagination && <Pager pagination={pagination} onPage={onPage} />}
    </>
  );
}
