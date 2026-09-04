/**
 * Pager — faithful port of app.html's `.pager` (prev/next + page numbers +
 * a "PAGE x OF y" info line). Ellipsis-collapsed for large page counts.
 */
import type { Paginated } from '../../api/types';

export function Pager({
  pagination,
  onPage,
}: {
  pagination: Paginated<unknown>['pagination'];
  onPage: (page: number) => void;
}) {
  const { page, total_pages, has_next, has_previous, total_count, per_page } = pagination;
  if (total_pages <= 1) return null;

  const from = (page - 1) * per_page + 1;
  const to = Math.min(page * per_page, total_count);

  return (
    <div className="pager">
      <button
        type="button"
        className="pg nav"
        disabled={!has_previous}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
      >
        ‹
      </button>
      {pageTokens(page, total_pages).map((token, i) =>
        token === '…' ? (
          <span key={`e${i}`} className="el">
            …
          </span>
        ) : (
          <button
            key={token}
            type="button"
            className={`pg${token === page ? ' on' : ''}`}
            onClick={() => onPage(token)}
          >
            {token}
          </button>
        ),
      )}
      <button
        type="button"
        className="pg nav"
        disabled={!has_next}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
      >
        ›
      </button>
      <div className="pginfo">
        Page {page} of {total_pages} · {from}–{to} of {total_count}
      </div>
    </div>
  );
}

/** Numbers to show around the current page, `'…'` for the gaps. */
function pageTokens(current: number, total: number): Array<number | '…'> {
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}
