/**
 * SourceDetailPage — `/admin/sources/:id`: one partner's record, their
 * portal's switches, and the works they hold.
 *
 * The old per-gallery workspace (`gwOpen`, workspaces-runtime.js) wrapped
 * this in exhibitions, documents and a live portal preview — those ride the
 * portal phase. What is real today, faithfully:
 *  - the record card: name · type · status · contact · expiry · issued;
 *    enable/disable the portal (the old passport's toggle);
 *  - the funnel switches (backend Phase 12 — the old `feat_funnel` /
 *    `feat_funnel_activity` columns): show each shared work's stage in the
 *    portal, optionally with anonymous aggregate activity counts ("Never
 *    exposes a collector identity" — the model's own promise, kept on the
 *    switch copy);
 *  - the assigned works: the SNAPSHOT list (the portal reads this, never
 *    the live artwork), assign via the catalogue picker, remove, and the
 *    per-work funnel-stage override (blank = derive live).
 *
 * The token/PIN are not here — shown once at issue, never retrievable
 * (the serializer's contract). Re-issuing means a new partner link.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { Choice, GalleryLinkAdmin, GalleryLinkArtwork } from '../../api/types';
import { ConfirmDialog, DeskBanner, DeskPage, Picker, type PickItem } from './kit';
import './admin.css';

export function SourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { galleryAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const [link, setLink] = useState<GalleryLinkAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const types = choices(options, 'gallery.source_type');
  const stages = choices(options, 'gallery.funnel_stage');

  const load = useCallback(() => {
    if (!id) return;
    galleryAdmin.link(id).then(
      (l) => setLink(l),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the partner.'),
    );
  }, [galleryAdmin, id]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<GalleryLinkAdmin>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setLink(await fn());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That did not go through.');
    } finally {
      setBusy(false);
    }
  };

  if (!link) {
    return (
      <DeskPage title="Partner">
        {error ? <DeskBanner>{error}</DeskBanner> : <p className="dz-state">Loading…</p>}
      </DeskPage>
    );
  }

  return (
    <DeskPage
      title={link.name}
      action={
        <span
          className={`ad-stpill is-${link.status === 'active' ? 'ok' : link.status === 'disabled' ? 'neut' : 'gone'}`}
        >
          {link.status}
        </span>
      }
    >
      <p className="ad-desksub">
        <button
          type="button"
          className="ad-ghostbtn"
          onClick={() => navigate('/admin/sources')}
        >
          ← All partners
        </button>
      </p>

      {error && <DeskBanner>{error}</DeskBanner>}

      {/* ---- the record ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">Record</h2>
          <span className="ad-dsec-n">
            the portal sign-in (token + PIN) was shown once at issue and is not retrievable
          </span>
        </div>
        <div className="ad-card ad-logins">
          <Row k="Type" v={label(types, link.source_type)} />
          <Row k="Contact" v={link.contact_name || '—'} />
          <Row k="Email" v={link.contact_email || '—'} />
          <Row k="Phone" v={link.contact_phone || '—'} />
          <Row
            k="Expires"
            v={link.expires_at ? new Date(link.expires_at).toLocaleString('en-GB') : 'Never'}
          />
          <Row k="Issued" v={new Date(link.created_at).toLocaleDateString('en-GB')} />
          <div className="ad-recrow">
            <span className="ad-reck">Portal</span>
            <span className="ad-recv">{link.status}</span>
            {link.status === 'active' ? (
              <button
                type="button"
                className="ad-rowbtn is-danger"
                disabled={busy}
                onClick={() => void act(() => galleryAdmin.disableLink(link.id))}
              >
                Disable
              </button>
            ) : (
              <button
                type="button"
                className="ad-rowbtn"
                disabled={busy}
                onClick={() => void act(() => galleryAdmin.enableLink(link.id))}
              >
                Enable
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ---- the funnel switches (Phase 12) ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">Sales funnel in the portal</h2>
          <span className="ad-dsec-n">what this partner sees about their works' journey</span>
        </div>
        <div className="ad-card ad-reach">
          <label className="ad-actck">
            <input
              type="checkbox"
              checked={link.feat_funnel}
              disabled={busy}
              onChange={(e) =>
                void act(() =>
                  galleryAdmin.setLinkFeatures(link.id, { feat_funnel: e.target.checked }),
                )
              }
            />
            Show each shared work's stage (listed → viewed → … → sold)
          </label>
          <label className="ad-actck">
            <input
              type="checkbox"
              checked={link.feat_funnel_activity}
              disabled={busy || !link.feat_funnel}
              onChange={(e) =>
                void act(() =>
                  galleryAdmin.setLinkFeatures(link.id, {
                    feat_funnel_activity: e.target.checked,
                  }),
                )
              }
            />
            Also show anonymous aggregate activity counts — never a collector identity
          </label>
        </div>
      </section>

      {/* ---- the assigned works ---- */}
      <WorksSection linkId={link.id} stages={stages} />
    </DeskPage>
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

