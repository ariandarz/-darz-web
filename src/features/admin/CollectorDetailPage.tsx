/**
 * CollectorDetailPage — `/admin/collectors/:id`, one collector's workspace:
 * the editable record, their access keys, and their sign-in history. The
 * modern-mechanics form of the old `colDetail(id)` pane the roster opened
 * (`darz-studio.html:40135`), holding the same three concerns.
 *
 * Keys — the content is the old Access desk's, feature for feature:
 *  - **Issue** returns the plaintext exactly once (`ShownOnceSecret`; the
 *    server's own words: *"Access key issued — shown once, deliver it to the
 *    collector now."*).
 *  - **The expiry cell** ports `expCell` (`:33042`): Never / Expired /
 *    "Expires today" / "*n*d left", with its three colours (red / amber /
 *    green), plus the date underneath.
 *  - **Revoke** — the old desk's own wording; a locked key is refused at
 *    sign-in. Confirmed first (`dzConfirm` shape).
 *  - **Extend** — "+1 week" / "+1 month" / "Make permanent", the old desk's
 *    three buttons, over Phase 33's endpoint (extends from max(now, expiry),
 *    so a lapsed key extends from today).
 *
 * Sign-ins — Phase 33's real event log (`AccessKey.last_used_at` only keeps
 * the most recent, overwritten every time; that is the whole reason the log
 * exists).
 *
 * Remove is a soft delete behind a confirm; the server excludes soft-deleted
 * rows from every queryset.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type {
  AccessKeyAdmin,
  Choice,
  CollectorAdmin,
  CollectorLoginEvent,
} from '../../api/types';
import { CollectorForm } from './CollectorForm';
import { expiryParts } from './expiry';
import { ConfirmDialog, DataTable, DeskBanner, ShownOnceSecret, type Column } from './kit';
import './admin.css';

export function CollectorDetailPage() {
  const { id = '' } = useParams();
  const { adminAccounts } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const [collector, setCollector] = useState<CollectorAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminAccounts.collector(id).then(
      (c) => setCollector(c),
      (err: unknown) => setError(err instanceof Error ? err.message : 'Could not load.'),
    );
  }, [adminAccounts, id]);
  useEffect(load, [load]);

  const remove = async () => {
    setBusy(true);
    try {
      await adminAccounts.deleteCollector(id);
      navigate('/admin/collectors', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove.');
      setRemoving(false);
    } finally {
      setBusy(false);
    }
  };

  const tierLabel = choice(options, 'accounts.collector_tier', collector?.tier);
  const accessLabel = choice(
    options,
    'accounts.collector_access_status',
    collector?.access_status,
  );

  return (
    <div className="dz-page ad-page">
      <div className="ad-thread-head">
        <Link to="/admin/collectors" className="ad-back">
          ← Collectors
        </Link>
        <div className="ad-thread-who">
          <div className="ad-thread-name">{collector?.display_name ?? '…'}</div>
          {collector && (
            <div className="ad-thread-sub">
              {[tierLabel, accessLabel, collector.city].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div className="ad-spacer" />
        {collector && !editing && (
          <>
            <Link
              to={`/admin/requests?view=activity&collector=${collector.id}`}
              className="ad-ghostbtn"
            >
              Activity
            </Link>
            <button type="button" className="ad-ghostbtn" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              type="button"
              className="ad-ghostbtn is-danger"
              onClick={() => setRemoving(true)}
            >
              Remove
            </button>
          </>
        )}
      </div>

      {error && <DeskBanner>{error}</DeskBanner>}
      {!collector && !error && <p className="dz-state">Loading…</p>}

      {collector && editing && (
        <CollectorForm
          title="Edit collector"
          existing={collector}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setCollector(saved);
            setEditing(false);
          }}
        />
      )}

      {collector && !editing && (
        <>
          <RecordCard collector={collector} tierLabel={tierLabel} accessLabel={accessLabel} />
          <KeysSection collectorId={collector.id} />
          <LoginsSection collectorId={collector.id} />
        </>
      )}

      {removing && collector && (
        <ConfirmDialog
          message={`Remove ${collector.display_name}? Their record leaves every roster; issued keys stop working.`}
          okLabel="Remove"
          danger
          busy={busy}
          onCancel={() => setRemoving(false)}
          onConfirm={() => void remove()}
        />
      )}
    </div>
  );
}

function RecordCard({
  collector,
  tierLabel,
  accessLabel,
}: {
  collector: CollectorAdmin;
  tierLabel: string;
  accessLabel: string;
}) {
  const rows: Array<[string, string]> = [
    ['Full name', collector.full_name || '—'],
    ['Email', collector.email || '—'],
    ['Phone', collector.phone || '—'],
    ['City', collector.city || '—'],
    ['Tier', tierLabel || '—'],
    ['Access', accessLabel || '—'],
    ['Notes', collector.notes || '—'],
    ['Since', new Date(collector.created_at).toLocaleDateString('en-GB')],
  ];
  return (
    <div className="ad-card ad-record">
      {rows.map(([k, v]) => (
        <div key={k} className="ad-recrow">
          <span className="ad-reck">{k}</span>
          <span className="ad-recv">{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ---- access keys --------------------------------------------------------- */

