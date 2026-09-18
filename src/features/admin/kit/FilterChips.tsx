/**
 * FilterChips — the Database desk's active-filter row, ported as a kit piece
 * (`darz-studio.html:26686-26706`): every ACTIVE filter is a removable dark
 * chip (the ✕ resets just that filter) and "Clear all" ends with them. In the
 * kit because any filtered desk can carry it; the desk supplies the chips.
 */
import '../admin.css';

export interface ActiveChip {
  key: string;
  label: string;
  onClear: () => void;
}

export function FilterChips({
  chips,
  onClearAll,
}: {
  chips: ActiveChip[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="ad-fchips">
      {chips.map((c) => (
        <span key={c.key} className="ad-fchip">
          <span className="ad-fchip-l">{c.label}</span>
          <button
            type="button"
            aria-label={`Remove filter ${c.label}`}
            title="Remove this filter"
            onClick={c.onClear}
          >
            ✕
          </button>
        </span>
      ))}
      <button
        type="button"
        className="ad-fchips-clear"
        title="Reset all filters"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  );
}