/** The snapshot list + assign/remove + the per-work stage override. The
 * snapshot is the portal's truth — a later artwork edit does not change it
 * (the model's own rule, said in the section note). */
function WorksSection({ linkId, stages }: { linkId: string; stages: Choice[] }) {
  const { galleryAdmin, catalogAdmin } = useApi();
  const [rows, setRows] = useState<GalleryLinkArtwork[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickItem[]>([]);
  const [removing, setRemoving] = useState<GalleryLinkArtwork | null>(null);

  const load = useCallback(() => {
    galleryAdmin.linkArtworks(linkId, { per_page: 100 }).then(
      (page) => setRows(page.results),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the works.'),
    );
  }, [galleryAdmin, linkId]);
  useEffect(load, [load]);

  const assign = async (item: PickItem) => {
    setBusyId('assign');
    setError(null);
    try {
      await galleryAdmin.assignArtwork(linkId, item.id);
      setPicked([]);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not assign the work.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row: GalleryLinkArtwork) => {
    setBusyId(row.id);
    setError(null);
    try {
      await galleryAdmin.removeArtwork(linkId, row.id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove the work.');
    } finally {
      setBusyId(null);
    }
  };

  const override = async (row: GalleryLinkArtwork, stage: string) => {
    setBusyId(row.id);
    setError(null);
    try {
      await galleryAdmin.setFunnelOverride(linkId, row.id, stage);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not set the stage.');
    } finally {
      setBusyId(null);
    }
  };

  const title = (row: GalleryLinkArtwork) => {
    const snap = (row.snapshot as Record<string, unknown>) ?? {};
    const t = typeof snap.title === 'string' ? snap.title : String(row.artwork).slice(0, 8);
    const a = typeof snap.artist_name === 'string' ? snap.artist_name : '';
    return { t, a };
  };

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Works they hold</h2>
        <span className="ad-dsec-n">
          the portal reads this snapshot, never the live record — a later edit does not change
          what the partner sees
        </span>
      </div>

      <Picker
        label="Assign a work"
        placeholder="Search the catalogue — artist, title, medium…"
        picked={picked}
        onChange={(items) => {
          setPicked(items);
          const item = items[0];
          if (item) void assign(item);
        }}
        single
        search={async (q) => {
          const page = await catalogAdmin.artworks({ search: q, per_page: 8 });
          return page.results.map((a) => ({
            id: a.id,
            label: a.artist_name_raw ? `${a.artist_name_raw} — ${a.title}` : a.title,
          }));
        }}
      />

      {error && <DeskBanner>{error}</DeskBanner>}
      {!rows && !error && <p className="dz-state">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="dz-state">No works assigned yet — search the catalogue above.</p>
      )}

      {rows && rows.length > 0 && (
        <div className="ad-card ad-logins">
          {rows.map((row) => {
            const { t, a } = title(row);
            return (
              <div key={row.id} className="ad-recrow">
                <span className="ad-recv">
                  <span className="ad-cellmain">{t}</span>
                  {a && <span className="ad-cellsub"> {a}</span>}
                </span>
                <select
                  className="ad-inlsel"
                  value={row.funnel_status ?? ''}
                  disabled={busyId === row.id}
                  title="The Darz-set stage override — blank derives from the catalogue status and live collector signals"
                  onChange={(e) => void override(row, e.target.value)}
                >
                  <option value="">Stage: derived</option>
                  {stages.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ad-rowbtn is-danger"
                  disabled={busyId === row.id}
                  onClick={() => setRemoving(row)}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      {removing && (
        <ConfirmDialog
          message="Remove this work from the partner's portal? Their snapshot row goes; the artwork itself is untouched."
          okLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const r = removing;
            setRemoving(null);
            void remove(r);
          }}
        />
      )}
    </section>
  );
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
