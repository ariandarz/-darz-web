/**
 * SourcesPage — `/admin/sources`, "Galleries & Sources" (`sourcesView()`,
 * `darz-studio.html:27288`) over backend Phase 10/12's gallery-link admin.
 *
 * Ported content:
 *  - the title and the sub-line, trimmed to what is real here: "Galleries,
 *    dealers and artists who share works with Darz — each relationship in
 *    one place, with the works they shared" (`:27322`; deals & commissions
 *    and the archive are the accounting/portal phases');
 *  - the entity tabs (Partner Galleries · Dealers · Artists · Collectors,
 *    `:27296`) — here the `source_type` filter, the server's own axis;
 *  - the reminder banner, verbatim shape: "**n gallery updates** awaiting
 *    your review. Review them →" (`:27326`) — counted from the pending
 *    queue's own total;
 *  - the Source Updates queue as the desk's second half (a segment, the
 *    Requests & Activity pattern) — approve/reject with the review note,
 *    and the kinds' real semantics said in the confirm (approving an
 *    availability/price/correction update APPLIES it to the artwork; a
 *    `withdraw` UNASSIGNS the work from the portal (G-PORT-6); the other
 *    kinds record intent, `GalleryUpdateService.approve`). An `ask`
 *    (G-PORT-4) shows its question and is answered in the review note, which
 *    the partner reads in their History; an `image` (G-PORT-1) says a photo
 *    arrived — the desk gets no URL for it yet (C-12).
 *
 * The partner search is server-side (`?search=` over name / contact /
 * email, G-PORT-15), so it finds a partner past the first page.
 *
 * The Galleries tab (`:11727`) opens this desk on the gallery slice — the
 *  old per-gallery workspace (exhibitions, portal preview, documents) is
 * the portal phase's own step; the tab's note says so.
 *
 * Issuing a link is the access-key contract: the token + PIN show ONCE
 * (`GalleryLinkIssueResponseSerializer` — "never retrievable again"), in
 * the kit's ShownOnceSecret.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { Choice, GalleryLinkAdmin, GalleryUpdateAdmin } from '../../api/types';
import { Segment } from '../../components';
import {
  ConfirmDialog,
  DeskAction,
  DeskBanner,
  DeskPage,
  DataTable,
  Pager,
  SearchFilter,
  type Column,
} from './kit';
import { ExhibitionsQueue } from './ExhibitionsQueue';
import { IssuedCredentials } from './SourceCredentials';
import { describeUpdate } from './exhibitionForm';
import './admin.css';

type View = 'partners' | 'updates' | 'exhibitions';

export function SourcesPage() {
  const { galleryAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const typeParam = params.get('type') ?? undefined;
  /** The nav's Galleries tab is this desk filtered to galleries (`adminNav.ts`
   * routes it to `?type=gallery`), and the old panel treats it as its own
   * desk with its own heading and copy. */
  const galleriesTab = typeParam === 'gallery';
  const viewParam = params.get('view');
  const [view, setView] = useState<View>(
    viewParam === 'updates'
      ? 'updates'
      : viewParam === 'exhibitions'
        ? 'exhibitions'
        : 'partners',
  );

  const types = choices(options, 'gallery.source_type');
  const kinds = choices(options, 'gallery.update_kind');

  // ---- the links half ----
  // Server-side search (G-PORT-15): the query rides the list read, and a
  // late answer for an older query is dropped rather than painted.
  const [query, setQuery] = useState('');
  const needle = query.trim();
  const [links, setLinks] = useState<GalleryLinkAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const loadLinks = useCallback(() => setReloadTick((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    galleryAdmin
      .links({ source_type: typeParam, search: needle || undefined, per_page: 100 })
      .then(
        (page) => alive && setLinks(page.results),
        (err: unknown) =>
          alive &&
          setError(err instanceof Error ? err.message : 'Could not load the partners.'),
      );
    return () => {
      alive = false;
    };
  }, [galleryAdmin, typeParam, needle, reloadTick]);

  // The reminder banner's number, AND who it is waiting on. One call for the
  // whole table: `GalleryUpdate` carries its `link`, so the rows can say
  // which partner is waiting without a request per row. Added 2026-09-19 —
  // the list used to show `feat_funnel` (an internal switch) where the state
  // of the relationship belongs.
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [waiting, setWaiting] = useState<Map<string, number>>(new Map());
  const loadPending = useCallback(() => {
    galleryAdmin.updates({ status: 'pending', per_page: 100 }).then(
      (page) => {
        setPendingCount(page.pagination.total_count);
        const by = new Map<string, number>();
        for (const u of page.results) by.set(u.link, (by.get(u.link) ?? 0) + 1);
        setWaiting(by);
      },
      () => {
        setPendingCount(null);
        setWaiting(new Map());
      },
    );
  }, [galleryAdmin]);
  useEffect(loadPending, [loadPending]);

  const shown = links;

  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{
    id: string;
    name: string;
    token: string;
    pin: string;
    contactName: string;
  } | null>(null);

  const columns: ReadonlyArray<Column<GalleryLinkAdmin>> = [
    {
      key: 'name',
      header: 'Partner',
      cell: (l) => (
        <>
          <span className="ad-cellmain">{l.name}</span>
          <span className="ad-cellsub">{label(types, l.source_type)}</span>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Portal',
      cell: (l) => (
        <span
          className={`ad-stpill is-${l.status === 'active' ? 'ok' : l.status === 'disabled' ? 'neut' : 'gone'}`}
        >
          {l.status}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (l) => (
        <>
          {l.contact_name && <span className="ad-cellmain">{l.contact_name}</span>}
          {(l.contact_email || l.contact_phone) && (
            <span className="ad-cellsub">{l.contact_email || l.contact_phone}</span>
          )}
          {!l.contact_name && !l.contact_email && !l.contact_phone && '—'}
        </>
      ),
    },
    {
      key: 'waiting',
      header: 'Waiting',
      cell: (l) => {
        const n = waiting.get(l.id) ?? 0;
        return n > 0 ? (
          <span className="ad-badge-attn">
            {n} update{n === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="ad-cellsub">—</span>
        );
      },
    },
    {
      key: 'since',
      header: 'Since',
      className: 'ad-when',
      cell: (l) => new Date(l.created_at).toLocaleDateString('en-GB'),
    },
    {
      key: 'open',
      header: '',
      cell: (l) => (
        <button
          type="button"
          className="ad-rowbtn"
          onClick={() => navigate(`/admin/sources/${l.id}`)}
        >
          Open
        </button>
      ),
    },
  ];

  return (
    <DeskPage
      wide
      /* The nav has TWO tabs on this route — Galleries (`?type=gallery`) and
         Sources & Partners — and until 2026-09-22 both drew the partners
         desk's heading and sub-line, so the Galleries tab read as the wrong
         desk. The old panel gives it its own (`workspaces-runtime.js:195`),
         and the sub-line it gives it is precisely the one that explains the
         overlap: "The same record the Sources & Partners desk edits — there
         is only one." Found against `04-galleries`. */
      title={galleriesTab ? 'Galleries' : 'Galleries & Sources'}
      action={
        <span className="ad-rowacts">
          <Segment<View>
            label="Partners or updates"
            options={[
              { value: 'partners', content: 'Partners' },
              { value: 'updates', content: 'Source Updates' },
              { value: 'exhibitions', content: 'Exhibitions' },
            ]}
            value={view}
            onChange={(v) => {
              setView(v);
              const next = new URLSearchParams(params);
              if (v === 'partners') next.delete('view');
              else next.set('view', v);
              setParams(next);
            }}
          />
          {view === 'partners' && (
            <DeskAction onClick={() => setIssuing(true)}>＋ New partner</DeskAction>
          )}
        </span>
      }
      toolbar={
        view === 'partners' ? (
          <>
            <SearchFilter
              label="Find a partner"
              placeholder="Name, contact or email…"
              value={query}
              onChange={(v) => setQuery(v ?? '')}
            />
            <label className="ad-filter">
              <span className="ad-filter-l">Type</span>
              <select
                value={typeParam ?? ''}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  if (e.target.value) next.set('type', e.target.value);
                  else next.delete('type');
                  setParams(next);
                }}
              >
                <option value="">All partners</option>
                {types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : undefined
      }
      subtitle={
        galleriesTab ? (
          /* `workspaces-runtime.js:195`, verbatim. */
          <>
            Every gallery Darz works with. Open one for its artworks, the portal it sees, and
            its passport. The same record the Sources &amp; Partners desk edits — there is only
            one.
          </>
        ) : (
          <>
            Galleries, dealers and artists who share works with Darz — each relationship in one
            place, with the works they shared and a no-login portal (token + PIN). Deals &amp;
            commissions and the archive follow with the accounting and portal phases.
          </>
        )
      }
    >
      {/* :27326 — the reminder banner, on the partners half only */}
      {view === 'partners' && (pendingCount ?? 0) > 0 && (
        <div className="ad-remind">
          <span>
            <b>
              {pendingCount} source update{pendingCount === 1 ? '' : 's'}
            </b>{' '}
            awaiting your review.
          </span>
          <button type="button" onClick={() => setView('updates')}>
            Review them →
          </button>
        </div>
      )}

      {error && <DeskBanner>{error}</DeskBanner>}

      {issued && (
        <IssuedCredentials
          issued={issued}
          onOpen={() => navigate(`/admin/sources/${issued.id}`)}
          onDone={() => setIssued(null)}
        />
      )}

      {issuing && (
        <IssueForm
          types={types}
          initialType={typeParam}
          onClose={() => setIssuing(false)}
          onIssued={(next) => {
            setIssuing(false);
            setIssued(next);
            loadLinks();
          }}
        />
      )}

      {view === 'exhibitions' ? (
        <ExhibitionsQueue
          options={options}
          linkNames={new Map((links ?? []).map((l) => [l.id, l.name]))}
        />
      ) : view === 'partners' ? (
        !shown && !error ? (
          <p className="dz-state">Loading…</p>
        ) : shown && shown.length === 0 ? (
          <p className="dz-state">
            {needle
              ? `No partner matches “${needle}”.`
              : galleriesTab
                ? 'No galleries yet — add the first with ＋ New partner.'
                : typeParam
                  ? 'No partners of this type yet.'
                  : /* names the control, the way this panel's other empty
                     states do ("add one with ＋ New deal") — "issue the
                     first" read as a document, not a partner */
                    'No partners yet — add the first with ＋ New partner.'}
          </p>
        ) : shown ? (
          <DataTable label="Partners" rows={shown} columns={columns} rowKey={(l) => l.id} />
        ) : null
      ) : (
        <UpdatesQueue kinds={kinds} onReviewed={loadPending} />
      )}
    </DeskPage>
  );
}

/** A submitted update in words — the reviewer reads rows, the raw payload
 * stays behind a fold for the day the words miss something. */
function ReviewRows({ update }: { update: GalleryUpdateAdmin }) {
  const rows = describeUpdate(update);
  const payload = (update.payload as Record<string, unknown>) ?? {};
  if (!rows.length && !Object.keys(payload).length) return null;
  return (
    <div className="ad-revrows">
      {rows.map((r, i) => (
        <div className="ad-revrow" key={i}>
          <span className="ad-revk">{r.label}</span>
          <span className="ad-revv">
            {r.from ? (
              <>
                <s>{r.from}</s> → <b>{r.to}</b>
              </>
            ) : (
              r.to
            )}
          </span>
        </div>
      ))}
      {Object.keys(payload).length > 0 && (
        <details className="ad-revraw">
          <summary>raw payload</summary>
          <pre className="ad-updpayload">{JSON.stringify(payload, null, 1).slice(0, 600)}</pre>
        </details>
      )}
    </div>
  );
}

/** The Source Updates queue — the desk's second half (`spUpdatesBody`,
 * old sub-tab `updates`). Approve/reject with the note; the confirm names
 * what approval DOES for the kind. */
function UpdatesQueue({ kinds, onReviewed }: { kinds: Choice[]; onReviewed: () => void }) {
  const { galleryAdmin } = useApi();
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<GalleryUpdateAdmin[] | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [reviewing, setReviewing] = useState<{
    update: GalleryUpdateAdmin;
    verdict: 'approve' | 'reject';
  } | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    galleryAdmin.updates({ status: status || undefined, page, per_page: 25 }).then(
      (p) => {
        setRows(p.results);
        setPagination(p.pagination);
      },
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the queue.'),
    );
  }, [galleryAdmin, status, page]);
  useEffect(load, [load]);

  // resolve link names once (the queue rows carry bare link uuids)
  useEffect(() => {
    let alive = true;
    galleryAdmin.links({ per_page: 100 }).then(
      (p) => alive && setNames(new Map(p.results.map((l) => [l.id, l.name]))),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [galleryAdmin]);

  const review = async (update: GalleryUpdateAdmin, verdict: 'approve' | 'reject') => {
    setBusyId(update.id);
    setError(null);
    try {
      if (verdict === 'approve') await galleryAdmin.approveUpdate(update.id, note);
      else await galleryAdmin.rejectUpdate(update.id, note);
      setNote('');
      load();
      onReviewed();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not record the review.');
    } finally {
      setBusyId(null);
    }
  };

  const applies = (kind: string) =>
    kind === 'availability' || kind === 'price' || kind === 'correction';

  /** What approving THIS kind does, said before it is done
   * (`GalleryUpdateService.approve`). */
  const approveCopy = (kind: string) =>
    kind === 'withdraw'
      ? 'Approve this request? The work is removed from the partner’s portal — its snapshot row is unassigned; the artwork itself is untouched.'
      : kind === 'ask'
        ? 'Mark this question answered? Write the answer in the note — the partner reads it in their portal History. For a longer reply, use the Messages thread on their page.'
        : kind === 'image'
          ? 'Approve this image? It records the decision — the new photo is not applied automatically; replace the image on the artwork yourself.'
          : applies(kind)
            ? 'Approve this update? It is APPLIED to the artwork through the real catalogue path (a status change transitions it; price/correction fields are written).'
            : 'Approve this update? It records the decision — this kind changes nothing automatically; follow through on the artwork yourself.';

  return (
    <>
      <div className="ad-toolbar">
        <label className="ad-filter">
          <span className="ad-filter-l">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="">All</option>
          </select>
        </label>
      </div>

      {error && <DeskBanner>{error}</DeskBanner>}
      {!rows && !error && <p className="dz-state">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="dz-state">
          {status === 'pending' ? 'Nothing waiting — the queue is clear.' : 'No updates here.'}
        </p>
      )}

      {rows &&
        rows.map((u) => (
          <div key={u.id} className="ad-card ad-updrow">
            <div className="ad-updmain">
              <span className="ad-cellmain">
                {names.get(u.link) ?? 'A partner'} ·{' '}
                {kinds.find((k) => k.value === u.kind)?.label ?? u.kind}
              </span>
              <span className="ad-cellsub">
                {new Date(u.created_at).toLocaleString('en-GB')}
                {u.status !== 'pending' ? ` · ${u.status}` : ''}
                {u.review_note ? ` · “${u.review_note}”` : ''}
              </span>
              <ReviewRows update={u} />
            </div>
            {u.status === 'pending' && (
              <span className="ad-rowacts">
                <button
                  type="button"
                  className="ad-rowbtn"
                  disabled={busyId === u.id}
                  onClick={() => setReviewing({ update: u, verdict: 'approve' })}
                >
                  {u.kind === 'ask' ? 'Mark handled' : 'Approve'}
                </button>
                <button
                  type="button"
                  className="ad-rowbtn is-danger"
                  disabled={busyId === u.id}
                  onClick={() => setReviewing({ update: u, verdict: 'reject' })}
                >
                  Reject
                </button>
              </span>
            )}
          </div>
        ))}

      {pagination && <Pager pagination={pagination} onPage={setPage} />}

      {reviewing && (
        <ConfirmDialog
          message={
            <>
              {reviewing.verdict === 'approve'
                ? approveCopy(reviewing.update.kind)
                : 'Reject this update? The partner sees the decision (and your note) in their portal history.'}
              <label className="ad-field" style={{ marginTop: 10 }}>
                <span className="ad-filter-l">
                  {reviewing.update.kind === 'ask' && reviewing.verdict === 'approve'
                    ? 'Your answer · shown to the partner'
                    : 'Note · optional, shown to the partner'}
                </span>
                <input value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
              </label>
            </>
          }
          okLabel={reviewing.verdict === 'approve' ? 'Approve' : 'Reject'}
          danger={reviewing.verdict === 'reject'}
          onCancel={() => {
            setReviewing(null);
            setNote('');
          }}
          onConfirm={() => {
            const r = reviewing;
            setReviewing(null);
            void review(r.update, r.verdict);
          }}
        />
      )}
    </>
  );
}

function IssueForm({
  types,
  initialType,
  onClose,
  onIssued,
}: {
  types: Choice[];
  initialType?: string;
  onClose: () => void;
  onIssued: (issued: {
    id: string;
    name: string;
    token: string;
    pin: string;
    contactName: string;
  }) => void;
}) {
  const { galleryAdmin } = useApi();
  const [sourceType, setSourceType] = useState(initialType ?? 'gallery');
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError('A partner needs a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await galleryAdmin.issueLink({
        source_type: sourceType,
        name: name.trim(),
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
      });
      onIssued({
        id: out.link.id,
        name: out.link.name,
        token: out.token,
        pin: out.pin,
        contactName: out.link.contact_name ?? '',
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not issue the link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">New partner — issues their portal sign-in</div>
      <div className="ad-form-grid">
        <label className="ad-field">
          <span className="ad-filter-l">Type</span>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Contact name · optional</span>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Contact email · optional</span>
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Contact phone · optional</span>
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
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
          Issue portal sign-in
        </button>
      </div>
    </div>
  );
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
