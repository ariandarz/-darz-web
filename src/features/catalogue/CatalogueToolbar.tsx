/**
 * CatalogueToolbar — search + sort. Faithful port of app.html's `.toolbar`
 * (search box + `Sort` dropdown; `Currency` folded into the sort control's
 * disabled state per the old app's rule: price sort needs one currency).
 * Native `<select>` for V1 — the old app's `dzSel` custom dropdown is a
 * later polish pass, not a behavioural difference.
 */
import { useEffect, useState } from 'react';
import type { CatalogueQuery } from '../../api/types';

const SORTS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Recently added' },
  { value: 'price', label: 'Price — low to high' },
  { value: '-price', label: 'Price — high to low' },
  { value: 'year', label: 'Year — oldest' },
  { value: '-year', label: 'Year — newest' },
  { value: 'artist', label: 'Artist A–Z' },
];

export function CatalogueToolbar({
  query,
  onChange,
}: {
  query: CatalogueQuery;
  onChange: (patch: Partial<CatalogueQuery>) => void;
}) {
  const [term, setTerm] = useState(query.search ?? '');

  // Debounce the search box so every keystroke doesn't fire a request — the
  // old app searches on input but this is a network call, not a local filter.
  useEffect(() => {
    const t = setTimeout(() => {
      if (term !== (query.search ?? '')) onChange({ search: term || undefined });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const priceSort = query.ordering === 'price' || query.ordering === '-price';

  return (
    <div className="toolbar">
      <label className="tbar-search">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          placeholder="Search artist, title, medium…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </label>

      <div className="tbar-controls">
        <select
          value={query.ordering ?? ''}
          onChange={(e) => onChange({ ordering: e.target.value || undefined })}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {priceSort && (
          <select
            value={query.currency ?? ''}
            onChange={(e) => onChange({ currency: e.target.value || undefined })}
          >
            <option value="">Pick a currency…</option>
            {['USD', 'EUR', 'GBP', 'TMN'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
