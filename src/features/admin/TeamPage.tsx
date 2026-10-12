/**
 * TeamPage — `/admin/team`, the old Team tab's **Executive Workspace**
 * (`teamView`, `darz-studio.html:19417-19429`) over the backend that replaced
 * its localStorage (G-TEAM-1, `apps.workspace` W1–W4; contract
 * `docs/WORKSPACE_API.md`).
 *
 * The shell is the old one: a serif heading and its line for the open tab,
 * the `.ws-tabs` switcher beside it (the Team button badged with the pending
 * pricelist count, `:19424`), the tab's body, and the floating ＋ quick add.
 * The tab rides the URL (`?tab=`), like the Sales and Accounting sub-tabs, so
 * a tab can be linked to.
 *
 * | tab        | who                     | backend                                  |
 * |------------|-------------------------|------------------------------------------|
 * | My workspace (`me`) | owner          | `/workspace/items/` — `IsOwner`           |
 * | Team (`team`)       | owner + admin  | `/workspace/team-tasks/`, `pricelist-approvals/` — `IsStandardAdminOrOwner` |
 * | Contacts (`contacts`) | owner        | `/workspace/contacts/` — `IsOwner`        |
 * | Logins (`logins`)   | owner          | `/auth/admin/team-users/` — `IsOwner`     |
 *
 * **Gating.** The old `teamView` refused any non-owner outright (`:19419`) and
 * the old nav hid the tab. The backend opened Team workflow and the approvals
 * inbox to a standard admin, and the owner asked for exactly those two to be
 * theirs (2026-10-12) — so the route is no longer owner-only (`adminNav`'s
 * `OWNER_ONLY` drops `team`), a standard admin's switcher offers Team alone,
 * and every owner-only tab is wrapped in `RequireOwner`: a typed
 * `?tab=contacts` gets the old refusal card, never a 403. The quick add is
 * owner-only too (both things it writes are `IsOwner`).
 *
 * **Logins** is this port's fourth tab: the owner's team-logins desk lived at
 * this route before the workspace did, and the old app kept it in a separate
 * overlay (`:20648`) — owner decision 2026-10-12 to keep it here, as a tab.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi, useSession } from '../../api/hooks';
import { cx } from '../../lib/cx';
import { useListController } from '../shared/useListController';
import { asAdminRole, type AdminRole } from './adminNav';
import { DeskToast, useDeskToast } from './kit';
import { RequireOwner } from './RequireOwner';
import { ContactsTab } from './team/ContactsTab';
import { ApprovalsController } from './team/controllers';
import { MyWorkspaceTab } from './team/MyWorkspaceTab';
import { QuickAdd } from './team/QuickAdd';
import { TeamLoginsTab } from './team/TeamLoginsTab';
import { TeamWorkflowTab } from './team/TeamWorkflowTab';
import { OWNER_TABS, TAB_HEAD, tabsFor, teamTab, type TeamTab } from './team/workspace';
import './admin.css';

export function TeamPage() {
  const { me } = useSession();
  const role = asAdminRole(me?.role);
  const [params, setParams] = useSearchParams();
  const tab = teamTab(params.get('tab'), role);

  const desk = <WorkspaceDesk tab={tab} role={role} onTab={(t) => setParams({ tab: t })} />;
  if (!OWNER_TABS.has(tab)) return desk;
  return <RequireOwner title={TAB_HEAD[tab].title}>{desk}</RequireOwner>;
}

function WorkspaceDesk({
  tab,
  role,
  onTab,
}: {
  tab: TeamTab;
  role: AdminRole;
  onTab: (tab: TeamTab) => void;
}) {
  const { workspace } = useApi();
  const toast = useDeskToast();
  // The inbox is the shell's: the Team button's badge counts it on every tab.
  const [approvalsCtrl] = useState(() => new ApprovalsController(workspace));
  const { state: approvals, reload: reloadApprovals } = useListController(() => approvalsCtrl);
  // bumped when the quick add saves, so the open tab re-reads
  const [refreshKey, setRefreshKey] = useState(0);

  const head = TAB_HEAD[tab];
  const pending = approvals.results.length;

  return (
    <div className="dz-page ad-page ad-page--wide ws-root">
      <div className="ws-head">
        <div>
          <h1 className="ws-h1">{head.title}</h1>
          <div className="ws-sub">{head.sub}</div>
        </div>
        <div className="ws-tabs" role="tablist" aria-label="Workspace">
          {tabsFor(role).map((t) => (
            <button
              type="button"
              role="tab"
              key={t.key}
              aria-selected={tab === t.key}
              className={cx(tab === t.key && 'on')}
              onClick={() => onTab(t.key)}
            >
              {t.label}
              {t.key === 'team' && pending > 0 && (
                <span className="ws-tb-badge">{pending}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'me' && <MyWorkspaceTab refreshKey={refreshKey} say={toast.say} />}
      {tab === 'team' && (
        <TeamWorkflowTab
          refreshKey={refreshKey}
          say={toast.say}
          approvals={{
            rows: approvals.results,
            loading: approvals.status === 'loading',
            error: approvals.status === 'error' ? approvals.error : null,
            reload: () => void reloadApprovals(),
          }}
        />
      )}
      {tab === 'contacts' && <ContactsTab refreshKey={refreshKey} say={toast.say} />}
      {tab === 'logins' && <TeamLoginsTab />}

      {/* the old ＋ rides the three workspace tabs (`:19428`) — owner-only */}
      {role === 'owner' && tab !== 'logins' && (
        <QuickAdd onSaved={() => setRefreshKey((k) => k + 1)} say={toast.say} />
      )}
      <DeskToast message={toast.message} />
    </div>
  );
}
