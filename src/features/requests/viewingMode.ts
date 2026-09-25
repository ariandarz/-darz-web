/** The viewing sheet's "In person or virtual" choices — lifted out of the
 * component so the `logic` test project can pin them without a DOM. */
import type { OptionsMap } from '../../api/services';
import { asArray } from '../../api/shapes';
import type { Choice, ViewingMode } from '../../api/types';

/** `ModeEnum` — the two values the backend's `ViewingDetailSerializer` accepts.
 * Values only: the LABELS come from `GET /api/options/` (G-P5-10). */
const VIEWING_MODES: readonly ViewingMode[] = ['in_person', 'virtual'];

/** `crm.viewing_mode` from the options map, restricted to values the request
 * body can carry. Until the map arrives (or if it failed) each value stands in
 * as its own label — the fallback every options read in this app uses. */
export function viewingModeChoices(
  options: OptionsMap | null,
): ReadonlyArray<{ value: ViewingMode; label: string }> {
  const published = asArray<Choice>(options?.['crm.viewing_mode']);
  const label = (value: ViewingMode) =>
    published.find((c) => c.value === value)?.label ?? value.replace(/_/g, ' ');
  return VIEWING_MODES.map((value) => ({ value, label: label(value) }));
}
