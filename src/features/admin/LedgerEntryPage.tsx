/**
 * LedgerEntryPage — `/admin/accounting/entries/:id`, one ledger entry and the
 * three things you can do to it that the list cannot: set its payment status,
 * keep its receipts, and — in the Expenses-Arian book only — fill in the
 * receipt review.
 *
 * The old desk did all three inline on the row (`acctDash`, its expanded entry
 * panel). Here they are a page, for the same reason the deal editor is one: a
 * receipt upload and a review form are more than a table cell, and a route can
 * be linked to from the duplicates queue.
 *
 * Owner-only end to end — every `/accounting/admin/` route is `IsOwner`, and
 * `RequireOwner` wraps this in the route table.
 *
 * Three facts from the API that shape the page:
 *
 *  - **`/status/` is its own endpoint**, not a PATCH. The server treats a
 *    payment-status change as its own audited action, so it is a control of
 *    its own here rather than another field in the edit form.
 *  - **`has_receipt` is read-only and server-derived** — it flips when the
 *    first attachment lands. So after an upload or a delete the entry is
 *    re-read rather than patched locally; a stale `has_receipt` on the books
 *    is exactly the kind of quiet lie an accounting desk must not tell.
 *  - **Saving the Arian review re-runs the duplicate scan** and answers with
 *    the whole entry, `dup_status` included. The desk shows what came back; it
 *    never computes a duplicate verdict itself.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type {
  ArianReceiptReview,
  ArianReviewWrite,
  Choice,
  LedgerAttachment,
  LedgerEntryAdmin,
} from '../../api/types';
import { ConfirmDialog, DeskBanner, DeskPage, DeskSave, DeskToast, useDeskToast } from './kit';
import './admin.css';

/** The one book whose entries carry the receipt-review extension
 * (`ArianReceiptReview` is a 1:1 on a `arian_expenses` entry; the server 400s
 * a review posted against any other book). */
const ARIAN_BOOK = 'arian_expenses';

