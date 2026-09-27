/**
 * ExhibitionComposePage — `/admin/sources/:id/exhibitions/:eventId`, the
 * desk half of Exhibition Services ("Darz composes, the portal records" —
 * the old §78 split): the source's request on the left of the ledger, the
 * priced package under Darz's hand, and the documents that come out of it.
 *
 * One page, four moves, in the order the work happens:
 *   1 · read the request (gallery-owned facts + ticks, read-only here);
 *   2 · COMPOSE the package — the lines editor (seeded from the ticks with
 *       catalogue prices, never empty on a request), price/status/note per
 *       line, currency + discount; "Save" composes, "Approve" composes with
 *       `approve: true` (the gate `set_published` requires);
 *   3 · PUBLISH to the portal — the switch the partner's Exhibitions tab
 *       reads;
 *   4 · the DOCUMENTS already issued for this show — history and signing.
 *       Issuing itself moved to its own page (`/admin/issue/:eventId`) on the
 *       owner's instruction of 2026-09-19: one screen from choosing the show
 *       to the filed PDF, instead of a modal on top of this one.
 *
 * `compose` REPLACES all lines server-side, so the editor always writes the
 * whole package — there is no per-line PATCH to drift against.
 *
 * V1 Phase 5: the services menu is the editable Exhibition Services table
 * (`/gallery/admin/exhibition-catalogue/`, G-PORT-12b) — the same rows the
 * portal's menu reads — as the old desk composed from the gallery's own
 * `exhServices` list (`darz-studio.html:27844-27862`). It replaces the
 * name-join onto the Projects price list (`priceList.ts`, deleted). Each line
 * carries a `quantity` (G-PORT-16); its price stays the LINE amount.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type {
  DocumentAdmin,
  ExhibitionAdmin,
  ExhibitionCatalogItem,
  GalleryLinkAdmin,
  PortalCatalogueEntry,
} from '../../api/types';
import { MAX_PER_PAGE, walkPages } from '../../api/paging';
import { ConfirmDialog, DeskBanner, DeskPage } from './kit';
import {
  draftFromCatalogue,
  lineTotals,
  money,
  seedLines,
  toLineInputs,
  type LineDraft,
} from './exhibitionForm';
import { choices, choiceLabel, fmtDate } from '../portal/portalForm';
import './admin.css';

export function ExhibitionComposePage() {
  const { id: linkId = '', eventId = '' } = useParams();
  const { galleryAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const [ev, setEv] = useState<ExhibitionAdmin | null>(null);
  const [link, setLink] = useState<GalleryLinkAdmin | null>(null);
  const [docs, setDocs] = useState<DocumentAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // the editor state — seeded once per loaded event version
  const [lines, setLinesState] = useState<LineDraft[] | null>(null);
  /** Set the moment the admin touches a line. The seeder below re-runs when a
   * better price list or a fuller services menu arrives, and must never
   * overwrite what has been typed since. */
  const edited = useRef(false);
  const setLines = useCallback((next: LineDraft[]) => {
    edited.current = true;
    setLinesState(next);
  }, []);
  const [currency, setCurrency] = useState('');
  const [discount, setDiscount] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [unpublishAsk, setUnpublishAsk] = useState(false);

  const currencies = choices(options, 'currency');
  const lineStatuses = choices(options, 'gallery.exhibition_line_status');

  // A promise chain rather than `await` in an effect — the desk's own idiom,
  // and what keeps oxlint's set-state-in-effect rule satisfied.
  const load = useCallback(
    () =>
      Promise.all([
        galleryAdmin.exhibition(eventId),
        galleryAdmin.exhibitionDocuments(eventId),
      ]).then(
        ([event, docsPage]) => {
          setEv(event);
          setDocs(docsPage.results);
          setCurrency(event.currency || 'TMN');
          setDiscount(event.discount || '');
          setAdminNote(event.admin_note || '');
          galleryAdmin.link(event.link).then(setLink, () => undefined);
        },
        (err: unknown) =>
          setError(err instanceof Error ? err.message : 'Could not load the exhibition.'),
      ),
    [galleryAdmin, eventId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  // The services menu — the editable table the portal reads (G-PORT-12b).
  // Active rows only, in their position order: a deactivated service is
  // not offered for a new line (a composed line keeps its own copy).
  const [catRows, setCatRows] = useState<ExhibitionCatalogItem[] | null>(null);
  useEffect(() => {
    walkPages((page) =>
      galleryAdmin.exhibitionCatalogue({ page, per_page: MAX_PER_PAGE }),
    ).then(
      setCatRows,
      () => setCatRows([]), // the menu is a convenience, never a gate
    );
  }, [galleryAdmin]);

  const catalogue: PortalCatalogueEntry[] = useMemo(
    () =>
      (catRows ?? [])
        .filter((r) => r.is_active !== false)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((r) => ({
          key: r.key,
          title: r.title,
          description: r.description ?? '',
          default_price: r.default_price ?? null,
        })),
    [catRows],
  );

  // Seed the editor from the event and the menu. Both arrive on their own
  // schedule, so this re-seeds whenever a BETTER menu arrives (signature
  // below), not merely when one appears, and stops the moment the admin has
  // typed. Getting this wrong showed up live as a package that opened blank
  // when the menu won the race.
  const menuKey = useMemo(
    () => catalogue.map((c) => `${c.key}:${c.default_price ?? ''}`).join('|'),
    [catalogue],
  );
  const seedKey = ev ? `${ev.id}:${ev.version}:${menuKey}` : null;
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ev || seedKey === null || catRows === null) return; // the menu has not answered yet
    if (seededFor.current === seedKey || edited.current) return;
    seededFor.current = seedKey;
    setLinesState(seedLines(ev, catalogue));
  }, [ev, seedKey, catRows, catalogue]);

  // A different event — or the same one saved, which bumps its version — is a
  // clean slate: after `compose` the server's own lines ARE the truth, so the
  // guard must let them through.
  const evStamp = ev ? `${ev.id}:${ev.version}` : '';
  useEffect(() => {
    edited.current = false;
    seededFor.current = null;
  }, [evStamp]);

  const totals = useMemo(
    () =>
      lines ? lineTotals(lines, discount) : { sub: 0, disc: 0, tot: 0, count: 0, unpriced: 0 },
    [lines, discount],
  );

  const act = async (fn: () => Promise<void>, done?: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (done) setNotice(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not go through.');
    } finally {
      setBusy(false);
    }
  };

  const compose = (approve: boolean) =>
    act(
      async () => {
        if (!lines) return;
        const next = await galleryAdmin.composeExhibition(eventId, {
          lines: toLineInputs(lines),
          approve,
          currency,
          discount,
          admin_note: adminNote,
        });
        setEv(next);
      },
      approve ? 'Package approved — you can publish it to the portal.' : 'Package saved.',
    );

  const setPublished = (published: boolean) =>
    act(
      async () => {
        const next = await galleryAdmin.publishExhibition(eventId, published);
        setEv(next);
      },
      published ? 'Published — the partner sees the package now.' : 'Hidden from the portal.',
    );

  if (!ev || !lines) {
    return (
      <DeskPage title="Exhibition">
        {error ? <DeskBanner>{error}</DeskBanner> : <p className="dz-state">Loading…</p>}
      </DeskPage>
    );
  }

  const partner = link?.name ?? 'the partner';
  const dirty =
    JSON.stringify(toLineInputs(lines)) !==
      JSON.stringify(toLineInputs(seedLines(ev, catalogue))) ||
    currency !== (ev.currency || 'TMN') ||
    discount !== (ev.discount || '') ||
    adminNote !== (ev.admin_note || '');

  return (
    <DeskPage
      title={ev.title || 'Untitled show'}
      action={
        <span
          className={`ad-stpill is-${ev.request_status === 'approved' ? 'ok' : ev.request_status === 'rejected' ? 'gone' : ev.request_status === 'requested' ? 'res' : 'neut'}`}
        >
          {choiceLabel(options, 'gallery.exhibition_request_status', ev.request_status)}
        </span>
      }
      subtitle={
        <>
          <button
            type="button"
            className="ad-ghostbtn"
            onClick={() => navigate(`/admin/sources/${linkId || ev.link}`)}
          >
            ← {partner}
          </button>{' '}
          ·{' '}
          {[ev.event_date, ev.venue, ev.artists].filter(Boolean).join(' · ') ||
            'no details yet'}
          {ev.gallery_updated_at
            ? ` · gallery last edited ${fmtDate(ev.gallery_updated_at)}`
            : ''}
        </>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}
      {notice && (
        <div className="ad-remind">
          <span>{notice}</span>
        </div>
      )}

      {/* ---- 1 · the request, as the source wrote it ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">The request</h2>
          <span className="ad-dsec-n">gallery-owned — edited from the portal, read here</span>
        </div>
        <div className="ad-card ad-logins">
          {ev.gallery_note && <p className="ad-exhnote">“{ev.gallery_note}”</p>}
          <p className="ad-exhticks">
            {ev.gallery_selected.length
              ? `Ticked: ${ev.gallery_selected
                  .map((k) => choiceLabel(options, 'gallery.exhibition_service', k))
                  .join(' · ')}`
              : 'No services ticked yet.'}
          </p>
        </div>
      </section>

      {/* ---- 2 · the priced package ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">The package</h2>
          <span className="ad-dsec-n">Darz prices; a declined line never counts</span>
        </div>

        <p className="ad-pricelist-note">
          Services and default prices come from the Exhibition Services menu — the same list
          the gallery ticks from in its portal.{' '}
          <button
            type="button"
            className="ad-ghostbtn"
            onClick={() => navigate('/admin/exhibition-catalogue')}
          >
            Edit the menu →
          </button>
        </p>

        <div className="ad-card">
          {lines.map((l, i) => (
            <div className="ad-exhline" key={`${l.service_key}-${i}`}>
              <div className="ad-exhline-main">
                <input
                  aria-label="Service title"
                  value={l.title}
                  onChange={(e) => setLines(patchLine(lines, i, { title: e.target.value }))}
                />
                <textarea
                  aria-label="Service description"
                  rows={1}
                  placeholder="One line on what this covers…"
                  value={l.description}
                  onChange={(e) =>
                    setLines(patchLine(lines, i, { description: e.target.value }))
                  }
                />
              </div>
              <div className="ad-exhline-side">
                <input
                  className="ad-exhline-qty"
                  aria-label="Quantity"
                  inputMode="numeric"
                  title="How many — the price is the line's amount"
                  value={l.quantity}
                  onChange={(e) => setLines(patchLine(lines, i, { quantity: e.target.value }))}
                />
                <input
                  className="ad-exhline-price"
                  aria-label="Price"
                  inputMode="decimal"
                  placeholder="Price"
                  value={l.price}
                  onChange={(e) => setLines(patchLine(lines, i, { price: e.target.value }))}
                />
                <select
                  aria-label="Line currency"
                  value={l.currency}
                  onChange={(e) => setLines(patchLine(lines, i, { currency: e.target.value }))}
                >
                  {currencies.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.value}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Line status"
                  value={l.status}
                  onChange={(e) =>
                    setLines(
                      patchLine(lines, i, { status: e.target.value as LineDraft['status'] }),
                    )
                  }
                >
                  {lineStatuses.map((sOpt) => (
                    <option key={sOpt.value} value={sOpt.value}>
                      {sOpt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ad-rowbtn is-danger"
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {lines.length === 0 && (
            <p className="dz-state">No lines yet — add from the menu below.</p>
          )}

          <div className="ad-exhadd">
            {catalogue
              .filter((c) => !lines.some((l) => l.service_key === c.key))
              .map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="ad-rowbtn"
                  onClick={() => setLines([...lines, draftFromCatalogue(c, currency)])}
                >
                  ＋ {c.title}
                </button>
              ))}
            <button
              type="button"
              className="ad-rowbtn"
              onClick={() =>
                setLines([
                  ...lines,
                  {
                    service_key: '',
                    title: 'Custom service',
                    description: '',
                    quantity: '1',
                    price: '',
                    currency,
                    status: 'proposed',
                    admin_note: '',
                  },
                ])
              }
            >
              ＋ Custom line
            </button>
          </div>
        </div>

        <div className="ad-card ad-exhfoot">
          <label className="ad-filter">
            <span className="ad-filter-l">Currency</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ad-filter">
            <span className="ad-filter-l">Discount</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </label>
          <label className="ad-filter ad-exhnotein">
            <span className="ad-filter-l">Internal note</span>
            <input
              placeholder="Only the desk sees this"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          </label>
          <span className="ad-exhtotal">
            {totals.count} line{totals.count === 1 ? '' : 's'}
            {totals.unpriced ? ` · ${totals.unpriced} unpriced` : ''}
            {totals.disc ? ` · −${money(currency, totals.disc)}` : ''} ·{' '}
            <b>{money(currency, totals.tot)}</b>
          </span>
        </div>

        <div className="ad-rowacts ad-exhacts">
          <button
            type="button"
            className="ad-rowbtn"
            disabled={busy}
            onClick={() => void compose(false)}
          >
            Save package
          </button>
          <button
            type="button"
            className="ad-action"
            disabled={busy}
            onClick={() => void compose(true)}
            title="Compose and mark the request approved — the publish gate"
          >
            {ev.request_status === 'approved' ? 'Save & keep approved' : 'Approve package'}
          </button>
          {dirty && <span className="ad-cellsub">unsaved changes</span>}
        </div>
      </section>

      {/* ---- 3 · the portal switch ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">On the portal</h2>
          <span className="ad-dsec-n">
            hide-only, never deletes — the partner's Exhibitions tab
          </span>
        </div>
        <div className="ad-card ad-reach">
          <label className="ad-actck">
            <input
              type="checkbox"
              checked={ev.published}
              disabled={busy || (!ev.published && ev.request_status !== 'approved')}
              onChange={(e) => {
                if (!e.target.checked) setUnpublishAsk(true);
                else void setPublished(true);
              }}
            />
            {ev.published
              ? 'Published — the partner sees this show, its package and its documents.'
              : ev.request_status === 'approved'
                ? 'Publish to the portal'
                : 'Publish to the portal (approve the package first)'}
          </label>
        </div>
      </section>

      {/* ---- 4 · the documents ---- */}
      <DocumentsSection
        ev={ev}
        docs={docs}
        busy={busy}
        onIssue={() => navigate(`/admin/issue/${ev.id}`)}
        onChanged={() => void load()}
        act={act}
        galleryAdmin={galleryAdmin}
      />

      {unpublishAsk && (
        <ConfirmDialog
          message="Hide this show from the portal? The partner stops seeing the package and its documents until you publish again — nothing is deleted."
          okLabel="Hide it"
          onConfirm={() => {
            setUnpublishAsk(false);
            void setPublished(false);
          }}
          onCancel={() => setUnpublishAsk(false)}
        />
      )}
    </DeskPage>
  );
}

