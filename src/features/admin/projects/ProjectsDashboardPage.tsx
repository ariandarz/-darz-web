/**
 * ProjectsDashboardPage — `/admin/projects`, the Projects dashboard
 * (`DZProjects.dash`, `darz-studio.html:13591-13623`) over
 * `GET /projects/admin/projects/dashboard/`.
 *
 * Ported content:
 *  - the heading, sub (:13616) and "＋ New project" action (:13617 — a route
 *    here, `/admin/projects/new`, instead of the modal);
 *  - the attention cards (:13604-13613, copy from `DASH_CARDS`): each one a
 *    link into the list with the matching quick filter (`goList`, :13623 →
 *    `/admin/projects/list?quick=…`); the Unpaid card only for the owner
 *    (`projCanMoney()`, :13610);
 *  - the "Responsibility by member" card (:13598-13601, :13613): the top
 *    five members by active-project count, or "No members assigned yet.";
 *  - the first-run empty note (:13619) when there is no project at all.
 *
 * What changed for the new backend: the old tallies were computed client-
 * side over `projLoad()`; here the server counts (`dashboard_summary`,
 * `services.py:233-270`) and the page renders them. Two of those counts —
 * Delayed and Awaiting approval — read the per-stage sub-state (`stages`:
 * due dates, approval flags), which the API does not accept on any write
 * yet (G-PROJ-3), so they stay at 0; the page says so under the cards
 * instead of hiding them. The "no projects at all" check is one extra
 * `projects({per_page: 1})` for its `total_count`, because the summary
 * counts only active projects.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, useSession } from '../../../api/hooks';
import type { ProjectDashboard } from '../../../api/types';
import { asAdminRole } from '../adminNav';
import { DeskAction, DeskBanner, DeskPage } from '../kit';
import { DASH_CARDS, type Quick } from './projectForm';
import '../admin.css';

interface Member {
  member: string;
  active: number;
}

/** `responsibility_by_member` is typed as loose dicts on the wire; the
 * backend writes `{member, active_count}` (`services.py:267`). Sorted by
 * count, top five — the old `members.slice(0,5)` (:13601). */
function readMembers(dash: ProjectDashboard): Member[] {
  const out: Member[] = [];
  for (const row of dash.responsibility_by_member) {
    const member = String(row.member ?? '').trim();
    if (!member) continue;
    out.push({ member, active: Number(row.active_count) || 0 });
  }
  return out.sort((a, b) => b.active - a.active).slice(0, 5);
}

/** The count behind each card (:13605-13610), from the server's summary. */
function cardCount(dash: ProjectDashboard, q: Quick): number {
  switch (q) {
    case 'active':
      return dash.active_count;
    case 'delayed':
      return dash.delayed_count;
    case 'approval':
      return dash.awaiting_approval_count;
    case 'deliverables':
      return dash.next_deliverables_count;
    case 'unpaid':
      return dash.unpaid_count;
  }
}

export function ProjectsDashboardPage() {
  const { projectsAdmin } = useApi();
  const { me } = useSession();
  const navigate = useNavigate();
  const canMoney = asAdminRole(me?.role) === 'owner'; // projCanMoney(), :13282

  const [dash, setDash] = useState<ProjectDashboard | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([projectsAdmin.dashboard(), projectsAdmin.projects({ per_page: 1 })]).then(
      ([summary, page]) => {
        if (!alive) return;
        setDash(summary);
        setTotal(page.pagination.total_count);
      },
      (err: unknown) => {
        if (alive)
          setError(err instanceof Error ? err.message : 'Could not load the dashboard.');
      },
    );
    return () => {
      alive = false;
    };
  }, [projectsAdmin]);

  const cards = DASH_CARDS.filter((c) => c.q !== 'unpaid' || canMoney); // :13610
  const members = dash ? readMembers(dash) : [];

  return (
    <DeskPage
      title="Projects"
      action={
        <DeskAction onClick={() => navigate('/admin/projects/new')}>＋ New project</DeskAction>
      }
    >
      {/* :13616 */}
      <p className="ad-desksub">
        What needs you now — active work, deadlines, approvals and deliverables at a glance.
        Every card opens the matching list.
      </p>

      {error && <DeskBanner>{error}</DeskBanner>}
      {!dash && !error && <p className="dz-state">Loading…</p>}

      {dash && (
        <div className="dzp">
          {/* :13612-13613 — every card opens the list on its quick filter */}
          <div className="dzp-cards6">
            {cards.map((c) => (
              <Link
                key={c.q}
                className={`dzp-att${c.cls ? ` ${c.cls}` : ''}`}
                to={`/admin/projects/list?quick=${c.q}`}
              >
                <div className="n dzp-num">{cardCount(dash, c.q)}</div>
                <div className="k">{c.k}</div>
                <div className="d">{c.d}</div>
              </Link>
            ))}
            {/* :13601, :13613 */}
            <Link className="dzp-att" to="/admin/projects/list?quick=active">
              <div className="k">Responsibility by member</div>
              {members.length ? (
                <div className="mlist">
                  {members.map((m) => (
                    <div key={m.member}>
                      <b>{m.member}</b> · {m.active} active
                    </div>
                  ))}
                </div>
              ) : (
                <div className="d">No members assigned yet.</div>
              )}
            </Link>
          </div>

          {/* stated absence — G-PROJ-3: the per-stage sub-state these two
              counts read is not writable on this API yet */}
          <p className="dzp-mut" role="note">
            Delayed and Awaiting approval read each stage’s due date and approval flags — the
            stage sub-state this API does not accept yet (G-PROJ-3) — so they stay at 0 for
            now.
          </p>

          {/* :13619 — only when there is no project at all, archived included */}
          {total === 0 && (
            <div className="dzp-empty">
              No projects yet. Create your first with ＋ New project — media, exhibition,
              curatorial or documentation work, priced and tracked end to end.
            </div>
          )}
        </div>
      )}
    </DeskPage>
  );
}
