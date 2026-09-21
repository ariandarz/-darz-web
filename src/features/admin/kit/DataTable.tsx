/**
 * DataTable — the panel's one table.
 *
 * The old panel's `.ad-card > .ad-scroll > .ad-tbl` markup (`darz-studio.html`
 * `:8415-8423`), already in `admin.css`, expressed as a column list so a desk
 * describes *what* its columns are and never *how* a table is built. Fifteen
 * desks writing their own `<thead>` is how a panel drifts.
 *
 * A column's `cell` returns a node, so a desk keeps its own formatting (chips,
 * money, relative dates) without the table knowing anything about the domain.
 */
import type { ReactNode } from 'react';
import '../admin.css';

export interface Column<T> {
  /** Stable key — also the React key for the header and each cell. */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Extra class on the `<td>`, for the old panel's own cell classes
   * (`.ad-when`, `.ad-id`, …). */
  className?: string;
  /** A header-only class, when the column head needs different treatment. */
  headClassName?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  /** Rows that should read as busy — a row mid-action. Keyed by `rowKey`. */
  busyKey,
  /** An accessible name for the table; desks pass their own heading. */
  label,
}: {
  columns: ReadonlyArray<Column<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  busyKey?: string | null;
  label?: string;
}) {
  return (
    <div className="ad-card">
      <div className="ad-scroll">
        <table className="ad-tbl" aria-label={label}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.headClassName}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr key={key} aria-busy={busyKey === key || undefined}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.className}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
