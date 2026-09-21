/**
 * TeamPage — `/admin/team`, the owner's "👥 Team logins" desk (backend Phase
 * 31's port target). Owner-only; `RequireOwner` renders the refusal card for
 * anyone else.
 *
 * Content: issue a login (the generated password is returned exactly once —
 * `ShownOnceSecret`), list/search/role-filter, edit name/email/role/active,
 * remove. Two rules the API enforces are surfaced as *disabled controls with a
 * reason*, not as a toast after the fact: a team user cannot deactivate or
 * remove **their own** account (the 400 exists so an owner cannot lock
 * themselves out).
 *
 * Two deviations, both already made and flagged by the backend (Phase 31),
 * kept in step here:
 *  - the old desk hard-codes every member to `role:'admin'` plus a per-tab
 *    `teamAccess` grant; this system's two real roles (`owner` /
 *    `standard_admin`) are used directly — the role picker offers those two
 *    and there is no parallel access-grant UI;
 *  - the old `teamView` (`darz-studio.html:19420`) is a whole **Workspace**
 *    (My workspace · Team workflow · Contacts — tasks, notes, time tracking,
 *    approvals) around the logins. That suite is client-local in the old app
 *    and has **no backend here** (G-TEAM-1, `docs/ADMIN_ARCHITECTURE.md` §2)
 *    — this desk is the logins, and says so rather than pretending.
 */
import { useState } from 'react';
import { useApi, useOptions, useSession } from '../../api/hooks';
import type { AdminAccountsService } from '../../api/services';
import type { Choice, Paginated, TeamUserAdmin } from '../../api/types';
import { ListController } from '../shared/ListController';
import { useListController } from '../shared/useListController';
import {
  ConfirmDialog,
  DeskAction,
  DeskList,
  DeskPage,
  SearchFilter,
  SelectFilter,
  ShownOnceSecret,
  type Column,
} from './kit';
import './admin.css';

interface TeamQuery {
  search?: string;
  role?: string;
  per_page?: number;
  page?: number;
}

class TeamController extends ListController<TeamUserAdmin, TeamQuery> {
  private readonly accounts: AdminAccountsService;
  constructor(accounts: AdminAccountsService) {
    super({});
    this.accounts = accounts;
  }
  protected fetchPage(query: TeamQuery): Promise<Paginated<TeamUserAdmin>> {
    return this.accounts.teamUsers(query);
  }
}

