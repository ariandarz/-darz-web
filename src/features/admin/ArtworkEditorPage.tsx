/**
 * ArtworkEditorPage — `/admin/artworks/new` and `/admin/artworks/:id`, the
 * old editor modal (`editArt`, `darz-studio.html:34065`) as a page.
 *
 * Ported content (each with its old line):
 *  - the titles "New Artwork" / "Edit Artwork" (`:34068`) and the primary
 *    button copy "Create artwork" / "Save changes" (`:34180`);
 *  - the field set: Artist, Title, Year, Medium, Dimensions (placeholder
 *    "e.g. 150 x 100 cm"), Edition, Price ("15,000"), Currency, City,
 *    Source (free text) (`:34070-34074`, `:34163`);
 *  - "Status by Darz" with its help line, verbatim: "This is what collectors
 *    see. Only Darz sets it." (`:34076`) — here the guarded transition
 *    buttons, since this backend changes status only through `/transition/`;
 *  - "Price on request" and its promise: "Hide the price — collectors see a
 *    'Request Price & Availability' button that opens the enquiry form."
 *    (`:34110`) — here the `on_request` price type, the same fact;
 *  - the multi-line Provenance editor and its label copy "— add one line per
 *    stage of ownership; each line shows to collectors on the artwork"
 *    (`:34196`), storage contract unchanged (one newline-separated string);
 *  - the per-artwork collector-action checkboxes (`:34168`, "tick the action
 *    boxes THIS artwork shows on its detail page") — the backend's
 *    `allowed_actions` (crm request kinds; empty list = all allowed,
 *    default-open, the model's own rule);
 *  - "Upload image…" (`:34069`) — here the real multi-image store.
 *
 * New backend facts the old editor lacked: `material`, `visibility` (one
 * field where the old app had inApp+portal+selection sidecars), linked
 * `artist` (uuid) beside the legacy raw name, `offer_floor` as an absolute
 * amount (the old per-artwork minimum was a % of asking — `:34176` — the
 * semantics changed with the backend, stated on the field).
 *
 * **Old fields with no backend home yet — stated, not dropped** (hybrid rule
 * 6; gaps table `docs/ADMIN_ARCHITECTURE.md` §7): framed size (G-CAT-4),
 * shipment & payment terms (G-CAT-5), provider contact + WhatsApp forward
 * (G-CAT-6), the per-artwork status-badge / screenshot-card theme toggles
 * (G-CAT-7). One line of copy on the page says so.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { ArtistAdmin, ArtworkAdmin, ArtworkImageAdmin, Choice } from '../../api/types';
import {
  buildArtworkPayload,
  draftFromArtwork,
  joinProvenance,
  priceProblem,
  provenanceLines,
  toggleAction,
  actionOn,
  transitionTargets,
  type ArtworkDraft,
} from './artworkForm';
import { StatusPill } from './ArtworksPage';
import { ConfirmDialog, DeskBanner, DeskPage } from './kit';
import './admin.css';

export function ArtworkEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const { catalogAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const [artwork, setArtwork] = useState<ArtworkAdmin | null>(null);
  const [draft, setDraft] = useState<ArtworkDraft | null>(
    isNew ? draftFromArtwork(null) : null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (isNew) return;
    catalogAdmin.artwork(id!).then(
      (a) => {
        setArtwork(a);
        setDraft(draftFromArtwork(a));
      },
      (err: unknown) =>
        setLoadError(err instanceof Error ? err.message : 'Could not load the artwork.'),
    );
  }, [catalogAdmin, id, isNew]);
  useEffect(load, [load]);

  // the artist roster for the linked-artist select
  const [artists, setArtists] = useState<ArtistAdmin[]>([]);
  useEffect(() => {
    let alive = true;
    catalogAdmin.artists({ per_page: 500 }).then(
      (page) => alive && setArtists(page.results),
      () => alive && setArtists([]),
    );
    return () => {
      alive = false;
    };
  }, [catalogAdmin]);

  const statuses = choices(options, 'catalog.availability_status');
  const priceTypes = choices(options, 'catalog.price_type');
  const currencies = choices(options, 'currency');
  const visibilities = choices(options, 'catalog.visibility');
  // the four per-artwork collector actions have their own options key —
  // `crm.collector_action` (purchase · hold · offer · viewing), never a
  // hardcoded lookup (the values are crm request kinds, the model's rule).
  const actionKinds = choices(options, 'crm.collector_action');

  const set = <K extends keyof ArtworkDraft>(key: K, value: ArtworkDraft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = async () => {
    if (!draft || busy) return;
    if (!draft.title.trim()) {
      setError('An artwork needs a title.');
      return;
    }
    const bad = priceProblem(draft);
    if (bad) {
      setError(bad);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = buildArtworkPayload(draft);
      if (isNew) {
        const created = await catalogAdmin.createArtwork(body);
        navigate(`/admin/artworks/${created.id}`, { replace: true });
      } else {
        const updated = await catalogAdmin.updateArtwork(id!, {
          ...body,
          expected_version: artwork!.version,
        });
        setArtwork(updated);
        setDraft(draftFromArtwork(updated));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const transition = async (to: string) => {
    if (busy || isNew) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await catalogAdmin.transitionArtwork(id!, to);
      setArtwork(updated);
      setDraft((d) => d ?? draftFromArtwork(updated));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not change the status.');
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async () => {
    if (busy || isNew || !artwork) return;
    setBusy(true);
    setError(null);
    try {
      const updated = artwork.is_published
        ? await catalogAdmin.unpublishArtwork(id!)
        : await catalogAdmin.publishArtwork(id!);
      setArtwork(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not change publication.');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <DeskPage title="Edit Artwork">
        <DeskBanner>{loadError}</DeskBanner>
      </DeskPage>
    );
  }
  if (!draft) {
    return (
      <DeskPage title="Edit Artwork">
        <p className="dz-state">Loading…</p>
      </DeskPage>
    );
  }

  const lines = provenanceLines(draft.provenance);

  return (
    <DeskPage
      title={isNew ? 'New Artwork' : 'Edit Artwork'}
      action={
        artwork && (
          <StatusPill
            status={artwork.availability_status}
            label={labelOf(statuses, artwork.availability_status)}
          />
        )
      }
    >
      <p className="ad-desksub">
        <button
          type="button"
          className="ad-ghostbtn"
          onClick={() => navigate('/admin/artworks')}
        >
          ← Back to the Database
        </button>
      </p>

      {error && <DeskBanner>{error}</DeskBanner>}

      {/* ---- status & reach (edit only — a new artwork starts internal) ---- */}
      {artwork && (
        <section className="ad-dsec">
          <div className="ad-dsec-h">
            <h2 className="ad-dsec-t">Status &amp; reach</h2>
            {/* :34076, verbatim */}
            <span className="ad-dsec-n">This is what collectors see. Only Darz sets it.</span>
          </div>
          <div className="ad-card ad-reach">
            <div className="ad-reachrow">
              <span className="ad-filter-l">Status by Darz</span>
              <StatusPill
                status={artwork.availability_status}
                label={labelOf(statuses, artwork.availability_status)}
              />
              {transitionTargets(artwork.availability_status).map((to) => (
                <button
                  key={to}
                  type="button"
                  className="ad-rowbtn"
                  disabled={busy}
                  onClick={() => void transition(to)}
                >
                  → {labelOf(statuses, to)}
                </button>
              ))}
              {transitionTargets(artwork.availability_status).length === 0 && (
                <span className="ad-cellsub">a terminal status — no further moves</span>
              )}
            </div>
            <div className="ad-reachrow">
              <span className="ad-filter-l">Market App</span>
              <button
                type="button"
                className={`ad-appck${artwork.is_published ? ' on' : ''}`}
                aria-pressed={artwork.is_published}
                disabled={busy}
                title={
                  artwork.is_published
                    ? 'Shown in the Market App — tap to remove'
                    : 'Hidden from the Market App — tap to add'
                }
                onClick={() => void togglePublish()}
              >
                <span className="ad-appck-bx">{artwork.is_published ? '✓' : ''}</span>APP
              </button>
              <span className="ad-cellsub">
                {artwork.is_published && artwork.published_at
                  ? `Published ${new Date(artwork.published_at).toLocaleString('en-GB')}`
                  : 'Not in the Market App.'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ---- the form ---- */}
      <div className="ad-card ad-form">
        <div className="ad-form-grid">
          <label className="ad-field">
            <span className="ad-filter-l">Artist · linked</span>
            <select value={draft.artist} onChange={(e) => set('artist', e.target.value)}>
              <option value="">— none —</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Artist name · raw text</span>
            <input
              value={draft.artist_name_raw}
              onChange={(e) => set('artist_name_raw', e.target.value)}
              placeholder="used when no linked artist — imports land here"
            />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Title</span>
            <input
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus={isNew}
            />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Year</span>
            <input
              value={draft.year}
              onChange={(e) => set('year', e.target.value)}
              inputMode="numeric"
            />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Medium</span>
            <input value={draft.medium} onChange={(e) => set('medium', e.target.value)} />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Material</span>
            <input value={draft.material} onChange={(e) => set('material', e.target.value)} />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Dimensions (artwork only)</span>
            <input
              value={draft.dimensions}
              onChange={(e) => set('dimensions', e.target.value)}
              placeholder="e.g. 150 x 100 cm"
            />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Edition</span>
            <input value={draft.edition} onChange={(e) => set('edition', e.target.value)} />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">City</span>
            <input value={draft.city} onChange={(e) => set('city', e.target.value)} />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Source / gallery (free text)</span>
            <input
              value={draft.source_name}
              onChange={(e) => set('source_name', e.target.value)}
            />
          </label>
        </div>

        {/* ---- price ---- */}
        <div className="ad-form-grid">
          <label className="ad-field">
            <span className="ad-filter-l">Price type</span>
            <select
              value={draft.price_type}
              onChange={(e) => set('price_type', e.target.value)}
            >
              {priceTypes.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Price</span>
            <input
              value={draft.price_amount}
              onChange={(e) => set('price_amount', e.target.value)}
              placeholder="15000"
              inputMode="decimal"
              disabled={draft.price_type === 'on_request'}
            />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Currency</span>
            <select
              value={draft.currency}
              onChange={(e) => set('currency', e.target.value)}
              disabled={draft.price_type === 'on_request'}
            >
              <option value="">— Select currency —</option>
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Minimum acceptable offer · internal</span>
            <input
              value={draft.offer_floor}
              onChange={(e) => set('offer_floor', e.target.value)}
              inputMode="decimal"
              placeholder="an amount, not a % — blank = no floor"
            />
          </label>
        </div>
        {draft.price_type === 'on_request' && (
          /* :34110 — the old checkbox's promise, now the price type's help */
          <p className="ad-cellsub">
            Price on request — the price is hidden; collectors see a “Request Price &amp;
            Availability” button that opens the enquiry form.
          </p>
        )}

        {/* ---- visibility ---- */}
        <div className="ad-form-grid">
          <label className="ad-field">
            <span className="ad-filter-l">Visibility</span>
            <select
              value={draft.visibility}
              onChange={(e) => set('visibility', e.target.value)}
            >
              {visibilities.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* ---- provenance (:34196 — the old multi-row editor, same storage) ---- */}
        <div className="ad-field">
          <span className="ad-filter-l">
            Provenance{' '}
            <span className="ad-subnote">
              — add one line per stage of ownership; each line shows to collectors on the
              artwork
            </span>
          </span>
          {lines.map((line, i) => (
            <div key={i} className="ad-provrow">
              <input
                value={line}
                placeholder="e.g. Darz, Tehran"
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = e.target.value;
                  set('provenance', next.join('\n'));
                }}
              />
              <button
                type="button"
                className="ad-ghostbtn"
                title="Remove this provenance line"
                onClick={() =>
                  set('provenance', joinProvenance(lines.filter((_, j) => j !== i)))
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ad-ghostbtn ad-provadd"
            onClick={() => set('provenance', [...lines, ''].join('\n'))}
          >
            ＋ Add provenance
          </button>
        </div>

        {/* ---- texts ---- */}
        <div className="ad-form-grid">
          <label className="ad-field ad-field--wide">
            <span className="ad-filter-l">About · shown to collectors</span>
            <textarea
              rows={3}
              value={draft.public_description}
              onChange={(e) => set('public_description', e.target.value)}
            />
          </label>
          <label className="ad-field ad-field--wide">
            <span className="ad-filter-l">Internal notes · never shown</span>
            <textarea
              rows={2}
              value={draft.internal_notes}
              onChange={(e) => set('internal_notes', e.target.value)}
            />
          </label>
        </div>

        {/* ---- collector actions (:34168) ---- */}
        <div className="ad-field">
          <span className="ad-filter-l">
            Market App actions{' '}
            <span className="ad-subnote">
              — tick the action boxes THIS artwork shows on its detail page; all on by default
            </span>
          </span>
          <div className="ad-actgrid">
            {actionKinds.map((k) => (
              <label key={k.value} className="ad-actck">
                <input
                  type="checkbox"
                  checked={actionOn(draft.allowed_actions, k.value)}
                  onChange={() =>
                    set(
                      'allowed_actions',
                      toggleAction(
                        draft.allowed_actions,
                        k.value,
                        actionKinds.map((c) => c.value),
                      ),
                    )
                  }
                />
                {k.label}
              </label>
            ))}
          </div>
        </div>

        {/* the old editor's fields with no backend home yet — stated, per the
            hybrid rule, instead of silently gone */}
        <p className="ad-cellsub">
          Framed size, shipment &amp; payment terms, the provider contact, and the per-artwork
          status-badge / screenshot toggles are not carried by the backend yet (G-CAT-4…7) —
          stated here rather than silently dropped.
        </p>

        {(artwork?.legacy_darz_id || artwork?.legacy_airtable_id) && (
          <p className="ad-cellsub">
            Legacy ids: {artwork.legacy_darz_id ?? '—'} · {artwork.legacy_airtable_id ?? '—'}
          </p>
        )}

        <div className="ad-form-a">
          <button
            type="button"
            className="ad-action"
            disabled={busy}
            onClick={() => void save()}
          >
            {/* :34180 */}
            {isNew ? 'Create artwork' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* ---- images (edit only — "save the artwork first", the old editor's
           own portal rule at :34129 applied to the image store) ---- */}
      {!isNew && id && <ImagesSection artworkId={id} />}
    </DeskPage>
  );
}

/** The image store — list · upload (multipart) · make-primary at upload ·
 * remove. No PATCH exists, so changing the primary is upload-new + remove-old
 * (said on the section). */
function ImagesSection({ artworkId }: { artworkId: string }) {
  const { catalogAdmin } = useApi();
  const [images, setImages] = useState<ArtworkImageAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [primary, setPrimary] = useState(false);
  const [removing, setRemoving] = useState<ArtworkImageAdmin | null>(null);

  const load = useCallback(() => {
    catalogAdmin.artworkImages(artworkId).then(
      (list) => setImages(list),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the images.'),
    );
  }, [catalogAdmin, artworkId]);
  useEffect(load, [load]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await catalogAdmin.uploadArtworkImage(artworkId, file, {
        isPrimary: primary,
        ordering: images?.length ?? 0,
      });
      setPrimary(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not upload.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (image: ArtworkImageAdmin) => {
    setBusy(true);
    setError(null);
    try {
      await catalogAdmin.deleteArtworkImage(artworkId, image.id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove the image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Images</h2>
        <span className="ad-dsec-n">
          the first / primary image is the card image; to change the primary, upload the new
          one as primary and remove the old
        </span>
      </div>
      {error && <DeskBanner>{error}</DeskBanner>}
      {!images && !error && <p className="dz-state">Loading…</p>}
      {images && (
        <div className="ad-imggrid">
          {images.map((img) => (
            <figure key={img.id} className="ad-imgcard">
              <img src={img.image_url} alt={img.alt_text || 'artwork image'} loading="lazy" />
              <figcaption>
                {img.is_primary && <span className="ad-chip">primary</span>}
                <button
                  type="button"
                  className="ad-rowbtn is-danger"
                  disabled={busy}
                  onClick={() => setRemoving(img)}
                >
                  Remove
                </button>
              </figcaption>
            </figure>
          ))}
          <label className="ad-imgadd">
            {/* :34069 — the old button's copy */}
            <span className="ad-cellmain">Upload image…</span>
            <span className="ad-cellsub">
              <input
                type="checkbox"
                checked={primary}
                onChange={(e) => setPrimary(e.target.checked)}
              />{' '}
              make it the primary
            </span>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
          </label>
          {images.length === 0 && (
            <p className="dz-state">No images yet — the Market App hides works without one.</p>
          )}
        </div>
      )}
      {removing && (
        <ConfirmDialog
          message="Remove this image? The stored file is kept server-side (soft delete)."
          okLabel="Remove"
          danger
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const img = removing;
            setRemoving(null);
            void remove(img);
          }}
        />
      )}
    </section>
  );
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function labelOf(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
