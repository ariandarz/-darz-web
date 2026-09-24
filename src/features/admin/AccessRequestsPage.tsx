/**
 * AccessRequestsPage — `/admin/access-requests`, the review queue for the
 * public "Request access" form. The old panel's `systemView`
 * (`darz-studio.html:33115`) + `accReqPanel` (`:33006-33027`), owner-only
 * (`OWNER_ONLY` has `system`; `RequireOwner` renders the old refusal card for
 * anyone else — its first real caller).
 *
 * Ported copy, verbatim:
 *  - the sub-line: *"Owner-only. Review app sign-in requests and issue a
 *    Collector Key in one tap."* (`:33119`)
 *  - the empty state: *"No access requests yet."* + *"A prospect can ask for
 *    access from the app sign-in screen ("Request access"). New requests
 *    appear here."* (`:33121`)
 *  - the card's anatomy (`:33014-33025`): name + date · contact · city ·
 *    "heard via {source}" · the referral line · the quoted why · **Issue key**
 *    (title "Create a Collector Key from this request") · **Decline**
 *  - the decline confirm: *"Decline this access request? It leaves the pending
 *    list."*, OK label "Decline" (`accessDeclineRequest`, `:37370`)
 *  - the "{n} pending" badge (`:33027`)
 *
 * The approve deviation is real and by design (`docs/PHASE_11B_PLAN.md` §2.3):
 * the old "Issue key" opened the full editable key modal; the API's approve
 * takes one optional `tier`, creates the Collector and returns the plaintext
 * once. So the flow here is a tier picker + confirm, then `ShownOnceSecret`.
 * **D13 is honoured**: the note the old flow composed —
 * `'From access request' + city/why/'via source'` (`:33367-33368`) — is
 * written onto the new collector with a follow-up PATCH, best-effort, so the
 * reviewer's context survives into the record the way it used to.
 *
 * One small loss, flagged: the old referral line resolved a personal ref code
 * to the referrer's *name* (`accRefName`, `:33013`) from the in-memory access
 * roster. No lookup endpoint exists, so the raw code is shown.
 */
import { useState } from 'react';
import { useApi, useOptions } from '../../api/hooks';
import type { AccessRequestAdmin, Choice } from '../../api/types';
import { useListController } from '../shared/useListController';
import { AccessRequestsController } from './AccessRequestsController';
import { ConfirmDialog, DeskBanner, DeskPage, ShownOnceSecret } from './kit';
import './admin.css';

