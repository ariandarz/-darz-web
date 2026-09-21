/**
 * ArtistsPage — `/admin/artists`, the Artists desk (`artistsView()`,
 * `darz-studio.html:33522`) over backend Phase 7's admin artists CRUD.
 *
 * Ported content:
 *  - the title, the search ("Search artists…", `:33591`), the A–Z /
 *    recently-updated sorts (`:33594`, the two whose facts exist here);
 *  - the roster line "Showing n of m artists" (`:33604`);
 *  - the INLINE intro edit — the old one-line bio input on every row, "Type
 *    a one-line intro — saves instantly" (`:33576`) — here a real PATCH
 *    with the optimistic lock;
 *  - the empty copy "No artists yet — artists appear here automatically as
 *    artworks and records are added." (`:33607`) — trimmed of "and records":
 *    auction records are a later phase, and here artists are also created
 *    by hand (the roster is a real table, not a derivation).
 *
 * **Not ported, stated** (the old desk derived these from client-local
 * stores that have no server counterpart yet):
 *  - works / in-app counts per artist and the works-based scopes+sorts —
 *    the admin roster carries no aggregates (G-CAT-3, which also means no
 *    server search: this desk searches client-side over the fetched page);
 *  - auction-record counts and links (`recCell`) — the auctions phase's;
 *  - the profile status lane (draft/published/hidden/archived), highlights
 *    and achievements (`:33559`) — no backend fields (G-ART-1); the model
 *    carries name/bio/birth year/nationality/variants only. "Only a
 *    Published profile reaches collectors" therefore does not apply: every
 *    artist row is servable to the collector Artists screen today.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { ArtistAdmin } from '../../api/types';
import {
  ConfirmDialog,
  DeskAction,
  DeskBanner,
  DeskPage,
  DataTable,
  type Column,
} from './kit';
import './admin.css';

const SORTS = [
  { value: 'az', label: 'Name A–Z' },
  { value: 'updated', label: 'Recently updated' },
] as const;

export function ArtistsPage() {
  const { catalogAdmin } = useApi();
  const [artists, setArtists] = useState<ArtistAdmin[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'az' | 'updated'>('az');
  const [editing, setEditing] = useState<ArtistAdmin | null | 'new'>(null);
  const [removing, setRemoving] = useState<ArtistAdmin | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    catalogAdmin.artists({ per_page: 500 }).then(
      (page) => {
        setArtists(page.results);
        setTotal(page.pagination.total_count);
      },
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the roster.'),
    );
  }, [catalogAdmin]);
  useEffect(load, [load]);

  const rows = useMemo(() => {
    let list = artists ?? [];
    const term = q.trim().toLowerCase();
    if (term) list = list.filter((a) => a.display_name.toLowerCase().includes(term));
    return [...list].sort((a, b) =>
      sort === 'updated'
        ? b.updated_at.localeCompare(a.updated_at) ||
          a.display_name.localeCompare(b.display_name)
        : a.display_name.localeCompare(b.display_name),
    );
  }, [artists, q, sort]);

  /** :33576 — the inline intro. Saved on commit (Enter/blur) with the lock;
   * a version conflict reloads the roster so the row shows the newer truth. */
  const saveBio = async (artist: ArtistAdmin, bio: string) => {
    if (bio === (artist.bio ?? '')) return;
    setBusyId(artist.id);
    setError(null);
    try {
      await catalogAdmin.updateArtist(artist.id, { bio, expected_version: artist.version });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the intro.');
      load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (artist: ArtistAdmin) => {
    setError(null);
    try {
      await catalogAdmin.deleteArtist(artist.id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove the artist.');
    }
  };

  const columns: ReadonlyArray<Column<ArtistAdmin>> = [
    {
      key: 'name',
      header: 'Artist',
      cell: (a) => (
        <>
          <span className="ad-cellmain">{a.display_name}</span>
          {(a.nationality || a.birth_year) && (
            <span className="ad-cellsub">
              {[a.nationality, a.birth_year ? `b. ${a.birth_year}` : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'bio',
      header: 'Intro',
      className: 'ad-biocol',
      cell: (a) => (
        <input
          className="ad-bioline"
          defaultValue={a.bio ?? ''}
          placeholder="Short intro…"
          title="Type a one-line intro — saves when you leave the field"
          disabled={busyId === a.id}
          onBlur={(e) => void saveBio(a, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      ),
    },
    {
      key: 'variants',
      header: 'Name variants',
      cell: (a) => {
        const v = Array.isArray(a.name_variants) ? (a.name_variants as string[]) : [];
        return v.length ? v.join(' · ') : '—';
      },
    },
    {
      key: 'updated',
      header: 'Updated',
      className: 'ad-when',
      cell: (a) => new Date(a.updated_at).toLocaleDateString('en-GB'),
    },
    {
      key: 'acts',
      header: '',
      cell: (a) => (
        <span className="ad-rowacts">
          <button type="button" className="ad-rowbtn" onClick={() => setEditing(a)}>
            Edit
          </button>
          <button type="button" className="ad-rowbtn is-danger" onClick={() => setRemoving(a)}>
            Remove
          </button>
        </span>
      ),
    },
  ];

  return (
    <DeskPage
      wide
      title="Artists"
      action={<DeskAction onClick={() => setEditing('new')}>＋ New artist</DeskAction>}
      toolbar={
        <>
          <label className="ad-filter">
            <span className="ad-filter-l">Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search artists…"
            />
          </label>
          <label className="ad-filter">
            <span className="ad-filter-l">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as 'az' | 'updated')}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}
      {!artists && !error && <p className="dz-state">Loading…</p>}

      {editing && (
        <ArtistForm
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {artists && (
        <>
          {/* :33604 */}
          <p className="ad-cellsub">
            Showing {rows.length} of {total} artist{total === 1 ? '' : 's'}
          </p>
          {rows.length ? (
            <DataTable label="Artists" rows={rows} columns={columns} rowKey={(a) => a.id} />
          ) : (
            <p className="dz-state">
              {total
                ? 'No artists match.'
                : 'No artists yet — artists appear here automatically as artworks are added.'}
            </p>
          )}
        </>
      )}

      {removing && (
        <ConfirmDialog
          message={`Remove “${removing.display_name}”? Their artworks keep the link until re-assigned (the record is soft-deleted server-side).`}
          okLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const a = removing;
            setRemoving(null);
            void remove(a);
          }}
        />
      )}
    </DeskPage>
  );
}

/** Create/edit — the fields the backend actually carries (name · birth year ·
 * nationality · intro · name variants). Variants bind as a comma-separated
 * line and store as the JSON list the serializer expects. */
function ArtistForm({
  existing,
  onClose,
  onSaved,
}: {
  existing: ArtistAdmin | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { catalogAdmin } = useApi();
  const [name, setName] = useState(existing?.display_name ?? '');
  const [birthYear, setBirthYear] = useState(
    existing?.birth_year == null ? '' : String(existing.birth_year),
  );
  const [nationality, setNationality] = useState(existing?.nationality ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');
  const [variants, setVariants] = useState(
    Array.isArray(existing?.name_variants)
      ? (existing.name_variants as string[]).join(', ')
      : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError('An artist needs a display name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        display_name: name.trim(),
        birth_year: birthYear.trim() === '' ? null : Number(birthYear),
        nationality: nationality.trim(),
        bio,
        name_variants: variants
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (existing) {
        await catalogAdmin.updateArtist(existing.id, {
          ...body,
          expected_version: existing.version,
        });
      } else {
        await catalogAdmin.createArtist(body);
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">{existing ? 'Edit artist' : 'New artist'}</div>
      <div className="ad-form-grid">
        <label className="ad-field">
          <span className="ad-filter-l">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!existing}
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Born · year</span>
          <input
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="e.g. 1968"
            inputMode="numeric"
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Nationality</span>
          <input value={nationality} onChange={(e) => setNationality(e.target.value)} />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Name variants · comma-separated</span>
          <input
            value={variants}
            onChange={(e) => setVariants(e.target.value)}
            placeholder="spellings imports may use"
          />
        </label>
        <label className="ad-field ad-field--wide">
          <span className="ad-filter-l">Introduction</span>
          <textarea
            rows={3}
            maxLength={240}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="One or two calm lines — who the artist is and why the work matters."
          />
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
          {existing ? 'Save artist' : 'Create artist'}
        </button>
      </div>
    </div>
  );
}
