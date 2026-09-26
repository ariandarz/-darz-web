/**
 * AuctionAdminDetailPage — `/admin/auctions/:id`: one sale's cover, its
 * editable record and terms, its Phase-35 privacy, and its lots.
 *
 * **V1 Phase 3 — the old Manage-auction modal** (`editAuc`/`saveAuc`,
 * `darz-studio.html:32027-32172`) is ported onto this page, section by
 * section and in the modal's own order:
 *  - **Cover & poster** (`:32060-32068`): "↑ Upload poster" · "Remove
 *    uploaded poster" · the preview labelled "Uploaded poster — used as the
 *    cover" — over `POST/DELETE …/cover-image/` (multipart `file`). Cut, and
 *    said here: the cover-ARTWORK search (no cover-artwork field in this
 *    backend), the poster text over the cover (headline / subtext / colour /
 *    position, `:32069-32077`), and the Document Builder poster designer
 *    (`:32078-32087`, D18). "or PDF" is dropped from the button: the cover is
 *    drawn as an image on the collector card, so a PDF would render as
 *    nothing.
 *  - **Auction details** (`:32089-32099`): Title · Description · Start · End
 *    (+ Currency, which the old modal kept under terms, `:32109`) with the
 *    old placeholders. The old Type (timed/live) and Status selects are not
 *    fields here — status moves through its own actions, and the model has no
 *    type.
 *  - **Terms & financial settings** (`:32100-32108`): `AuctionTermsFields`.
 *  - **Save auction** (`:32127`). The old toast "Auction saved → live in the
 *    App" is not ported — a draft saved here is not live anywhere — so the
 *    button's own "✓ Saved" flash (`DeskSave`) is the confirmation.
 *
 * The API's own rules, stated where they bite:
 *  - the PATCH (G-AUC-1) is **draft/scheduled only**; past that the form is
 *    read-only with the server's own sentence as the reason. A refusal still
 *    arrives as a 400 whose `code` is `INTERNAL_ERROR` (C-11) — the desk shows
 *    its `message`, never the code. The lock is mandatory (C-6); a stale save
 *    is the kit's `ConflictBanner`;
 *  - the server does not check `starts_at < ends_at` (C-18), so the form does;
 *  - a **scheduled** lot is editable (G-AUC-2) with the same lock/banner
 *    pattern — the old modal's per-lot Est. low / Est. high / Opening bid /
 *    Reserve row (`:32019-32024`) — then moves through **Go live**
 *    (scheduled→live; the artwork transitions to Reserved server-side) and
 *    **Close**. The engine sells only with bids AND the reserve met,
 *    otherwise the lot passes; before the scheduled end a close must be
 *    *forced* ("Lot has not reached its end time yet."), so the desk offers
 *    **Close early** until then;
 *  - the reserve is confidential (the model: "never exposed to collectors;
 *    only reserve_met is public") — this desk shows it, because this desk is
 *    the one place that may;
 *  - **Archive / ↩ Restore** (G-AUC-4) sit beside the back link, with the old
 *    card's titles (`:31813-31814`).
 *
 * Invite-only (Phase 35, the old Club's "Make an auction private…"): the
 * switch plus the invited-collector picker; an uninvited collector never
 * sees the sale and cannot register a paddle — the model's own rule, on the
 * card copy.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import { asArray } from '../../api/shapes';
import type { OptionsMap } from '../../api/services';
import type { Auction, Choice, LotAdmin } from '../../api/types';
import { AuctionPill } from './AuctionsAdminPage';
import { AuctionTermsFields } from './AuctionTermsFields';
import {
  amountOrNull,
  auctionDraft,
  auctionDraftError,
  auctionEditable,
  auctionPatch,
  fromLocalInput,
  lotDraft,
  lotDraftError,
  lotPatch,
  toLocalInput,
  type AuctionDraft,
  type LotDraft,
} from './auctionForm';
import {
  ConfirmDialog,
  ConflictBanner,
  DeskBanner,
  DeskPage,
  DeskSave,
  DeskToast,
  Picker,
  isConflict,
  useDeskToast,
  type Column,
  type PickItem,
  DataTable,
} from './kit';
import './admin.css';

/** The server's own refusal (`AuctionService.update`), shown as the reason. */
const NOT_EDITABLE = 'Only a draft or scheduled auction can be edited.';