function KeysSection({ collectorId }: { collectorId: string }) {
  const { adminAccounts } = useApi();
  const [keys, setKeys] = useState<AccessKeyAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<AccessKeyAdmin | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    adminAccounts.accessKeys(collectorId, { per_page: 50 }).then(
      (page) => setKeys(page.results),
      (err: unknown) => setError(err instanceof Error ? err.message : 'Could not load keys.'),
    );
  }, [adminAccounts, collectorId]);
  useEffect(load, [load]);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const issue = () =>
    run('issue', async () => {
      const res = await adminAccounts.issueAccessKey(collectorId);
      setSecret(res.access_key);
    });

  const statusLabelFor = (k: AccessKeyAdmin) =>
    k.status.charAt(0).toUpperCase() + k.status.slice(1);

  const columns: ReadonlyArray<Column<AccessKeyAdmin>> = [
    { key: 'status', header: 'Status', cell: statusLabelFor },
    { key: 'expiry', header: 'Expiry', cell: (k) => <ExpiryCell expiresAt={k.expires_at} /> },
    {
      key: 'issued',
      header: 'Issued',
      className: 'ad-when',
      cell: (k) => new Date(k.issued_at).toLocaleDateString('en-GB'),
    },
    {
      key: 'last',
      header: 'Last used',
      className: 'ad-when',
      cell: (k) =>
        k.last_used_at ? new Date(k.last_used_at).toLocaleDateString('en-GB') : '—',
    },
    {
      key: 'actions',
      header: '',
      cell: (k) =>
        k.status === 'active' ? (
          <span className="ad-keyacts" aria-busy={busyId === k.id || undefined}>
            {/* :the old desk's three extend buttons, verbatim */}
            <button
              type="button"
              className="ad-rowbtn"
              onClick={() => void run(k.id, () => adminAccounts.extendAccessKey(k.id, '1w'))}
            >
              +1 week
            </button>
            <button
              type="button"
              className="ad-rowbtn"
              onClick={() => void run(k.id, () => adminAccounts.extendAccessKey(k.id, '1m'))}
            >
              +1 month
            </button>
            <button
              type="button"
              className="ad-rowbtn"
              onClick={() => void run(k.id, () => adminAccounts.extendAccessKey(k.id, 'none'))}
            >
              Make permanent
            </button>
            <button
              type="button"
              className="ad-rowbtn is-danger"
              onClick={() => setConfirmRevoke(k)}
            >
              Revoke
            </button>
          </span>
        ) : null,
    },
  ];

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Access keys</h2>
        <span className="ad-dsec-n">a locked key is refused at sign-in</span>
        <div className="ad-spacer" />
        <button
          type="button"
          className="ad-action"
          disabled={busyId === 'issue'}
          onClick={() => void issue()}
        >
          Issue key
        </button>
      </div>

      {secret && (
        <ShownOnceSecret
          label="Collector key issued"
          value={secret}
          hint="This key signs the collector in. Deliver it privately — it is not stored and cannot be shown again."
          onDismiss={() => setSecret(null)}
        />
      )}
      {error && <DeskBanner>{error}</DeskBanner>}
      {keys === null && !error && <p className="dz-state">Loading…</p>}
      {keys?.length === 0 && <p className="dz-state">No keys issued yet.</p>}
      {keys !== null && keys.length > 0 && (
        <DataTable columns={columns} rows={keys} rowKey={(k) => k.id} label="Access keys" />
      )}

      {confirmRevoke && (
        <ConfirmDialog
          message="Revoke this key? The collector can no longer sign in with it."
          okLabel="Revoke"
          danger
          onCancel={() => setConfirmRevoke(null)}
          onConfirm={() => {
            const key = confirmRevoke;
            setConfirmRevoke(null);
            void run(key.id, () => adminAccounts.revokeAccessKey(key.id));
          }}
        />
      )}
    </section>
  );
}

function ExpiryCell({ expiresAt }: { expiresAt: string | null }) {
  const { label, tone } = expiryParts(expiresAt);
  return (
    <>
      <span className={`ad-exp is-${tone}`}>{label}</span>
      {expiresAt && (
        <span className="ad-cellsub">{new Date(expiresAt).toLocaleDateString('en-GB')}</span>
      )}
    </>
  );
}

/* ---- sign-in history ----------------------------------------------------- */

function LoginsSection({ collectorId }: { collectorId: string }) {
  const { adminAccounts } = useApi();
  const [events, setEvents] = useState<CollectorLoginEvent[] | null>(null);

  useEffect(() => {
    let alive = true;
    adminAccounts.loginEvents(collectorId, { per_page: 20 }).then(
      (page) => alive && setEvents(page.results),
      () => alive && setEvents([]),
    );
    return () => {
      alive = false;
    };
  }, [adminAccounts, collectorId]);

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Sign-ins</h2>
        <span className="ad-dsec-n">most recent first</span>
      </div>
      {events === null && <p className="dz-state">Loading…</p>}
      {events?.length === 0 && <p className="dz-state">No sign-ins recorded yet.</p>}
      {events !== null && events.length > 0 && (
        <div className="ad-card ad-logins">
          {events.map((e) => (
            <div key={e.id} className="ad-recrow">
              <span className="ad-recv">
                {new Date(e.created_at).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function choice(
  options: OptionsMap | null,
  key: string,
  value: string | null | undefined,
): string {
  if (!value) return '';
  const list = (options?.[key] as Choice[] | undefined) ?? [];
  return list.find((c) => c.value === value)?.label ?? value;
}
