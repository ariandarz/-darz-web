/**
 * SourceDocuments — the two halves of the paper trail a partner page was
 * missing, found by walking the chain live on 2026-09-19.
 *
 * `PricelistsSection` — the gallery's own pricelists. The portal has
 * uploaded these since Phase 10 (`POST /gallery/portal/{token}/pricelists/`)
 * and the backend has served them to the desk all along
 * (`GET /gallery/admin/links/{id}/pricelists/`) — nothing in this app ever
 * asked. A gallery sent Darz a pricelist and it went nowhere. It is a list,
 * not a viewer: `GalleryPricelistSerializer` carries `title`/`notes`/
 * `created_at` and NOT the stored object key, so the file cannot be opened
 * from here and the section says so rather than offering a button that
 * cannot work (G-PORT-14).
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
import { useApi } from '../../api/hooks';
import type { DocumentAdmin, ExhibitionAdmin, GalleryPricelistAdmin } from '../../api/types';
import { DeskBanner } from './kit';
import { fmtDate, fmtDateTime } from '../portal/portalForm';

export function PricelistsSection({ linkId }: { linkId: string }) {
  const { galleryAdmin } = useApi();
  const [rows, setRows] = useState<GalleryPricelistAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    galleryAdmin.linkPricelists(linkId, { per_page: 50 }).then(
      (p) => setRows(p.results),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the pricelists.'),
    );
  }, [galleryAdmin, linkId]);
  useEffect(load, [load]);

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Pricelists they sent</h2>
        <span className="ad-dsec-n">uploaded from the portal’s Pricelists tab</span>
      </div>

      {error && <DeskBanner>{error}</DeskBanner>}
      {!rows && !error && <p className="dz-state">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="dz-state">
          Nothing sent yet — the partner can upload one from their portal.
        </p>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="ad-card ad-logins">
            {rows.map((pl) => (
              <div className="ad-recrow" key={pl.id}>
                <span className="ad-reck">{fmtDate(pl.created_at)}</span>
                <span className="ad-recv">
                  <b>{pl.title || 'Untitled pricelist'}</b>
                  {pl.notes && <span className="ad-cellsub"> — {pl.notes}</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="ad-dsec-foot">
            The file itself is not served to the desk yet (G-PORT-14) — this records that a
            pricelist arrived, and what the partner said about it. Ask them for the file, or
            read it from the documents bucket, until the backend serves it here.
          </p>
        </>
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
