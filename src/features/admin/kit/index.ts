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
export { FilterChips, type ActiveChip } from './FilterChips';
export { Picker, type PickItem } from './Picker';
export { ShownOnceSecret } from './ShownOnceSecret';
export { resolveDeskView, deskBanner, type DeskView } from './deskState';
// One way to say a write landed, one way to say it clashed (TD-4 / TD-5).
export { DeskToast, DeskSave, ConflictBanner } from './feedback';
export { useDeskToast, isConflict } from './feedbackState';
// The pager is the catalogue's (a faithful port of app.html's .pager); desks
// reach it through the kit so no desk imports across features by hand.
export { Pager } from '../../catalogue/Pager';
