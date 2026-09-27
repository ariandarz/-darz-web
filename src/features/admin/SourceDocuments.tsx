/**
 * SourceDocuments — the two halves of the paper trail a partner page was
 * missing, found by walking the chain live on 2026-09-19.
 *
 * `PricelistsSection` — the gallery's own pricelists, as the old desk's
 * pricelist card (`_galPLCard`, `darz-studio.html:27266-27281`): open the
 * file, and move its status. Bound to backend P3a/P3b + G-PORT-14 (V1
 * Phase 5): an upload opens through its presigned `file_url`, a list built
 * in the portal shows its structured `lines`, and the status buttons set
 * `submitted` / `accepted` / `superseded` (`POST admin/pricelists/{id}/status/`).
 * The old buttons were Mark formatting / Mark formatted / Reject over the
 * old states; these are the same "Mark …" over the backend's three — and
 * because accepting one SUPERSEDES the link's previous accepted list with
 * no guard (C-21), the whole list is re-read after every change. The status
 * has no `/api/options/` entry (C-14), so its label is the raw value. The
 * soft cap (`…/pricelists/cap/`) is advisory: a line when over, never a block.
 *
 * `DocumentsSection` — every proposal and invoice Darz has issued this
 * partner, across all their shows, in the order they were issued. Documents
 * hang off the show (`/gallery/admin/exhibitions/{id}/documents/`), so
 * "everything sent to this gallery" meant opening each show in turn; this
 * gathers them. One request per show, which is why it waits for the shows
 * the page already loaded instead of fetching them again.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type {
  DocumentAdmin,
  ExhibitionAdmin,
  GalleryPricelistAdmin,
  GalleryPricelistCap,
  GalleryPricelistStatus,
} from '../../api/types';
import { DeskBanner } from './kit';
import {
  choiceLabel,
  fmtDate,
  fmtDateTime,
  fmtThousands,
  pricelistStatusLabel,
} from '../portal/portalForm';

/** `GalleryPricelist.STATUS_CHOICES`, in the order a list moves through them.
 * Typed against the schema enum, so a renamed value fails the build. */
const PRICELIST_STATUSES: readonly GalleryPricelistStatus[] = [
  'submitted',
  'accepted',
  'superseded',
];