export function AuctionAdminDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { auctionsAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();
  const { say, message } = useDeskToast();

  const statuses = choices(options, 'auctions.auction_status');
  const currencies = choices(options, 'currency');
  const [auction, setAuction] = useState<Auction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Bumped on every read from the server, so the edit form re-seeds from it
   * (a conflict's Reload) — and NOT on the form's own save, the cover or the
   * archive, which would throw away the "✓ Saved" flash or unsaved edits. */
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(() => {
    if (!id) return;
    auctionsAdmin.auction(id).then(
      (a) => {
        setAuction(a);
        setFormKey((k) => k + 1);
      },
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the auction.'),
    );
  }, [auctionsAdmin, id, setAuction, setFormKey]);
  useEffect(load, [load]);

  const setArchive = async (restore: boolean) => {
    if (!auction) return;
    setBusy(true);
    setError(null);
    try {
      setAuction(await auctionsAdmin.archiveAuction(auction.id, restore));
      // `:39831` / `:39826`, cut to what is true here (see AuctionsAdminPage)
      say(restore ? 'Restored to Live & upcoming' : 'Archived — moved to the archived list');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not archive the auction.');
    } finally {
      setBusy(false);
    }
  };

  if (!auction) {
    return (
      <DeskPage wide title="Auction">
        {error ? <DeskBanner>{error}</DeskBanner> : <p className="dz-state">Loading…</p>}
      </DeskPage>
    );
  }

  return (
    <DeskPage
      wide
      title={auction.title}
      action={<AuctionPill status={auction.status} label={label(statuses, auction.status)} />}
      subtitle={
        <span className="ad-rowacts">
          <button
            type="button"
            className="ad-ghostbtn"
            onClick={() => navigate('/admin/auctions')}
          >
            ← All auctions
          </button>
          {auction.archived ? (
            <button
              type="button"
              className="ad-ghostbtn"
              disabled={busy}
              title="Restore this auction to the Live & upcoming list"
              onClick={() => void setArchive(true)}
            >
              ↩ Restore
            </button>
          ) : (
            <button
              type="button"
              className="ad-ghostbtn"
              disabled={busy}
              title="Archive — hide from the Live list, keep for your record (restorable)"
              onClick={() => setArchiving(true)}
            >
              Archive
            </button>
          )}
          {auction.archived && <span className="ad-chip">archived</span>}
        </span>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}

      <CoverCard auction={auction} onChange={setAuction} />
      <AuctionEditCard
        key={formKey}
        auction={auction}
        currencies={currencies}
        onSaved={setAuction}
        onReload={load}
      />
      <InviteCard auctionId={auction.id} />
      <LotsSection auction={auction} />

      {archiving && (
        /* `:39823`'s confirm, cut as on the Live Auctions list */
        <ConfirmDialog
          message={`Archive “${auction.title || 'this auction'}”? It moves to the archived list. You can restore it anytime.`}
          okLabel="Archive"
          onCancel={() => setArchiving(false)}
          onConfirm={() => {
            setArchiving(false);
            void setArchive(false);
          }}
        />
      )}
      <DeskToast message={message} />
    </DeskPage>
  );
}

/** Cover & poster (`:32060-32066`) — upload / replace / remove the poster. */
function CoverCard({
  auction,
  onChange,
}: {
  auction: Auction;
  onChange: (a: Auction) => void;
}) {
  const { auctionsAdmin } = useApi();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<Auction>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update the poster.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Cover &amp; poster</h2>
        {/* `:32063`, first clause — the artwork-cover search has no backend */}
        <span className="ad-dsec-n">Upload your own designed poster.</span>
      </div>
      {error && <DeskBanner>{error}</DeskBanner>}
      <div className="ad-card ad-form">
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          aria-label="Poster file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void run(() => auctionsAdmin.uploadCover(auction.id, file));
          }}
        />
        <span className="ad-rowacts">
          <button
            type="button"
            className="ad-ghostbtn"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            ↑&nbsp; Upload poster
          </button>
          {auction.cover_image_url && (
            <button
              type="button"
              className="ad-ghostbtn"
              disabled={busy}
              onClick={() => void run(() => auctionsAdmin.removeCover(auction.id))}
            >
              Remove uploaded poster
            </button>
          )}
        </span>
        {auction.cover_image_url && (
          <figure className="ad-aucposter">
            <figcaption className="ad-filter-l">
              Uploaded poster — used as the cover
            </figcaption>
            <img src={auction.cover_image_url} alt="" />
          </figure>
        )}
      </div>
    </section>
  );
}

