/**
 * AccessDeskPage — `/admin/access`, the owner's roster-wide key desk: the old
 * panel's Owner → Access tab, `accessView()` (`darz-studio.html:33024-33113`),
 * over G-KEY-1 (`GET /auth/admin/access-keys/` + `…/summary/`). Owner-only
 * (**Q-1**, owner: "use your recommendations" — keep the old nav's
 * `OWNER_ONLY`, `:11797`); `RequireOwner` answers anyone else with the old
 * desk's own refusal card (`:33025`).
 *
 * Ported, in the old order (`:33103-33113`):
 *  - the heading "Access Management" and its sub-line, verbatim (`:33108-33110`);
 *  - the stat row (`:33111`) — see `accessTiles()` for the four that port and
 *    the one (Admin keys) that cannot;
 *  - the review banner (`:33049-33059`): "*n* keys need a decision — extend or
 *    let expire", each lapsed / lapsing key with the three extend buttons
 *    (`extBtns`, `:33048`);
 *  - the filter bar (`:33061-33065`): search, and the status select ("All
 *    statuses") over the served `accounts.access_key_status` labels. The
 *    "Expiring ≤ 7d" toggle is the plan's chip (`?expiring_soon=true`), named
 *    with the old tile's own words;
 *  - the table (`:33111-33112`): Name · Status · Created · Access period ·
 *    Last login · Logins · Saved · Holds · Offers · Requests · Auction, with
 *    the old zero styling (`n()`, `:33069`) and the old empty sentence;
 *  - extend's toast (`accessExtend`, `:37097`/`:37101`) and Revoke with the
 *    confirm the collector detail already ports.
 *
 * **Status is computed (C-17)** — `displayStatus()`: the stored status lags
 * expiry, so a lapsed key nobody has tried still says `active`.
 *
 * Not ported, and why (flags, not silent drops — reported to the owner):
 *  - **Key**: the plaintext is never re-exposed after issue (the server's rule),
 *    so the Key column and "or key" in the search placeholder have no data.
 *  - **Type / "All access types"**: this roster is collector keys only — admin
 *    sign-in is a Team login, a gallery's is its portal link.
 *  - **Classification** (tier) and the row notes: not on the roster row.
 *  - **＋ Collector / ＋ Admin / ＋ Gallery Key, ⇩ Export**: a collector key is
 *    issued on the collector's page (the name links there); admin logins live
 *    on Team; gallery access on Galleries & Sources; there is no export
 *    endpoint.
 *  - **✉ Invite, ⧖ Activity, Edit, ×**: Invite sends the plaintext key, which
 *    no longer exists after issue; Activity and Edit are the collector's page;
 *    remove is Revoke (a revoked key stays on record, server rule).
 *  - **The OTP panel** (`otpPanelHTML`, top of the old tab) and the ☁ Cloud
 *    footnote: no OTP API; the Cloud sync it describes does not exist here.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type {
  AccessKeyDeskSummary,
  AccessKeyRoster,
  AccessKeyRosterQuery,
} from '../../api/types';
import { useListController } from '../shared/useListController';
import { AccessDeskController } from './AccessDeskController';
import {
  STATUS_TONE,
  accessTiles,
  actionFailure,
  attentionHeading,
  attentionLine,
  attentionRows,
  canAct,
  displayStatus,
  extendToast,
  type ExtendChoice,
} from './accessDesk';
import { ExpiryCell } from './ExpiryCell';
import { choices, label } from './saleForm';
import {
  ConfirmDialog,
  DeskList,
  DeskPage,
  DeskToast,
  SearchFilter,
  SelectFilter,
  ToggleFilter,
  useDeskToast,
  type Column,
} from './kit';
import './admin.css';

/** The old `extBtns` (`:33048`), verbatim. */
const EXTENDS: ReadonlyArray<readonly [ExtendChoice, string]> = [
  ['1w', '+1 week'],
  ['1m', '+1 month'],
  ['none', 'Make permanent'],
];

/** The activity columns, in the old order (`:33111`: Logins, Saved, Holds,
 * Offers, Requests, Auction). */