export function PricelistsSection({ linkId }: { linkId: string }) {
  const { galleryAdmin } = useApi();
  const options = useOptions();
  const [rows, setRows] = useState<GalleryPricelistAdmin[] | null>(null);
  const [cap, setCap] = useState<GalleryPricelistCap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    galleryAdmin.linkPricelists(linkId, { per_page: 50 }).then(
      (p) => setRows(p.results),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the pricelists.'),
    );
    galleryAdmin.pricelistCap(linkId).then(setCap, () => setCap(null));
  }, [galleryAdmin, linkId]);
  useEffect(load, [load]);

  const setStatus = async (pl: GalleryPricelistAdmin, status: GalleryPricelistStatus) => {
    setBusyId(pl.id);
    setError(null);
    try {
      await galleryAdmin.setPricelistStatus(pl.id, status);
      load(); // C-21: accepting one may have superseded another
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not set the status.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Pricelists they sent</h2>
        <span className="ad-dsec-n">
          uploaded or built in the portal’s Pricelists tab
          {cap ? ` · ${cap.count} of a soft cap of ${cap.cap}` : ''}
        </span>
      </div>

      {cap?.over_cap && (
        <p className="ad-dsec-foot">
          This partner has sent {cap.count} pricelists — over the soft cap of {cap.cap}. It is
          advisory only: nothing is blocked on either side.
        </p>
      )}
      {error && <DeskBanner>{error}</DeskBanner>}
      {!rows && !error && <p className="dz-state">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="dz-state">
          Nothing sent yet — the partner can upload or build one from their portal.
        </p>
      )}

      {rows && rows.length > 0 && (
        <div className="ad-card ad-logins">
          {rows.map((pl) => {
            const lines = Array.isArray(pl.lines) ? pl.lines : [];
            const built = !pl.object_key && lines.length > 0;
            const st = pl.status || 'submitted';
            return (
              <div className="ad-plrow" key={pl.id}>
                <div className="ad-recrow">
                  <span className="ad-reck">{fmtDate(pl.created_at)}</span>
                  <span className="ad-recv">
                    <b>
                      {pl.title ||
                        (built
                          ? `Built in portal — ${lines.length} work${lines.length === 1 ? '' : 's'}`
                          : 'Untitled pricelist')}
                    </b>
                    {pl.notes && <span className="ad-cellsub"> — {pl.notes}</span>}
                  </span>
                  <span
                    className={`ad-stpill is-${st === 'accepted' ? 'ok' : st === 'superseded' ? 'gone' : 'neut'}`}
                  >
                    {pricelistStatusLabel(options, st)}
                  </span>
                </div>
                {built && (
                  <table className="ad-pllines">
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.id}>
                          <td>{l.work_title || 'A work in their portal'}</td>
                          <td className="ad-num">
                            {l.price ? `${fmtThousands(l.price)} ${l.currency}`.trim() : '—'}
                          </td>
                          <td>
                            {l.availability
                              ? choiceLabel(
                                  options,
                                  'catalog.availability_status',
                                  l.availability,
                                )
                              : ''}
                          </td>
                          <td className="ad-cellsub">{l.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="ad-rowacts">
                  {pl.file_url && (
                    <a
                      className="ad-rowbtn"
                      href={pl.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open file
                    </a>
                  )}
                  {PRICELIST_STATUSES.filter((x) => x !== st).map((x) => (
                    <button
                      key={x}
                      type="button"
                      className={`ad-rowbtn${x === 'accepted' ? ' is-primary' : ''}`}
                      disabled={busyId === pl.id}
                      onClick={() => void setStatus(pl, x)}
                    >
                      Mark {pricelistStatusLabel(options, x).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** The reference Darz issued, as `ExhibitionComposePage` writes it. */
function reference(doc: DocumentAdmin): string {
  const fields = (doc.fields ?? {}) as Record<string, unknown>;
  const ref = fields.reference;
  return typeof ref === 'string' ? ref : '';
}

/** One row per document, newest first, with the show it belongs to. */
export function DocumentsSection({
  linkId,
  shows,
}: {
  linkId: string;
  /** The partner's shows, already loaded by the page. `null` = still loading. */
  shows: ExhibitionAdmin[] | null;
}) {
  const { galleryAdmin } = useApi();
  const [rows, setRows] = useState<Array<{
    doc: DocumentAdmin;
    show: ExhibitionAdmin;
  }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shows === null) return;
    // no early `setRows([])` for the empty case: Promise.all([]) resolves on
    // its own tick, which keeps this a promise chain rather than a synchronous
    // setState inside an effect (oxlint react/set-state-in-effect)
    let live = true;
    Promise.all(
      shows.map((show) =>
        galleryAdmin
          .exhibitionDocuments(show.id)
          .then((p) => p.results.map((doc) => ({ doc, show })))
          // one unreadable show must not empty the whole list
          .catch(() => [] as Array<{ doc: DocumentAdmin; show: ExhibitionAdmin }>),
      ),
    ).then(
      (all) => {
        if (!live) return;
        setRows(all.flat().sort((a, b) => (a.doc.created_at < b.doc.created_at ? 1 : -1)));
      },
      (err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : 'Could not load the documents.');
      },
    );
    return () => {
      live = false;
    };
  }, [galleryAdmin, shows]);

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Proposals &amp; invoices</h2>
        <span className="ad-dsec-n">everything Darz has issued this partner</span>
      </div>

      {error && <DeskBanner>{error}</DeskBanner>}
      {(shows === null || (!rows && !error)) && <p className="dz-state">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="dz-state">
          Nothing issued yet — a proposal is issued from a show, once its package stands.
        </p>
      )}

      {rows && rows.length > 0 && (
        <div className="ad-card ad-logins">
          {rows.map(({ doc, show }) => (
            <Link
              className="ad-recrow ad-recrow-link"
              key={doc.id}
              to={`/admin/sources/${linkId}/exhibitions/${show.id}`}
            >
              {/* The human reference (DARZ-PRO-2026-0001) is stored in
                  `fields.reference`, the way the composer writes and reads it
                  — `Document.ref` is the backend's own handle and shows as a
                  uuid here. Caught live: the list was printing the uuid. */}
              <span className="ad-reck">{reference(doc) || '—'}</span>
              <span className="ad-recv">
                <b>{doc.title}</b>
                <span className="ad-cellsub">
                  {show.title} · {fmtDateTime(doc.created_at)}
                </span>
              </span>
              <span className={`ad-stpill is-${doc.status === 'confirmed' ? 'ok' : 'neut'}`}>
                {doc.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
