/**
 * CatalogueToolbar — faithful port of app.html's `.toolbar` (COMPONENTS.md §
 * Toolbar, SCREENS.md §03 step 3): the view segment **[grid | Single view]**,
 * the search field ("Search artist, title, medium…"), then the two custom
 * dropdowns **Recently added** (sort) and **All currencies**. On desktop the
 * toolbar is one row — search, dropdowns, segment, and the per-device layout
 * toggle (app.html `.dz-vtoggle`, `DZ.toggleLayout`).
 *
 * Sort and currency are the backend's own `ordering` / `currency` params;
 * the old app's rule that a price sort needs one currency is kept
 * (`CatalogueController` semantics unchanged — only the controls moved from
 * native `<select>` to the shared `Dropdown`).
 */
import { useEffect, useState } from 'react';
import type { CatalogueQuery } from '../../api/types';
import { Dropdown, Segment } from '../../components';
import { layoutController } from '../shell/LayoutController';
import { useLayout } from '../shell/useLayout';
import type { ViewMode } from './ViewPreference';

const SORTS = [
  { value: '', label: 'Recently added' },
  { value: 'price', label: 'Price — low to high' },
  { value: '-price', label: 'Price — high to low' },
  { value: 'year', label: 'Year — oldest' },
  { value: '-year', label: 'Year — newest' },
  { value: 'artist', label: 'Artist A–Z' },
];

/** The currency list `GET /api/options/` publishes is loaded by the page and
 * passed in; until it arrives the control shows only "All currencies". */
export interface CurrencyOption {
  value: string;
  label: string;
}

// app.html:8668-8669 — the two view glyphs
const IC_GRID = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
  </svg>
);
const IC_SOLO = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <rect x="4.5" y="3.5" width="15" height="13" rx="1" />
    <line x1="8" y1="20.5" x2="16" y2="20.5" />
  </svg>
);
const IC_DESKTOP = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);
const IC_MOBILE = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <rect x="6" y="2" width="12" height="20" rx="2" />
    <path d="M11 18h2" />
  </svg>
);

export function CatalogueToolbar({
  query,
  onChange,
  view,
  onView,
  currencies,
}: {
  query: CatalogueQuery;
  onChange: (patch: Partial<CatalogueQuery>) => void;
  view: ViewMode;
  onView: (mode: ViewMode) => void;
  currencies: CurrencyOption[];
}) {
  const [term, setTerm] = useState(query.search ?? '');
  const layout = useLayout();

  // Debounce the search box so every keystroke doesn't fire a request — the
  // old app searches on input but this is a network call, not a local filter.
  useEffect(() => {
    const t = setTimeout(() => {
      if (term !== (query.search ?? '')) onChange({ search: term || undefined });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const segment = (
    <Segment<ViewMode>
      label="View mode"
      value={view}
      onChange={onView}
      options={[
        { value: 'grid', content: IC_GRID, title: 'Grid view' },
        {
          value: 'solo',
          title: 'One artwork per page',
          content: (
            <>
              {IC_SOLO}
              <span className="dz-solab">Single view</span>
            </>
          ),
        },
      ]}
    />
  );

  return (
    <div className="toolbar">
      {layout === 'mobile' && <div className="tbar-util">{segment}</div>}

      <input
        type="search"
        placeholder="Search artist, title, medium…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        aria-label="Search the collection"
      />

      <div className="tbar-controls">
        <Dropdown
          label="Sort"
          options={SORTS}
          value={query.ordering ?? ''}
          onChange={(v) => onChange({ ordering: v || undefined })}
        />
        <Dropdown
          label="Currency"
          options={[{ value: '', label: 'All currencies' }, ...currencies]}
          value={query.currency ?? ''}
          onChange={(v) => onChange({ currency: v || undefined })}
        />
      </div>

      {layout === 'desktop' && (
        <div className="tbar-util">
          {segment}
          <button
            type="button"
            className="dz-vtoggle"
            title="Switch to the phone layout on this device"
            aria-label="Switch to the phone layout on this device"
            onClick={() => layoutController.setOverride('mobile')}
          >
            {layout === 'desktop' ? IC_MOBILE : IC_DESKTOP}
          </button>
        </div>
      )}
    </div>
  );
}
