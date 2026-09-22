/**
 * AccountingDuplicates — `/admin/accounting?view=duplicates`, the Expenses-Arian
 * duplicate-review queue (`GET /accounting/admin/ledger/arian/duplicates/`).
 *
 * The old desk's Arian review worked the same way round: the scan flags a
 * receipt that looks like one already entered, and a human settles it —
 * *"yes, this is the same payment twice"* or *"no, two real payments"*. Until
 * they do, the entry sits here.
 *
 * Why it is a queue and not a filter on the books: a flagged entry is
 * **excluded from the summary totals** while it is unresolved
 * (`AccountingSummaryService` skips confirmed duplicates and excluded rows), so
 * the books can quietly under-report until this list is empty. That is the
 * whole reason the old desk had the screen, and it is the sentence at the top.
 *
 * Settling a row is the review form on the entry page — this list links there
 * rather than duplicating the controls, so there is one place a verdict is set.
 */
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { AccountingAdminService } from '../../api/services';
import type { Choice, LedgerEntryAdmin, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';
import { useListController } from '../shared/useListController';
import { useNavigate } from 'react-router-dom';
import { DeskList, type Column } from './kit';
import './admin.css';

interface DupQuery {
  page?: number;
  per_page?: number;
}

class DuplicatesController extends ListController<LedgerEntryAdmin, DupQuery> {
  private readonly accounting: AccountingAdminService;
  constructor(accounting: AccountingAdminService) {
    super({});
    this.accounting = accounting;
  }
  protected fetchPage(query: DupQuery): Promise<Paginated<LedgerEntryAdmin>> {
    return this.accounting.arianDuplicates(query);
  }
}

export function AccountingDuplicates() {
  const { accountingAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();
  const { state, setPage } = useListController<LedgerEntryAdmin, DupQuery>(
    () => new DuplicatesController(accountingAdmin),
  );

  const dupStatuses = choices(options, 'accounting.arian_dup_status');

  const columns: ReadonlyArray<Column<LedgerEntryAdmin>> = [
    {
      key: 'date',
      header: 'Date',
      className: 'ad-when',
      cell: (e) => new Date(e.entry_date).toLocaleDateString('en-GB'),
    },
    {
      key: 'what',
      header: 'Entry',
      cell: (e) => (
        <>
          <span className="ad-cellmain">{e.person || e.category || 'Expense'}</span>
          {e.note && <span className="ad-cellsub">{e.note}</span>}
        </>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      cell: (e) => (
        <span className="ad-cellmain">
          −{Number(e.amount).toLocaleString('en-US')} {e.currency}
        </span>
      ),
    },
    {
      key: 'verdict',
      header: 'Duplicate check',
      cell: (e) => {
        const status = e.arian_review?.dup_status;
        return (
          <>
            <span
              className={`ad-stpill is-${status === 'confirmed_duplicate' ? 'gone' : 'res'}`}
            >
              {status ? labelOf(dupStatuses, status) : 'flagged'}
            </span>
            {e.arian_review?.dup_reason && (
              <span className="ad-cellsub">{e.arian_review.dup_reason}</span>
            )}
          </>
        );
      },
    },
    {
      key: 'counted',
      header: 'In the totals',
      cell: (e) =>
        e.is_counted ? (
          <span className="ad-cellsub">counted</span>
        ) : (
          <span className="ad-stpill is-gone">not counted</span>
        ),
    },
    {
      key: 'acts',
      header: '',
      cell: (e) => (
        <span className="ad-rowacts">
          <button
            type="button"
            className="ad-rowbtn"
            onClick={() => navigate(`/admin/accounting/entries/${e.id}`)}
          >
            Review
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      {/* The line under the heading is the old desk's own (`acctHead`'s
          `arianexp` case — `AccountingPage`'s `accountingIntro`), which says
          what the queue IS. This says what an unsettled row COSTS, which the
          old line does not, so it stays — as a note rather than a second
          subtitle (found 2026-09-22 against `31-accounting`). */}
      <div className="ad-noteblock">
        <p>
          A row that is <strong>not counted</strong> is being left out of the Expenses-Arian
          totals until someone settles it, so an unattended queue quietly under-reports the
          book. Open one to record the verdict.
        </p>
      </div>

      <DeskList
        label="Possible duplicates"
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(e) => e.id}
        empty="Nothing flagged — every Expenses-Arian receipt has been settled."
      />
    </>
  );
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function labelOf(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
