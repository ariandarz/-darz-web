/**
 * MembershipsPage — `/admin/memberships`, the owner's subscription ledger
 * (`membershipsView()`, `darz-studio.html:33306`; the v806 intro `:33127`:
 * *"Payment stays OUTSIDE the app (WhatsApp / Darz chatbox) — after payment
 * the owner issues an access code here."*). Owner-only; `RequireOwner` renders
 * the desk's own refusal card (`:33307`) for anyone else.
 *
 * Ported content:
 *  - search over name / WhatsApp / code (the server's own
 *    `MembershipCodeFilterSet` mirrors the old `:33311` filter, minus `notes`
 *    which it does not index — dropped from the placeholder, not promised);
 *  - the WhatsApp cell as a `wa.me/` link in green (`:33322`) — the desk's
 *    whole delivery channel, since payment lives outside the app;
 *  - the monospace code cell (`:33326`), the start/expiry dates, and the
 *    status cell's dot + Active/Expired/Inactive + days-left (`:33318`,
 *    reusing `expiryParts` for the day math);
 *  - **Renew** = the old `membRenew` rule, now server-side: +1 month from
 *    max(expiry, today), and reactivates;
 *  - remove behind a confirm.
 *
 * One deviation, the backend's own (Phase 30, flagged there and here): `plan`
 * is constrained to the **collector tiers**, not the old `MEMB_PLANS`
 * Basic/Premium/Free-Invite (`:33131`), so a redeemed code sets a real
 * `Collector.tier`. The old per-plan price copy therefore has no home and is
 * not shown. **No payment processing anywhere** — kept on screen, the old
 * desk's own statement.
 */
import { useState } from 'react';
import { useApi, useOptions } from '../../api/hooks';
import type { Choice, MembershipCodeAdmin } from '../../api/types';
import { useListController } from '../shared/useListController';
import { ListController } from '../shared/ListController';
import type { AdminAccountsService } from '../../api/services';
import type { Paginated } from '../../api/types';
import { expiryParts } from './expiry';
import {
  ConfirmDialog,
  DeskAction,
  DeskList,
  DeskPage,
  SearchFilter,
  SelectFilter,
  type Column,
} from './kit';
import './admin.css';

interface MembershipQuery {
  search?: string;
  plan?: string;
  status?: string;
  per_page?: number;
  page?: number;
}

class MembershipsController extends ListController<MembershipCodeAdmin, MembershipQuery> {
  private readonly accounts: AdminAccountsService;
  constructor(accounts: AdminAccountsService) {
    super({});
    this.accounts = accounts;
  }
  protected fetchPage(query: MembershipQuery): Promise<Paginated<MembershipCodeAdmin>> {
    return this.accounts.membershipCodes(query);
  }
}

