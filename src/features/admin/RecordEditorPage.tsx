/**
 * RecordEditorPage — `/admin/auction-records/new|:id`: one external result's
 * full form, the serializer's own field set (the Phase 11-admin widening —
 * everything the old Records tab showed: image · medium · dimensions ·
 * estimates · hammer vs realized · sale metadata · texts · the highlight).
 *
 * The artist links to the catalogue roster when a confident match exists;
 * the raw reported name stays the fallback — the model's own pair. PATCH is
 * plain (no lock input on this serializer).
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { ArtistAdmin, AuctionRecord, Choice } from '../../api/types';
import { DeskBanner, DeskPage } from './kit';
import './admin.css';

type Draft = Record<string, string>;

const EMPTY: Draft = {
  artist: '',
  artist_name_raw: '',
  lot_title: '',
  year: '',
  medium: '',
  dimensions: '',
  house: '',
  sale_name: '',
  sale_date: '',
  section: 'past',
  status: 'sold',
  lot_reference: '',
  source_url: '',
  image_url: '',
  currency: '',
  low_estimate: '',
  high_estimate: '',
  hammer_amount: '',
  realized_amount: '',
  price_amount: '',
  provenance: '',
  literature: '',
  exhibition: '',
  notes: '',
  house_notes: '',
  is_highlight: '',
  highlight_order: '',
};

export function RecordEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const { auctionsAdmin, catalogAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const statuses = choices(options, 'auctions.record_status');
  const sections = choices(options, 'auctions.record_section');
  const currencies = choices(options, 'currency');

  const [draft, setDraft] = useState<Draft | null>(isNew ? { ...EMPTY } : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [artists, setArtists] = useState<ArtistAdmin[]>([]);

  useEffect(() => {
    let alive = true;
    catalogAdmin.artists({ per_page: 500 }).then(
      (page) => alive && setArtists(page.results),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [catalogAdmin]);

  useEffect(() => {
    if (isNew || !id) return;
    auctionsAdmin.record(id).then(
      (r) => {
        const d: Draft = { ...EMPTY };
        for (const k of Object.keys(EMPTY)) {
          const v = (r as unknown as Record<string, unknown>)[k];
          d[k] = v == null ? '' : k === 'is_highlight' ? (v ? 'yes' : '') : String(v);
        }
        setDraft(d);
      },
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the record.'),
    );
  }, [auctionsAdmin, id, isNew]);

  const set = (k: string, v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const save = async () => {
    if (!draft || busy) return;
    if (!draft.house.trim() || !draft.lot_title.trim()) {
      setError('A record needs at least the auction house and the lot title.');
      return;
    }
    setBusy(true);
    setError(null);
    const num = (v: string) => (v.trim() === '' ? null : v.trim());
    const body: Partial<AuctionRecord> = {
      artist: draft.artist || null,
      artist_name_raw: draft.artist_name_raw.trim(),
      lot_title: draft.lot_title.trim(),
      // year is free text on records ('c. 1970' is real data)
      year: draft.year.trim(),
      medium: draft.medium.trim(),
      dimensions: draft.dimensions.trim(),
      house: draft.house.trim(),
      sale_name: draft.sale_name.trim(),
      sale_date: draft.sale_date || null,
      section: draft.section as AuctionRecord['section'],
      status: draft.status as AuctionRecord['status'],
      lot_reference: draft.lot_reference.trim(),
      source_url: draft.source_url.trim(),
      image_url: draft.image_url.trim(),
      currency: (draft.currency || null) as AuctionRecord['currency'],
      low_estimate: num(draft.low_estimate),
      high_estimate: num(draft.high_estimate),
      hammer_amount: num(draft.hammer_amount),
      realized_amount: num(draft.realized_amount),
      price_amount: num(draft.price_amount),
      provenance: draft.provenance,
      literature: draft.literature,
      exhibition: draft.exhibition,
      notes: draft.notes,
      house_notes: draft.house_notes,
      is_highlight: draft.is_highlight === 'yes',
      highlight_order:
        draft.highlight_order.trim() === '' ? undefined : Number(draft.highlight_order),
    };
    try {
      if (isNew) {
        const created = await auctionsAdmin.createRecord(body);
        navigate(`/admin/auction-records/${created.id}`, { replace: true });
      } else {
        await auctionsAdmin.updateRecord(id!, body);
        navigate('/admin/auction-records');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the record.');
    } finally {
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <DeskPage title="Auction record">
        {error ? <DeskBanner>{error}</DeskBanner> : <p className="dz-state">Loading…</p>}
      </DeskPage>
    );
  }

  // a render HELPER, not a component — an inline component would remount its
  // input on every render and drop focus per keystroke (oxlint
  // static-components caught it)
  const field = (k: string, l: string, ph?: string, type?: string) => (
    <label className="ad-field" key={k}>
      <span className="ad-filter-l">{l}</span>
      <input
        type={type}
        value={draft[k]}
        onChange={(e) => set(k, e.target.value)}
        placeholder={ph}
      />
    </label>
  );

  return (
    <DeskPage
      title={isNew ? 'New auction record' : 'Edit auction record'}
      subtitle={
        <>
          <button
            type="button"
            className="ad-ghostbtn"
            onClick={() => navigate('/admin/auction-records')}
          >
            ← All records
          </button>
        </>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}

      <div className="ad-card ad-form">
        <div className="ad-form-h">The lot</div>
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
          {field(
            'artist_name_raw',
            'Artist name · as reported',
            'fallback when no confident match',
          )}
          {field('lot_title', 'Lot title')}
          {field('year', 'Year')}
          {field('medium', 'Medium')}
          {field('dimensions', 'Dimensions')}
          {field('image_url', 'Image URL')}
        </div>

        <div className="ad-form-h">The sale</div>
        <div className="ad-form-grid">
          {field('house', 'Auction house')}
          {field('sale_name', 'Sale name')}
          {field('sale_date', 'Sale date', undefined, 'date')}
          <label className="ad-field">
            <span className="ad-filter-l">Section</span>
            <select value={draft.section} onChange={(e) => set('section', e.target.value)}>
              {sections.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Status</span>
            <select value={draft.status} onChange={(e) => set('status', e.target.value)}>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {field('lot_reference', "House's lot reference")}
          {field('source_url', 'Source URL')}
        </div>

        <div className="ad-form-h">The money</div>
        <div className="ad-form-grid">
          <label className="ad-field">
            <span className="ad-filter-l">Currency</span>
            <select value={draft.currency} onChange={(e) => set('currency', e.target.value)}>
              <option value="">—</option>
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {field('low_estimate', 'Low estimate')}
          {field('high_estimate', 'High estimate')}
          {field('hammer_amount', 'Hammer')}
          {field('realized_amount', 'Realized · with premium')}
          {field('price_amount', 'Price · legacy single figure')}
        </div>

        <div className="ad-form-h">Texts &amp; highlight</div>
        <div className="ad-form-grid">
          <label className="ad-field ad-field--wide">
            <span className="ad-filter-l">Provenance</span>
            <textarea
              rows={2}
              value={draft.provenance}
              onChange={(e) => set('provenance', e.target.value)}
            />
          </label>
          <label className="ad-field ad-field--wide">
            <span className="ad-filter-l">Literature</span>
            <textarea
              rows={2}
              value={draft.literature}
              onChange={(e) => set('literature', e.target.value)}
            />
          </label>
          {field('exhibition', 'Exhibition')}
          {field('notes', 'Notes')}
          {field('house_notes', 'House notes')}
        </div>
        <label className="ad-actck" style={{ maxWidth: 'fit-content' }}>
          <input
            type="checkbox"
            checked={draft.is_highlight === 'yes'}
            onChange={(e) => set('is_highlight', e.target.checked ? 'yes' : '')}
          />
          ★ Highlight — pinned to the collector Records strip
        </label>
        {draft.is_highlight === 'yes' && (
          <div className="ad-form-grid">
            {field('highlight_order', 'Highlight order', 'lower first')}
          </div>
        )}

        <div className="ad-form-a">
          <button
            type="button"
            className="ad-action"
            disabled={busy}
            onClick={() => void save()}
          >
            {isNew ? 'Create record' : 'Save record'}
          </button>
        </div>
      </div>
    </DeskPage>
  );
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}