function patchLine(lines: LineDraft[], i: number, patch: Partial<LineDraft>): LineDraft[] {
  return lines.map((l, j) => (j === i ? { ...l, ...patch } : l));
}

/* ── documents ──────────────────────────────────────────────────────────── */

interface ActFn {
  (fn: () => Promise<void>, done?: string): Promise<void>;
}

function DocumentsSection({
  ev,
  docs,
  busy,
  onIssue,
  onChanged,
  act,
  galleryAdmin,
}: {
  ev: ExhibitionAdmin;
  docs: DocumentAdmin[] | null;
  busy: boolean;
  onIssue: () => void;
  onChanged: () => void;
  act: ActFn;
  galleryAdmin: ReturnType<typeof useApi>['galleryAdmin'];
}) {
  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Documents</h2>
        <span className="ad-dsec-n">
          created, rendered and issued in one step — the portal sees a confirmed document once
          the show is published
        </span>
      </div>

      {docs === null && <p className="dz-state">Loading…</p>}
      {docs && docs.length === 0 && (
        <p className="dz-state">
          No documents yet — issue the proposal once the package stands.
        </p>
      )}
      {docs &&
        docs.map((d) => {
          const f = (d.fields ?? {}) as Record<string, unknown>;
          const stamped = !!(f.portal_accepted_at || f.portal_signed_at);
          const stampedBy = String(f.portal_accepted_by ?? f.portal_signed_by ?? '');
          return (
            <div className="ad-card ad-updrow" key={d.id}>
              <div className="ad-updmain">
                <span className="ad-cellmain">
                  {d.title}{' '}
                  {f.reference ? (
                    <span className="ad-cellsub">· {String(f.reference)}</span>
                  ) : null}
                </span>
                <span className="ad-cellsub">
                  {d.status}
                  {d.signed_at ? ' · signed by Darz' : ''}
                  {stamped
                    ? ` · ${d.kind === 'exhibition_proposal' ? 'accepted' : 'signed'} by the partner${stampedBy ? ` (${stampedBy})` : ''}`
                    : ''}
                </span>
              </div>
              <span className="ad-rowacts">
                {d.pdf_url && (
                  <a
                    className="ad-rowbtn"
                    href={d.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open PDF
                  </a>
                )}
                {d.status === 'confirmed' &&
                  d.kind === 'exhibition_invoice' &&
                  !d.signed_at && (
                    <button
                      type="button"
                      className="ad-rowbtn"
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await galleryAdmin.signExhibitionDocument(ev.id, d.id);
                          onChanged();
                        }, 'Signed for Darz.')
                      }
                    >
                      Sign for Darz
                    </button>
                  )}
              </span>
            </div>
          );
        })}

      {/* One way to issue, not two. Composing a package and issuing a document
          used to be this same screen with a modal per document kind on top of
          it; the owner asked for one page instead (2026-09-19), so issuing
          lives at `/admin/issue/:eventId` and this section keeps the history.
          That page saves the lines too, so nothing is lost by leaving here. */}
      <div className="ad-rowacts ad-exhacts">
        <button type="button" className="ad-action" disabled={busy} onClick={onIssue}>
          Issue a proposal or invoice →
        </button>
      </div>
    </section>
  );
}