export function AccessRequestsPage() {
  const { adminAccounts } = useApi();
  const options = useOptions();
  const { state, reload } = useListController(
    () => new AccessRequestsController(adminAccounts),
  );

  const [approving, setApproving] = useState<AccessRequestAdmin | null>(null);
  const [declining, setDeclining] = useState<AccessRequestAdmin | null>(null);
  const [tier, setTier] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ name: string; key: string } | null>(null);

  const tiers = (options?.['accounts.collector_tier'] as Choice[] | undefined) ?? [];
  const pending = state.results;

  const approve = async () => {
    if (!approving || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminAccounts.approveAccessRequest(approving.id, tier || null);
      setIssued({ name: approving.name || 'the collector', key: res.access_key });
      // D13 — carry the reviewer's context onto the new collector, the way the
      // old modal's pre-filled note did (:33367). Best-effort: the key is
      // already issued, so a failure here surfaces but does not undo anything.
      if (res.resulting_collector) {
        try {
          const c = await adminAccounts.collector(String(res.resulting_collector));
          const bits = [approving.city, approving.why]
            .concat(approving.referral_source ? [`via ${approving.referral_source}`] : [])
            .filter(Boolean);
          const note = 'From access request' + (bits.length ? ' · ' + bits.join(' · ') : '');
          await adminAccounts.updateCollector(c.id, {
            notes: c.notes ? `${c.notes}\n${note}` : note,
            expected_version: c.version,
          });
        } catch {
          setError('Key issued, but the request note could not be written to the collector.');
        }
      }
      setApproving(null);
      setTier('');
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not approve.');
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!declining || busy) return;
    setBusy(true);
    setError(null);
    try {
      await adminAccounts.declineAccessRequest(declining.id);
      setDeclining(null);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not decline.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DeskPage
      title={
        <>
          Access Requests
          {pending.length > 0 && (
            <span className="ad-badge-attn">{pending.length} pending</span>
          )}
        </>
      }
      subtitle={
        /* :33119, verbatim */
        <>Owner-only. Review app sign-in requests and issue a Collector Key in one tap.</>
      }
    >
      {issued && (
        <ShownOnceSecret
          label={`Key issued for ${issued.name}`}
          value={issued.key}
          hint="Shown once — deliver it privately." /* the server's own message */
          onDismiss={() => setIssued(null)}
        />
      )}
      {error && <DeskBanner>{error}</DeskBanner>}
      {state.status === 'loading' && pending.length === 0 && (
        <p className="dz-state">Loading…</p>
      )}
      {state.status === 'error' && <DeskBanner>{state.error}</DeskBanner>}

      {state.status !== 'loading' && state.status !== 'error' && pending.length === 0 && (
        /* :33121, verbatim, both sentences */
        <p className="dz-state">
          No access requests yet.
          <br />
          <span className="ad-cellsub">
            A prospect can ask for access from the app sign-in screen (“Request access”). New
            requests appear here.
          </span>
        </p>
      )}

      <div className="ad-reqcards">
        {pending.map((r) => (
          <RequestCard
            key={r.id}
            r={r}
            onIssue={() => setApproving(r)}
            onDecline={() => setDeclining(r)}
          />
        ))}
      </div>

      {approving && (
        <ConfirmDialog
          message={
            <>
              Issue a Collector Key for <b>{approving.name || 'this request'}</b>? This creates
              their collector record; the key is shown once.
              <label className="ad-field" style={{ marginTop: 12 }}>
                <span className="ad-filter-l">Tier · optional</span>
                <select value={tier} onChange={(e) => setTier(e.target.value)}>
                  <option value="">—</option>
                  {tiers.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          }
          okLabel="Issue key"
          busy={busy}
          onCancel={() => {
            setApproving(null);
            setTier('');
          }}
          onConfirm={() => void approve()}
        />
      )}

      {declining && (
        <ConfirmDialog
          /* :37370, verbatim, OK label included */
          message="Decline this access request? It leaves the pending list."
          okLabel="Decline"
          danger
          busy={busy}
          onCancel={() => setDeclining(null)}
          onConfirm={() => void decline()}
        />
      )}
    </DeskPage>
  );
}

function RequestCard({
  r,
  onIssue,
  onDecline,
}: {
  r: AccessRequestAdmin;
  onIssue: () => void;
  onDecline: () => void;
}) {
  // :33011-33013 — the card's own derived lines
  const contact = [r.email, r.phone].filter(Boolean).join(' · ');
  const meta = [r.city, r.referral_source ? `heard via ${r.referral_source}` : '']
    .filter(Boolean)
    .join(' · ');
  const ref = r.ref_code
    ? /^gallery:/i.test(r.ref_code)
      ? `via gallery ${r.ref_code.replace(/^gallery:/i, '')}`
      : `referred by ${r.ref_code}`
    : '';

  return (
    <div className="ad-card ad-reqcard">
      <div className="ad-reqbody">
        <div className="ad-reqname">
          {r.name || '—'}
          <span className="ad-cellsub">
            {' '}
            · {new Date(r.created_at).toLocaleDateString('en-GB')}
          </span>
        </div>
        {contact && <div className="ad-reqline">{contact}</div>}
        {meta && <div className="ad-reqmeta">{meta}</div>}
        {ref && <div className="ad-reqref">{ref}</div>}
        {r.why && <div className="ad-reqwhy">“{r.why}”</div>}
      </div>
      <div className="ad-reqacts">
        {/* :33023 — title verbatim */}
        <button
          type="button"
          className="ad-action"
          title="Create a Collector Key from this request"
          onClick={onIssue}
        >
          Issue key
        </button>
        <button type="button" className="ad-ghostbtn is-danger" onClick={onDecline}>
          Decline
        </button>
      </div>
    </div>
  );
}