export function TeamPage() {
  const { adminAccounts } = useApi();
  const { me } = useSession();
  const options = useOptions();
  const roles = (options?.['accounts.team_role'] as Choice[] | undefined) ?? [];

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TeamUserAdmin | null>(null);
  const [removing, setRemoving] = useState<TeamUserAdmin | null>(null);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { state, setQuery, setPage, reload } = useListController<TeamUserAdmin, TeamQuery>(
    () => new TeamController(adminAccounts),
  );

  const remove = async (u: TeamUserAdmin) => {
    setBusyId(u.id);
    setActionError(null);
    try {
      await adminAccounts.deleteTeamUser(u.id);
      await reload();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not remove.');
    } finally {
      setBusyId(null);
    }
  };

  const columns: ReadonlyArray<Column<TeamUserAdmin>> = [
    {
      key: 'name',
      header: 'Name',
      cell: (u) => (
        <>
          <span className="ad-cellmain">{u.name || '—'}</span>
          {u.id === me?.id && <span className="ad-cellsub">you</span>}
        </>
      ),
    },
    { key: 'email', header: 'Email', cell: (u) => u.email },
    {
      key: 'role',
      header: 'Role',
      cell: (u) => roles.find((r) => r.value === u.role)?.label ?? u.role,
    },
    {
      key: 'active',
      header: 'Active',
      cell: (u) =>
        u.is_active ? (
          <span className="ad-exp is-ok">Active</span>
        ) : (
          <span className="ad-exp is-expired">Deactivated</span>
        ),
    },
    {
      key: 'since',
      header: 'Since',
      className: 'ad-when',
      cell: (u) => new Date(u.created_at).toLocaleDateString('en-GB'),
    },
    {
      key: 'actions',
      header: '',
      cell: (u) => {
        const self = u.id === me?.id;
        return (
          <span className="ad-keyacts" aria-busy={busyId === u.id || undefined}>
            <button type="button" className="ad-rowbtn" onClick={() => setEditing(u)}>
              Edit
            </button>
            <button
              type="button"
              className="ad-rowbtn is-danger"
              disabled={self}
              /* the API 400s a self-remove; a disabled control with the reason
                 beats an error toast after the fact */
              title={self ? 'You cannot remove your own login.' : undefined}
              onClick={() => setRemoving(u)}
            >
              Remove
            </button>
          </span>
        );
      },
    },
  ];

  return (
    <DeskPage
      wide
      title="Team"
      action={<DeskAction onClick={() => setCreating(true)}>＋ New login</DeskAction>}
      toolbar={
        <>
          <SearchFilter
            label="Search"
            value={state.query.search}
            onChange={(search) => setQuery({ search })}
            placeholder="Search team — name, email…"
          />
          <SelectFilter
            label="Role"
            anyLabel="All roles"
            value={state.query.role}
            onChange={(role) => setQuery({ role })}
            choices={roles}
          />
        </>
      }
    >
      <p className="ad-desksub">
        Sign-ins for the desk. The old panel's workspace suite (tasks · notes · time ·
        contacts) has no backend here and is not part of this desk.
      </p>

      {issued && (
        <ShownOnceSecret
          label={`Password for ${issued.email}`}
          value={issued.password}
          hint="Generated once — they sign in with it at /admin/login and it is never shown again."
          onDismiss={() => setIssued(null)}
        />
      )}

      {(creating || editing) && (
        <TeamForm
          existing={editing}
          roles={roles}
          self={editing?.id === me?.id}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(password, email) => {
            setCreating(false);
            setEditing(null);
            if (password && email) setIssued({ email, password });
            void reload();
          }}
        />
      )}

      <DeskList
        label="Team"
        status={state.status}
        error={state.error}
        actionError={actionError}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(u) => u.id}
        busyKey={busyId}
        empty="No team logins yet."
      />

      {removing && (
        <ConfirmDialog
          message={`Remove ${removing.name || removing.email}? They can no longer sign in.`}
          okLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const u = removing;
            setRemoving(null);
            void remove(u);
          }}
        />
      )}
    </DeskPage>
  );
}

function TeamForm({
  existing,
  roles,
  self,
  onClose,
  onSaved,
}: {
  existing: TeamUserAdmin | null;
  roles: Choice[];
  self: boolean;
  onClose: () => void;
  onSaved: (password: string | null, email: string | null) => void;
}) {
  const { adminAccounts } = useApi();
  const [draft, setDraft] = useState<{
    email: string;
    name: string;
    role: string;
    is_active: boolean;
  }>(() => ({
    email: existing?.email ?? '',
    name: existing?.name ?? '',
    role: (existing?.role as string) ?? 'standard_admin',
    is_active: existing?.is_active ?? true,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    if (!draft.email.trim()) {
      setError('An email is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (existing) {
        await adminAccounts.updateTeamUser(existing.id, {
          ...draft,
          role: draft.role as TeamUserAdmin['role'],
          version: existing.version,
        });
        onSaved(null, null);
      } else {
        const created = await adminAccounts.createTeamUser({
          email: draft.email.trim(),
          name: draft.name,
          role: draft.role,
        });
        onSaved(created.password, created.email);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">{existing ? 'Edit login' : 'New login'}</div>
      <div className="ad-form-grid">
        <label className="ad-field">
          <span className="ad-filter-l">Email</span>
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            autoFocus={!existing}
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Name</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Role</span>
          <select
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {existing && (
          <label className="ad-field">
            <span className="ad-filter-l">Active</span>
            <select
              value={draft.is_active ? 'yes' : 'no'}
              disabled={self}
              /* the API refuses a self-deactivate — same disabled-with-reason
                 treatment as Remove */
              title={self ? 'You cannot deactivate your own login.' : undefined}
              onChange={(e) => setDraft({ ...draft, is_active: e.target.value === 'yes' })}
            >
              <option value="yes">Active</option>
              <option value="no">Deactivated</option>
            </select>
          </label>
        )}
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
          {existing ? 'Save changes' : 'Create login'}
        </button>
      </div>
    </div>
  );
}