/** Auction details + Terms (`:32089-32108`), locked PATCH (G-AUC-1). */
function AuctionEditCard({
  auction,
  currencies,
  onSaved,
  onReload,
}: {
  auction: Auction;
  currencies: Choice[];
  onSaved: (a: Auction) => void;
  onReload: () => void;
}) {
  const { auctionsAdmin } = useApi();
  const [draft, setDraft] = useState<AuctionDraft>(() => auctionDraft(auction));
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const editable = auctionEditable(auction.status);
  const locked = !editable || busy;
  const set = (patch: Partial<AuctionDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    const bad = auctionDraftError(draft);
    if (bad) {
      setError(bad);
      throw new Error(bad); // no "✓ Saved" flash
    }
    setBusy(true);
    setError(null);
    setConflict(false);
    try {
      onSaved(await auctionsAdmin.updateAuction(auction.id, auctionPatch(auction, draft)));
    } catch (err: unknown) {
      if (isConflict(err)) setConflict(true);
      else setError(err instanceof Error ? err.message : 'Could not save the auction.');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Auction details</h2>
        <span className="ad-dsec-n">
          {editable
            ? `${auction.lots_count ?? 0} lot${auction.lots_count === 1 ? '' : 's'}`
            : NOT_EDITABLE}
        </span>
      </div>
      {conflict && <ConflictBanner noun="auction" onReload={onReload} />}
      <div className="ad-card ad-form">
        <div className="ad-form-grid">
          <label className="ad-field ad-field--wide">
            <span className="ad-filter-l">Title</span>
            <input
              value={draft.title}
              disabled={locked}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g. Contemporary Discoveries"
            />
          </label>
          <label className="ad-field ad-field--wide">
            <span className="ad-filter-l">Description</span>
            <textarea
              rows={3}
              value={draft.description}
              disabled={locked}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="A short introduction collectors see at the top of the event…"
            />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Start</span>
            <input
              type="datetime-local"
              value={draft.startsAt}
              disabled={locked}
              onChange={(e) => set({ startsAt: e.target.value })}
            />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">End</span>
            <input
              type="datetime-local"
              value={draft.endsAt}
              disabled={locked}
              onChange={(e) => set({ endsAt: e.target.value })}
            />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Currency</span>
            <select
              value={draft.currency}
              disabled={locked}
              onChange={(e) => set({ currency: e.target.value })}
            >
              {!currencies.some((c) => c.value === draft.currency) && (
                <option value={draft.currency}>{draft.currency}</option>
              )}
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ad-form-h ad-form-h--sub">Terms &amp; financial settings</div>
        <div className="ad-form-grid">
          <AuctionTermsFields
            terms={draft.terms}
            noTermsGate={draft.noTermsGate}
            onTerms={(terms) => set({ terms })}
            onNoTermsGate={(noTermsGate) => set({ noTermsGate })}
            disabled={locked}
          />
        </div>
        {error && (
          <p className="dz-state err" role="alert">
            {error}
          </p>
        )}
        {editable && (
          <div className="ad-form-a">
            <DeskSave className="ad-action" busy={busy} onClick={save}>
              Save auction
            </DeskSave>
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="ad-recrow">
      <span className="ad-reck">{k}</span>
      <span className="ad-recv">{v}</span>
    </div>
  );
}

/** Phase 35 — the Club's "Make an auction private…". */
function InviteCard({ auctionId }: { auctionId: string }) {
  const { auctionsAdmin, adminAccounts } = useApi();
  const [inviteOnly, setInviteOnly] = useState(false);
  const [invited, setInvited] = useState<PickItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    auctionsAdmin.inviteList(auctionId).then(
      (data) => {
        if (!alive) return;
        setInviteOnly(data.invite_only);
        setInvited(
          asArray<{ id: string; display_name: string }>(data.invited_collectors).map((c) => ({
            id: c.id,
            label: c.display_name,
          })),
        );
        setLoaded(true);
      },
      (err: unknown) =>
        alive &&
        setError(err instanceof Error ? err.message : 'Could not load the invite list.'),
    );
    return () => {
      alive = false;
    };
  }, [auctionsAdmin, auctionId]);

  const save = async (nextOnly: boolean, nextInvited: PickItem[]) => {
    setBusy(true);
    setError(null);
    try {
      const data = await auctionsAdmin.setInviteOnly(
        auctionId,
        nextOnly,
        nextInvited.map((p) => p.id),
      );
      setInviteOnly(data.invite_only);
      setInvited(
        asArray<{ id: string; display_name: string }>(data.invited_collectors).map((c) => ({
          id: c.id,
          label: c.display_name,
        })),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the invite list.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Privacy</h2>
        <span className="ad-dsec-n">
          private means an uninvited collector never sees this sale and cannot register a
          paddle
        </span>
      </div>
      {error && <DeskBanner>{error}</DeskBanner>}
      {!loaded ? (
        <p className="dz-state">Loading…</p>
      ) : (
        <div className="ad-card ad-reach">
          <label className="ad-actck">
            <input
              type="checkbox"
              checked={inviteOnly}
              disabled={busy}
              onChange={(e) => void save(e.target.checked, invited)}
            />
            Make this auction private — invited collectors only
          </label>
          {inviteOnly && (
            <Picker
              label="Invited collectors"
              placeholder="Search collectors — name, email, phone…"
              picked={invited}
              onChange={(items) => void save(true, items)}
              search={async (q) => {
                const page = await adminAccounts.collectors({ search: q, per_page: 8 });
                return page.results.map((c) => ({ id: c.id, label: c.display_name }));
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}

function LotsSection({ auction }: { auction: Auction }) {
  const { auctionsAdmin, catalogAdmin } = useApi();
  // V1 Phase 10: the status pill reads the served `auctions.lot_status`
  // label (raw value until /options/ arrives), like the auction pill above.
  const lotStatuses = choices(useOptions(), 'auctions.lot_status');
  const [lots, setLots] = useState<LotAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<LotAdmin | null>(null);
  const [closing, setClosing] = useState<{ lot: LotAdmin; force: boolean } | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const load = useCallback(() => {
    auctionsAdmin.lots(auction.id, { per_page: 100 }).then(
      (page) => setLots(page.results),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the lots.'),
    );
  }, [auctionsAdmin, auction.id]);
  useEffect(load, [load]);

  // resolve artwork titles (the admin lot row carries a bare uuid)
  useEffect(() => {
    if (!lots) return;
    let alive = true;
    const missing = [...new Set(lots.map((l) => l.artwork))].filter((aid) => !names.has(aid));
    if (missing.length === 0) return;
    void Promise.allSettled(
      missing.map(async (aid) => {
        const a = await catalogAdmin.artwork(aid);
        return [
          aid,
          a.artist_name_raw ? `${a.artist_name_raw} — ${a.title}` : a.title,
        ] as const;
      }),
    ).then((settled) => {
      if (!alive) return;
      setNames((prev) => {
        const next = new Map(prev);
        for (const r of settled)
          if (r.status === 'fulfilled') next.set(r.value[0], r.value[1]);
        return next;
      });
    });
    return () => {
      alive = false;
    };
  }, [lots, catalogAdmin, names]);

  const act = async (lotId: string, fn: () => Promise<LotAdmin>) => {
    setBusyId(lotId);
    setError(null);
    try {
      await fn();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That did not go through.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Re-read ONE lot (`GET /auctions/admin/lots/{id}/`) and patch it in place.
   *
   * A live lot's bid count and current price move while an admin watches, and
   * until now the only way to see that was `load()` — every lot, plus the
   * artwork-name resolution that follows it, to learn one number. This is the
   * row asking about itself.
   *
   * It is deliberately NOT a detail screen: the endpoint answers the same
   * `LotAdminSerializer` the list does (`apps/auctions/views.py::admin_lot_detail`),
   * so there is nothing on a lot that this table does not already show, and a
   * page built to display it would be a screen invented to justify a route.
   */
  const refreshLot = async (lotId: string) => {
    setBusyId(lotId);
    setError(null);
    try {
      const fresh = await auctionsAdmin.lot(lotId);
      setLots((prev) => prev?.map((l) => (l.id === fresh.id ? fresh : l)) ?? prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not re-read the lot.');
    } finally {
      setBusyId(null);
    }
  };

  const columns: ReadonlyArray<Column<LotAdmin>> = [
    { key: 'n', header: 'Lot', cell: (l) => <b>{l.lot_number}</b> },
    {
      key: 'work',
      header: 'Artwork',
      cell: (l) => names.get(l.artwork) ?? '…',
    },
    {
      key: 'money',
      header: 'Opening · Reserve',
      cell: (l) => (
        <>
          <span className="ad-cellmain">
            {Number(l.opening_amount).toLocaleString('en-US')} {l.currency}
          </span>
          <span className="ad-cellsub">
            {/* confidential — this desk is the one place that may show it */}
            reserve {l.reserve_amount ? Number(l.reserve_amount).toLocaleString('en-US') : '—'}
            {l.reserve_met ? ' · met' : ''}
          </span>
        </>
      ),
    },
    {
      key: 'live',
      header: 'Bidding',
      cell: (l) =>
        l.bid_count ? (
          <>
            <span className="ad-cellmain">
              {Number(l.current_amount).toLocaleString('en-US')} {l.currency}
            </span>
            <span className="ad-cellsub">
              {l.bid_count} bid{l.bid_count === 1 ? '' : 's'}
            </span>
          </>
        ) : (
          <span className="ad-cellsub">no bids</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (l) => (
        <span
          className={`ad-stpill is-${l.status === 'live' ? 'ok' : l.status === 'sold' ? 'res' : l.status === 'scheduled' ? 'neut' : 'gone'}`}
        >
          {label(lotStatuses, l.status)}
        </span>
      ),
    },
    {
      key: 'acts',
      header: '',
      cell: (l) => (
        <span className="ad-rowacts">
          {l.status === 'scheduled' && (
            <button
              type="button"
              className="ad-rowbtn"
              disabled={busyId === l.id}
              onClick={() => {
                setAdding(false);
                setEditing(l);
              }}
            >
              Edit
            </button>
          )}
          {l.status === 'scheduled' && (
            <button
              type="button"
              className="ad-rowbtn"
              disabled={busyId === l.id}
              onClick={() => void act(l.id, () => auctionsAdmin.goLive(l.id))}
            >
              Go live
            </button>
          )}
          {l.status === 'live' && (
            <button
              type="button"
              className="ad-rowbtn"
              disabled={busyId === l.id}
              title="Re-read this lot — a live lot's bids move while you watch"
              onClick={() => void refreshLot(l.id)}
            >
              Refresh
            </button>
          )}
          {l.status === 'live' &&
            (new Date(l.ends_at).getTime() > Date.now() ? (
              <button
                type="button"
                className="ad-rowbtn is-danger"
                disabled={busyId === l.id}
                title="Close before the scheduled end"
                onClick={() => setClosing({ lot: l, force: true })}
              >
                Close early
              </button>
            ) : (
              <button
                type="button"
                className="ad-rowbtn"
                disabled={busyId === l.id}
                onClick={() => setClosing({ lot: l, force: false })}
              >
                Close
              </button>
            ))}
        </span>
      ),
    },
  ];

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Lots</h2>
        <span className="ad-dsec-n">
          a scheduled lot is editable; Go live reserves the artwork; a close before the
          scheduled end must be forced — the engine still only sells with bids and the reserve
          met
        </span>
      </div>
      {error && <DeskBanner>{error}</DeskBanner>}

      <p>
        <button
          type="button"
          className="ad-ghostbtn"
          onClick={() => {
            setEditing(null);
            setAdding(true);
          }}
        >
          ＋ Add a lot
        </button>
      </p>

      {adding && (
        <LotForm
          auction={auction}
          nextNumber={(lots?.length ?? 0) + 1}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
      {editing && (
        <LotForm
          key={`${editing.id}:${editing.version}`}
          auction={auction}
          lot={editing}
          workLabel={names.get(editing.artwork)}
          onClose={() => setEditing(null)}
          onReload={async () => {
            const fresh = await auctionsAdmin.lot(editing.id);
            setLots((prev) => prev?.map((l) => (l.id === fresh.id ? fresh : l)) ?? prev);
            setEditing(fresh);
          }}
          onSaved={(fresh) => {
            setEditing(null);
            if (fresh)
              setLots((prev) => prev?.map((l) => (l.id === fresh.id ? fresh : l)) ?? prev);
          }}
        />
      )}

      {!lots && !error && <p className="dz-state">Loading…</p>}
      {lots &&
        (lots.length ? (
          <DataTable label="Lots" rows={lots} columns={columns} rowKey={(l) => l.id} />
        ) : (
          <p className="dz-state">No lots yet — add the first.</p>
        ))}

      {closing && (
        <ConfirmDialog
          message={
            closing.force
              ? `Close lot ${closing.lot.lot_number} EARLY — before its scheduled end? The engine sells to the leading bidder only if the reserve is met; otherwise the lot passes and the artwork returns to Available.`
              : `Close lot ${closing.lot.lot_number}? The engine sells to the leading bidder if the reserve is met — otherwise the lot passes and the artwork returns to Available.`
          }
          okLabel={closing.force ? 'Close early' : 'Close'}
          danger={closing.force}
          onCancel={() => setClosing(null)}
          onConfirm={() => {
            const c = closing;
            setClosing(null);
            void act(c.lot.id, () => auctionsAdmin.closeLot(c.lot.id, c.force));
          }}
        />
      )}
    </section>
  );
}

/**
 * Add a lot, or edit a scheduled one (G-AUC-2). One form for both: the old
 * modal edited every lot in the same row it was added with (`aucLotRowHTML`,
 * `:32001-32025`). The artwork is fixed once a lot exists (the PATCH does not
 * take it), so the edit form names it instead of offering the picker.
 * "Anti-snipe seconds" is the old modal's (`:32112`, placeholder "120 · 0 =
 * off"), per lot here because `soft_close_sec` is a lot field.
 */
function LotForm({
  auction,
  lot,
  workLabel,
  nextNumber = 1,
  onClose,
  onSaved,
  onReload,
}: {
  auction: Auction;
  lot?: LotAdmin;
  workLabel?: string;
  nextNumber?: number;
  onClose: () => void;
  onSaved: (lot: LotAdmin | null) => void;
  onReload?: () => Promise<void>;
}) {
  const { auctionsAdmin, catalogAdmin } = useApi();
  const [work, setWork] = useState<PickItem[]>([]);
  const [d, setD] = useState<LotDraft>(() =>
    lot
      ? lotDraft(lot)
      : {
          lotNumber: String(nextNumber),
          opening: '',
          reserve: '',
          low: '',
          high: '',
          premium: '0',
          startsAt: toLocalInput(auction.starts_at),
          endsAt: toLocalInput(auction.ends_at),
          softCloseSec: '',
        },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const set = (patch: Partial<LotDraft>) => setD((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    if (busy) return;
    if (!lot && work.length === 0) {
      setError('An artwork, a lot number and an opening amount are required.');
      return;
    }
    const bad = lotDraftError(d);
    if (bad) {
      setError(bad);
      return;
    }
    setBusy(true);
    setError(null);
    setConflict(false);
    try {
      if (lot) {
        onSaved(await auctionsAdmin.updateLot(lot.id, lotPatch(lot, d)));
      } else {
        await auctionsAdmin.createLot({
          auction: auction.id,
          artwork: work[0].id,
          lot_number: Number(d.lotNumber),
          opening_amount: amountOrNull(d.opening) ?? d.opening.trim(),
          reserve_amount: amountOrNull(d.reserve),
          low_estimate: amountOrNull(d.low),
          high_estimate: amountOrNull(d.high),
          premium_pct: amountOrNull(d.premium) ?? '0',
          currency: auction.currency,
          starts_at: fromLocalInput(d.startsAt),
          ends_at: fromLocalInput(d.endsAt),
          ...(d.softCloseSec.trim() ? { soft_close_sec: Number(d.softCloseSec) } : {}),
        });
        onSaved(null);
      }
    } catch (err: unknown) {
      if (isConflict(err)) setConflict(true);
      else
        setError(
          err instanceof Error
            ? err.message
            : lot
              ? 'Could not save the lot.'
              : 'Could not create the lot.',
        );
    } finally {
      setBusy(false);
    }
  };

  const field = (
    k: keyof LotDraft,
    labelText: string,
    extra: { type?: string; placeholder?: string; inputMode?: 'numeric' | 'decimal' } = {},
  ) => (
    <label className="ad-field">
      <span className="ad-filter-l">{labelText}</span>
      <input
        type={extra.type}
        value={d[k]}
        onChange={(e) => set({ [k]: e.target.value } as Partial<LotDraft>)}
        inputMode={extra.inputMode}
        placeholder={extra.placeholder}
      />
    </label>
  );

  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">
        {lot ? `Edit lot ${lot.lot_number}` : 'Add a lot'} · {auction.currency}
      </div>
      {conflict && onReload && <ConflictBanner noun="lot" onReload={() => void onReload()} />}
      {lot ? (
        <Row k="Artwork" v={workLabel ?? '…'} />
      ) : (
        <Picker
          label="Artwork"
          placeholder="Search the catalogue — artist, title, medium…"
          picked={work}
          onChange={setWork}
          single
          search={async (q) => {
            const page = await catalogAdmin.artworks({ search: q, per_page: 8 });
            return page.results.map((a) => ({
              id: a.id,
              label: a.artist_name_raw ? `${a.artist_name_raw} — ${a.title}` : a.title,
            }));
          }}
        />
      )}
      <div className="ad-form-grid">
        {field('lotNumber', 'Lot number', { inputMode: 'numeric' })}
        {field('opening', 'Opening amount', { inputMode: 'decimal' })}
        {field('reserve', 'Reserve · confidential', {
          inputMode: 'decimal',
          placeholder: 'never shown to collectors',
        })}
        {field('premium', "Buyer's premium %", { inputMode: 'decimal' })}
        {field('low', 'Low estimate', { inputMode: 'decimal' })}
        {field('high', 'High estimate', { inputMode: 'decimal' })}
        {field('startsAt', 'Bidding starts', { type: 'datetime-local' })}
        {field('endsAt', 'Bidding ends', { type: 'datetime-local' })}
        {field('softCloseSec', 'Anti-snipe seconds', {
          inputMode: 'numeric',
          placeholder: '120 · 0 = off',
        })}
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
          {lot ? 'Save lot' : 'Add the lot'}
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
