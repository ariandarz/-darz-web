/**
 * The admin desk kit — the panel's shared vocabulary.
 *
 * Every desk is assembled from these rather than inventing its own shell,
 * table, filters, confirm or secret panel. That is what makes sixteen groups
 * read as one system, and it is why a new desk is a column list plus a
 * controller rather than a new page.
 *
 * See `docs/ADMIN_ARCHITECTURE.md` for how a desk is added.
 */
export { DeskPage, DeskAction, DeskBanner } from './DeskPage';
export { DataTable, type Column } from './DataTable';
export { DeskList } from './DeskList';
export { SelectFilter, SearchFilter, ToggleFilter, type FilterChoice } from './filters';
export { ConfirmDialog } from './ConfirmDialog';
export { ShownOnceSecret } from './ShownOnceSecret';
export { resolveDeskView, deskBanner, type DeskView } from './deskState';