const TALLIES: ReadonlyArray<readonly [keyof AccessKeyRoster['activity'], string]> = [
  ['logins', 'Logins'],
  ['saved', 'Saved'],
  ['holds', 'Holds'],
  ['offers', 'Offers'],
  ['requests', 'Requests'],
  ['auction', 'Auction'],
];

export function AccessDeskPage() {
  const { adminAccounts } = useApi();
  const options = useOptions();
  const { say, message: toast } = useDeskToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<AccessKeyRoster | null>(null);

  const { state, setQuery, setPage, reload } = useListController<
    AccessKeyRoster,
    AccessKeyRosterQuery
  >(() => new AccessDeskController(adminAccounts));

  /* The stat row and the review banner read the whole roster, not the
     filtered page (the old desk computed both from `all`, `:33026`/`:33045`). */
  const [summary, setSummary] = useState<AccessKeyDeskSummary | null>(null);
  const [attention, setAttention] = useState<AccessKeyRoster[]>([]);
  /* bumped after every extend/revoke so the tiles and banner re-read too */
  const [overviewTick, setOverviewTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      adminAccounts.accessKeysSummary().catch(() => null),
      adminAccounts
        .accessKeysRoster({ status: 'expired', per_page: 100 })
        .then((p) => p.results)
        .catch(() => []),
      adminAccounts
        .accessKeysRoster({ expiring_soon: true, per_page: 100 })
        .then((p) => p.results)
        .catch(() => []),
    ]).then(([s, expired, soon]) => {
      if (!alive) return;
      setSummary(s);
      setAttention(attentionRows(expired, soon));
    });
    return () => {
      alive = false;
    };
  }, [adminAccounts, overviewTick]);
  const refresh = () => {
    setOverviewTick((t) => t + 1);
    return reload();
  };

  const statuses = choices(options, 'accounts.access_key_status');

  const run = async (id: string, action: () => Promise<string | null>) => {
    setBusyId(id);
    setActionError(null);
    try {
      const done = await action();
      if (done) say(done);
      await refresh();
    } catch (err: unknown) {
      const failure = actionFailure(err);
      setActionError(failure.message);
      if (failure.reload) await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const extend = (k: AccessKeyRoster, choice: ExtendChoice) =>
    void run(k.id, async () => {
      const updated = await adminAccounts.extendAccessKey(k.id, choice);
      return extendToast(k.collector?.display_name, choice, updated.expires_at);
    });

  const actions = (k: AccessKeyRoster) =>
    canAct(k) ? (
      <span className="ad-keyacts" aria-busy={busyId === k.id || undefined}>
        {EXTENDS.map(([choice, text]) => (
          <button
            key={choice}
            type="button"
            className="ad-rowbtn"
            disabled={busyId === k.id}
            onClick={() => extend(k, choice)}
          >
            {text}
          </button>
        ))}
        <button
          type="button"
          className="ad-rowbtn is-danger"
          disabled={busyId === k.id}
          onClick={() => setRevoking(k)}
        >
          Revoke
        </button>
      </span>
    ) : null;

  const columns: ReadonlyArray<Column<AccessKeyRoster>> = [
    {
      key: 'name',
      header: 'Name',
      cell: (k) =>
        k.collector ? (
          <Link className="ad-accname" to={`/admin/collectors/${k.collector.id}`}>
            {k.collector.display_name || '—'}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (k) => {
        const s = displayStatus(k);
        return <span className={`ad-stpill is-${STATUS_TONE[s]}`}>{label(statuses, s)}</span>;
      },
    },
    {
      key: 'created',
      header: 'Created',
      className: 'ad-when',
      cell: (k) => new Date(k.issued_at).toLocaleDateString('en-GB'),
    },
    {
      key: 'period',
      header: 'Access period',
      cell: (k) => <ExpiryCell expiresAt={k.expires_at} />,
    },
    {
      key: 'last',
      header: 'Last login',
      className: 'ad-when',
      cell: (k) =>
        k.last_used_at
          ? new Date(k.last_used_at).toLocaleString('en-GB', {
              dateStyle: 'short',
              timeStyle: 'short',
            })
          : '—',
    },
    ...TALLIES.map(([field, header]): Column<AccessKeyRoster> => ({
      key: field,
      header,
      headClassName: 'ad-accnum',
      className: 'ad-accnum',
      cell: (k) => {
        const n = k.activity?.[field] ?? 0;
        return n ? <b>{n}</b> : <span className="ad-acczero">0</span>;
      },
    })),
    { key: 'actions', header: '', className: 'ad-accacts', cell: actions },
  ];

  return (
    <DeskPage
      wide
      title="Access Management"
      subtitle={
        /* `:33110`, verbatim */
        <>
          Access is granted personally. Each person signs in with their first name and key —
          their permanent identifier.
        </>
      }
      strip={
        <>
          <div className="ad-tiles ad-tiles-sales" aria-label="Access overview">
            {accessTiles(summary).map((t) => (
              <div key={t.key} className="ad-tile">
                <span className={`ad-tile-v${t.tone ? ` is-${t.tone}` : ''}`}>{t.value}</span>
                <span className="ad-tile-l">{t.label}</span>
              </div>
            ))}
          </div>
          {attention.length > 0 && (
            <AttentionBanner rows={attention} busyId={busyId} onExtend={extend} />
          )}
        </>
      }
      toolbar={
        <>
          <SearchFilter
            label="Search"
            value={state.query.search}
            onChange={(search) => setQuery({ search })}
            placeholder="Search by name…"
          />
          <SelectFilter
            label="Status"
            anyLabel="All statuses"
            value={state.query.status}
            onChange={(status) =>
              setQuery({ status: status as AccessKeyRosterQuery['status'] })
            }
            choices={statuses}
          />
          <ToggleFilter
            label="Expiring ≤ 7d"
            checked={state.query.expiring_soon === true}
            onChange={(on) => setQuery({ expiring_soon: on || undefined })}
          />
        </>
      }
    >
      <DeskList
        label="Access keys"
        status={state.status}
        error={state.error}
        actionError={actionError}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(k) => k.id}
        busyKey={busyId}
        empty="No access keys match."
      />

      {revoking && (
        <ConfirmDialog
          message="Revoke this key? The collector can no longer sign in with it."
          okLabel="Revoke"
          danger
          onCancel={() => setRevoking(null)}
          onConfirm={() => {
            const k = revoking;
            setRevoking(null);
            void run(k.id, async () => {
              await adminAccounts.revokeAccessKey(k.id);
              return null;
            });
          }}
        />
      )}
      <DeskToast message={toast} />
    </DeskPage>
  );
}

/** The old review banner (`:33049-33059`) — lapsed and lapsing keys, soonest
 * first, each with the extend buttons. The old row's ✉ Invite is not carried
 * (it sends the plaintext key, which the server never re-exposes). */
function AttentionBanner({
  rows,
  busyId,
  onExtend,
}: {
  rows: AccessKeyRoster[];
  busyId: string | null;
  onExtend: (k: AccessKeyRoster, choice: ExtendChoice) => void;
}) {
  return (
    <section className="ad-accattn" aria-label="Keys needing a decision">
      <div className="ad-accattn-h">
        <span aria-hidden="true">⏳</span>
        {attentionHeading(rows.length)}
      </div>
      <div className="ad-accattn-sub">
        Expiring within 7 days or already expired. Extend to keep a collector, or let it lapse.
      </div>
      {rows.map((k) => {
        const lapsed = displayStatus(k) === 'expired';
        return (
          <div key={k.id} className="ad-accattn-row">
            <div className="ad-accattn-who">
              <b>{k.collector?.display_name || '—'}</b>
              <div className={`ad-accattn-when${lapsed ? ' is-expired' : ''}`}>
                {attentionLine(k.expires_at)}
              </div>
            </div>
            <div className="ad-keyacts" aria-busy={busyId === k.id || undefined}>
              {EXTENDS.map(([choice, text]) => (
                <button
                  key={choice}
                  type="button"
                  className="ad-rowbtn"
                  disabled={busyId === k.id}
                  onClick={() => onExtend(k, choice)}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
