/**
 * Picker — the search-and-pick control the Collector Club editor introduced
 * (type → top matches → add; picked items are removable chips). Promoted to
 * the kit on its second consumer (the Sales deal form) per the shared-base
 * rule — one implementation, never a per-desk copy.
 */
import { useEffect, useState } from 'react';
import '../admin.css';

export interface PickItem {
  id: string;
  label: string;
}

export function Picker({
  label,
  placeholder,
  picked,
  onChange,
  search,
  single = false,
}: {
  label: string;
  placeholder: string;
  picked: PickItem[];
  onChange: (items: PickItem[]) => void;
  search: (q: string) => Promise<PickItem[]>;
  /** true = picking replaces the selection (a one-item picker, e.g. "the
   * artwork this deal is for") instead of appending. */
  single?: boolean;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PickItem[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (!term) return; // clearing is the input event's job below
    let alive = true;
    const t = setTimeout(() => {
      search(term).then(
        (items) => alive && setHits(items),
        () => alive && setHits([]),
      );
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, search]);

  const add = (item: PickItem) => {
    if (single) onChange([item]);
    else if (!picked.some((p) => p.id === item.id)) onChange([...picked, item]);
    setQ('');
    setHits([]);
  };

  return (
    <div className="ad-picker">
      <span className="ad-filter-l">{label}</span>
      <div className="ad-pickchips">
        {picked.map((p) => (
          <span key={p.id} className="ad-pickchip">
            {p.label}
            <button
              type="button"
              aria-label={`Remove ${p.label}`}
              onClick={() => onChange(picked.filter((x) => x.id !== p.id))}
            >
              ×
            </button>
          </span>
        ))}
        {picked.length === 0 && <span className="ad-cellsub">nothing picked yet</span>}
      </div>
      <input
        className="ad-pickin"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (!e.target.value.trim()) setHits([]);
        }}
      />
      {hits.length > 0 && (
        <div className="ad-pickhits">
          {hits.map((h) => (
            <button key={h.id} type="button" className="ad-pickhit" onClick={() => add(h)}>
              {h.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