export function LedgerEntryPage() {
  const { id } = useParams<{ id: string }>();
  const { accountingAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const [entry, setEntry] = useState<LedgerEntryAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { say, message } = useDeskToast();

  const load = useCallback(() => {
    if (!id) return;
    accountingAdmin.entry(id).then(
      (e) => setEntry(e),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the entry.'),
    );
  }, [accountingAdmin, id]);
  useEffect(load, [load]);

  const statuses = choices(options, 'accounting.ledger_status');
  const types = choices(options, 'accounting.entry_type');
  const books = choices(options, 'accounting.book');

  const setStatus = async (status: string) => {
    if (!id || busy || !status) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await accountingAdmin.setEntryStatus(id, status);
      setEntry(updated);
      // Was a `notice` line that stayed on the page; the panel's own way of
      // saying a write landed is the toast (TD-4).
      say(`Status is now ${labelOf(statuses, status)} ✓`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not change the status.');
    } finally {
      setBusy(false);
    }
  };

  if (error && !entry) {
    return (
      <DeskPage title="Entry">
        <DeskBanner>{error}</DeskBanner>
      </DeskPage>
    );
  }
  if (!entry) {
    return (
      <DeskPage title="Entry">
        <p className="dz-state">Loading…</p>
      </DeskPage>
    );
  }

  const amount = `${entry.entry_type === 'expense' ? '−' : ''}${Number(entry.amount).toLocaleString('en-US')} ${entry.currency}`;

  return (
    <DeskPage
      title={amount}
      action={
        <button
          type="button"
          className="ad-rowbtn"
          onClick={() => navigate(`/admin/accounting?view=books&book=${entry.book}`)}
        >
          ← Back to the books
        </button>
      }
    >
      <p className="ad-deskintro">
        {labelOf(books, entry.book)} · {labelOf(types, entry.entry_type)}
        {entry.category ? ` · ${entry.category}` : ''} ·{' '}
        {new Date(entry.entry_date).toLocaleDateString('en-GB')}
        {entry.person ? ` · ${entry.person}` : ''}
        {entry.position ? ` (${entry.position})` : ''}
        {entry.note ? ` — ${entry.note}` : ''}
      </p>

      {error && <DeskBanner>{error}</DeskBanner>}

      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">Payment status</h2>
          <span className="ad-dsec-n">
            its own action server-side, and its own audit entry
          </span>
        </div>
        <div className="ad-rowacts ad-deskacts">
          {statuses.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`ad-rowbtn${entry.status === s.value ? ' is-on' : ''}`}
              disabled={busy || entry.status === s.value}
              onClick={() => void setStatus(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <ReceiptsSection entryId={entry.id} hasReceipt={entry.has_receipt} onChanged={load} />

      {entry.book === ARIAN_BOOK && (
        /* Keyed on the entry's optimistic-lock counter so a save — which
           re-runs the duplicate scan and can change `dup_status` — remounts the
           form with the server's answer. React's own way to reset state from a
           prop, and it is why the form below can seed once and never sync. */
        <ArianReviewSection
          key={entry.version}
          entry={entry}
          options={options}
          onSaved={setEntry}
          onSaid={say}
        />
      )}

      <DeskToast message={message} />
    </DeskPage>
  );
}

/** Receipts / invoices on one entry. Multipart upload with an optional
 * freeform `kind` — the model's own example vocabulary is "receipt, invoice",
 * and it is a free string rather than a choice list, so this offers those two
 * as a datalist without refusing anything else. */
function ReceiptsSection({
  entryId,
  hasReceipt,
  onChanged,
}: {
  entryId: string;
  hasReceipt: boolean;
  onChanged: () => void;
}) {
  const { accountingAdmin } = useApi();
  const [files, setFiles] = useState<LedgerAttachment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('receipt');
  const [removing, setRemoving] = useState<LedgerAttachment | null>(null);

  const load = useCallback(() => {
    accountingAdmin.entryAttachments(entryId, { per_page: 50 }).then(
      (page) => setFiles(page.results),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the receipts.'),
    );
  }, [accountingAdmin, entryId]);
  useEffect(load, [load]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await accountingAdmin.uploadEntryAttachment(entryId, file, kind.trim() || undefined);
      load();
      onChanged(); // `has_receipt` is server-derived — re-read, never assume
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not upload the file.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: LedgerAttachment) => {
    setBusy(true);
    setError(null);
    try {
      await accountingAdmin.deleteEntryAttachment(entryId, a.id);
      load();
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove the file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Receipts</h2>
        <span className="ad-dsec-n">
          {hasReceipt ? 'this entry is marked as having one' : 'nothing on file yet'}
        </span>
      </div>

      {error && <DeskBanner>{error}</DeskBanner>}
      {!files && !error && <p className="dz-state">Loading…</p>}

      {files && (
        <>
          {files.length === 0 ? (
            <p className="dz-state">No receipt on this entry.</p>
          ) : (
            <ul className="ad-grantlist">
              {files.map((f) => (
                <li key={f.id} className="ad-grantrow">
                  <a
                    className="ad-cellmain"
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {f.original_name || 'file'}
                  </a>
                  <span className="ad-cellsub">
                    {f.kind || 'file'} · {new Date(f.created_at).toLocaleDateString('en-GB')}
                  </span>
                  <button
                    type="button"
                    className="ad-rowbtn is-danger"
                    disabled={busy}
                    onClick={() => setRemoving(f)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="ad-grantadd">
            <label className="ad-filter">
              <span className="ad-filter-l">Kind</span>
              <input
                list="ad-receipt-kinds"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                placeholder="receipt"
              />
              <datalist id="ad-receipt-kinds">
                <option value="receipt" />
                <option value="invoice" />
              </datalist>
            </label>
            <label className="ad-imgadd ad-fileadd">
              <span className="ad-cellmain">Attach a file…</span>
              <input
                type="file"
                style={{ display: 'none' }}
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </>
      )}

      {removing && (
        <ConfirmDialog
          message={`Remove ${removing.original_name || 'this file'}? If it is the only one, the entry stops counting as receipted.`}
          okLabel="Remove"
          danger
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const a = removing;
            setRemoving(null);
            void remove(a);
          }}
        />
      )}
    </section>
  );
}

/**
 * The Expenses-Arian receipt review. Every field is optional server-side, so
 * this saves whatever is filled in rather than validating a shape the API does
 * not require.
 *
 * `dup_status` is offered as a control because the old desk let a reviewer
 * *settle* a flagged pair ("this really is a duplicate" / "no, they are two
 * payments"), and the server accepts it. But the scan re-runs on every save
 * and may overwrite the choice, so what comes back is what is shown — the form
 * re-seeds itself from the response instead of keeping the typed value.
 */
function ArianReviewSection({
  entry,
  options,
  onSaved,
  onSaid,
}: {
  entry: LedgerEntryAdmin;
  options: OptionsMap | null;
  onSaved: (e: LedgerEntryAdmin) => void;
  /** The desk's toast — the section confirms where every other desk does. */
  onSaid: (message: string) => void;
}) {
  const { accountingAdmin } = useApi();
  // Typed non-nullable by the generator, actually null outside this book.
  const review: ArianReceiptReview | null = entry.arian_review ?? null;

  // Seeded once per mount. The parent keys this component on `entry.version`,
  // so a save remounts it with what the server sent back rather than syncing
  // an effect against a prop.
  const [d, setD] = useState<Record<string, string>>(() => seed(review));
  const set = (k: string, v: string) => setD((prev) => ({ ...prev, [k]: v }));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dupStatuses = choices(options, 'accounting.arian_dup_status');
  const acctStatuses = choices(options, 'accounting.arian_acct_status');
  const projects = choices(options, 'accounting.arian_project');
  const methods = choices(options, 'accounting.arian_method');

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Only non-empty values — the serializer's fields are all optional and
      // an empty string is a real value for some of them.
      const body: Record<string, string> = {};
      for (const [k, v] of Object.entries(d)) if (v !== '') body[k] = v;
      const updated = await accountingAdmin.saveArianReview(
        entry.id,
        body as ArianReviewWrite,
      );
      onSaved(updated);
      onSaid('Review saved ✓');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the review.');
      throw err; // `DeskSave` flashes only on a write that landed
    } finally {
      setBusy(false);
    }
  };

  const dup = review?.dup_status;

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Receipt review</h2>
        <span className="ad-dsec-n">
          Expenses-Arian only — saving re-runs the duplicate scan, so the verdict below is the
          server's, not this form's
        </span>
      </div>

      {dup && (
        <p className="ad-deskintro">
          Duplicate check: <strong>{labelOf(dupStatuses, dup)}</strong>
          {review?.dup_reason ? ` — ${review.dup_reason}` : ''}
        </p>
      )}
      {error && <DeskBanner>{error}</DeskBanner>}

      <div className="ad-formgrid">
        <Field label="Payment purpose" value={d.purpose} onChange={(v) => set('purpose', v)} />
        <Pick
          label="Project"
          value={d.project}
          onChange={(v) => set('project', v)}
          choices={projects}
        />
        <Field
          label="Receipt source"
          value={d.receipt_source}
          onChange={(v) => set('receipt_source', v)}
        />
        <Field
          label="Tracking number"
          value={d.tracking_number}
          onChange={(v) => set('tracking_number', v)}
        />
        <Field label="Bank" value={d.bank} onChange={(v) => set('bank', v)} />
        <Pick
          label="Method"
          value={d.method}
          onChange={(v) => set('method', v)}
          choices={methods}
        />
        <Pick
          label="Duplicate status"
          value={d.dup_status}
          onChange={(v) => set('dup_status', v)}
          choices={dupStatuses}
        />
        <Field
          label="Duplicate reason"
          value={d.dup_reason}
          onChange={(v) => set('dup_reason', v)}
        />
        <Pick
          label="Accounting status"
          value={d.acct_status}
          onChange={(v) => set('acct_status', v)}
          choices={acctStatuses}
        />
      </div>

      <div className="ad-rowacts ad-deskacts">
        <DeskSave className="ad-action" busy={busy} savedLabel="Review saved" onClick={save}>
          Save review
        </DeskSave>
      </div>
    </section>
  );
}

function seed(review: ArianReceiptReview | null): Record<string, string> {
  return {
    purpose: review?.purpose ?? '',
    project: review?.project ?? '',
    receipt_source: review?.receipt_source ?? '',
    tracking_number: review?.tracking_number ?? '',
    bank: review?.bank ?? '',
    method: review?.method ?? '',
    dup_status: review?.dup_status ?? '',
    dup_reason: review?.dup_reason ?? '',
    acct_status: review?.acct_status ?? '',
  };
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="ad-filter">
      <span className="ad-filter-l">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Pick({
  label,
  value,
  onChange,
  choices: list,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  choices: Choice[];
}) {
  return (
    <label className="ad-filter">
      <span className="ad-filter-l">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {list.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function labelOf(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