export function MembershipsPage() {
  const { adminAccounts } = useApi();
  const options = useOptions();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MembershipCodeAdmin | null>(null);
  const [removing, setRemoving] = useState<MembershipCodeAdmin | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { state, setQuery, setPage, reload } = useListController<
    MembershipCodeAdmin,
    MembershipQuery
  >(() => new MembershipsController(adminAccounts));

  const plans = (options?.['accounts.collector_tier'] as Choice[] | undefined) ?? [];
  const statuses =
    (options?.['accounts.membership_code_status'] as Choice[] | undefined) ?? [];

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      await reload();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'The action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const columns: ReadonlyArray<Column<MembershipCodeAdmin>> = [
    {
      key: 'name',
      header: 'Name',
      cell: (m) => (
        <>
          <span className="ad-cellmain">{m.name || '—'}</span>
          {m.notes && (
            <span className="ad-cellsub" title={m.notes}>
              {m.notes}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'whatsapp',
      header: 'WhatsApp',
      cell: (m) => {
        const digits = (m.whatsapp ?? '').replace(/[^0-9]/g, '');
        return digits ? (
          /* :33322 — the wa.me link, green: the delivery channel */
          <a
            className="ad-wa"
            href={`https://wa.me/${digits}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {m.whatsapp}
          </a>
        ) : (
          '—'
        );
      },
    },
    {
      key: 'plan',
      header: 'Plan',
      cell: (m) =>
        m.plan ? (
          <span className={`ad-chip ad-tier-${m.plan}`}>{label(plans, m.plan)}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'code',
      header: 'Code',
      cell: (m) => <span className="ad-id ad-code">{m.code}</span>,
    },
    {
      key: 'expiry',
      header: 'Expiry',
      cell: (m) => <StatusCell m={m} />,
    },
    {
      key: 'redeemed',
      header: 'Redeemed',
      cell: (m) =>
        m.is_redeemed ? (
          <>
            <span className="ad-cellmain">{m.redeemed_by?.display_name ?? 'Yes'}</span>
            {m.redeemed_at && (
              <span className="ad-cellsub">
                {new Date(m.redeemed_at).toLocaleDateString('en-GB')}
              </span>
            )}
          </>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: '',
      cell: (m) => (
        <span className="ad-keyacts" aria-busy={busyId === m.id || undefined}>
          <button
            type="button"
            className="ad-rowbtn"
            onClick={() => void run(m.id, () => adminAccounts.renewMembershipCode(m.id))}
          >
            Renew +1 month
          </button>
          <button type="button" className="ad-rowbtn" onClick={() => setEditing(m)}>
            Edit
          </button>
          <button type="button" className="ad-rowbtn is-danger" onClick={() => setRemoving(m)}>
            Remove
          </button>
        </span>
      ),
    },
  ];

  return (
    <DeskPage
      wide
      title="Memberships"
      action={<DeskAction onClick={() => setCreating(true)}>＋ New membership</DeskAction>}
      toolbar={
        <>
          <SearchFilter
            label="Search"
            value={state.query.search}
            onChange={(search) => setQuery({ search })}
            placeholder="Search memberships — name, WhatsApp, code…"
          />
          <SelectFilter
            label="Plan"
            anyLabel="All plans"
            value={state.query.plan}
            onChange={(plan) => setQuery({ plan })}
            choices={plans}
          />
          <SelectFilter
            label="Status"
            anyLabel="All statuses"
            value={state.query.status}
            onChange={(status) => setQuery({ status })}
            choices={statuses}
          />
        </>
      }
      subtitle={
        /* the old desk's own on-screen rule, kept (:33127 / backend Phase 30) */
        <>
          Payment stays outside the app — after payment, issue the access code here. No payment
          processing anywhere.
        </>
      }
    >
      {(creating || editing) && (
        <MembershipForm
          existing={editing}
          plans={plans}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void reload();
          }}
        />
      )}

      <DeskList
        label="Memberships"
        status={state.status}
        error={state.error}
        actionError={actionError}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(m) => m.id}
        busyKey={busyId}
        empty="No memberships yet."
      />

      {removing && (
        <ConfirmDialog
          message={`Remove ${removing.name || removing.code}? The code stops redeeming.`}
          okLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const m = removing;
            setRemoving(null);
            void run(m.id, () => adminAccounts.deleteMembershipCode(m.id));
          }}
        />
      )}
    </DeskPage>
  );
}

/** The old status cell (`:33318`): dot + Active/Expired/Inactive, days under. */
function StatusCell({ m }: { m: MembershipCodeAdmin }) {
  const expired = m.is_expired;
  const active = m.status === 'active' && !expired;
  const tone = active ? 'ok' : expired ? 'expired' : 'never';
  const label = active ? 'Active' : expired ? 'Expired' : 'Inactive';
  const days = m.expiry ? expiryParts(m.expiry).label : 'Never';
  return (
    <>
      <span className={`ad-exp is-${tone}`}>
        <span className={`ad-dot is-${tone}`} /> {label}
      </span>
      <span className="ad-cellsub">
        {days}
        {m.expiry ? ` · ${new Date(m.expiry).toLocaleDateString('en-GB')}` : ''}
      </span>
    </>
  );
}

function MembershipForm({
  existing,
  plans,
  onClose,
  onSaved,
}: {
  existing: MembershipCodeAdmin | null;
  plans: Choice[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { adminAccounts } = useApi();
  const [draft, setDraft] = useState<{
    code: string;
    name: string;
    plan: string;
    status: string;
    expiry: string;
    whatsapp: string;
    notes: string;
  }>(() => ({
    code: existing?.code ?? '',
    name: existing?.name ?? '',
    plan: (existing?.plan as string | null) ?? plans[0]?.value ?? 'active',
    status: (existing?.status as string) ?? 'active',
    expiry: (existing?.expiry as string | null) ?? '',
    whatsapp: existing?.whatsapp ?? '',
    notes: existing?.notes ?? '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...draft,
        plan: draft.plan as MembershipCodeAdmin['plan'],
        status: draft.status as MembershipCodeAdmin['status'],
        expiry: draft.expiry || null,
        code: draft.code.trim(),
      };
      if (existing) {
        await adminAccounts.updateMembershipCode(existing.id, {
          ...body,
          version: existing.version,
        });
      } else {
        await adminAccounts.createMembershipCode(body);
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">{existing ? 'Edit membership' : 'New membership'}</div>
      <div className="ad-form-grid">
        <label className="ad-field">
          <span className="ad-filter-l">Name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            autoFocus={!existing}
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">WhatsApp</span>
          <input
            value={draft.whatsapp}
            onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })}
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Plan</span>
          <select
            value={draft.plan ?? ''}
            onChange={(e) => setDraft({ ...draft, plan: e.target.value })}
          >
            {plans.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Code · blank auto-generates</span>
          <input
            placeholder="DZ-…"
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            disabled={Boolean(existing)}
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Expiry</span>
          <input
            type="date"
            value={draft.expiry ?? ''}
            onChange={(e) => setDraft({ ...draft, expiry: e.target.value })}
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Status</span>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className="ad-field ad-field--wide">
          <span className="ad-filter-l">Notes · private</span>
          <textarea
            rows={2}
            value={draft.notes ?? ''}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
      </div>
      {error && (
        <p className="dz-state err" role="alert">
          {error}
        </p>
      )}
      <div className="ad-form-a">
        <button type="button" className="ad-ghostbtn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="ad-action"
          onClick={() => void save()}
          disabled={busy}
        >
          {existing ? 'Save changes' : 'Issue membership'}
        </button>
      </div>
    </div>
  );
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
