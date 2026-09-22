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
 *  - **the Cards / Table segment** (`viewSeg`, `:33592`), found 2026-09-22
 *    against `03-artists`. The old desk defaults to a CARD per artist —
 *    avatar, name, three counts, Open / Profile — with Table as the
 *    alternative; this desk is the table only. It is the same shape the
 *    Collectors desk has, where the owner ruled **G-4**: keep the table.
 *    Recorded here rather than built, because the card face is mostly the
 *    three counts above, which have no server aggregate (G-CAT-3) — a card
 *    here would be a name and two zeroes.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { ArtistAdmin } from '../../api/types';
import {
  ConfirmDialog,
  ConflictBanner,
  DeskAction,
  DeskBanner,
  DeskPage,
  DeskSave,
  DeskToast,
  DataTable,
  isConflict,
  useDeskToast,
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
  const { say, message } = useDeskToast();

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
      say('Intro saved ✓');
    } catch (err: unknown) {
      // The reload was already right — it is the sentence that was generic.
      // A 409 here means the roster on screen is behind, not that the intro
      // was bad, and the reload below is the fix rather than a retry (TD-5).
      setError(
        isConflict(err)
          ? 'Someone else saved this artist in the meantime — the roster has been reloaded.'
          : err instanceof Error
            ? err.message
            : 'Could not save the intro.',
      );
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
      subtitle={
        /* `:33593`'s line under the heading, which this desk had dropped
           entirely — found 2026-09-22 comparing against `03-artists`.
           It is not portable verbatim: three of its four sentences describe
           the features listed as "not ported" above. Ported is the half that
           is TRUE here — what the roster holds, and that the intro edits
           inline. Dropped, each for the reason already stated above: the
           auction-record clause and its "tap a record count" (the auctions
           phase's), "and profile status" (no such field, G-ART-1), and the
           whole Published-profile sentence, which would tell an admin their
           artists are hidden from collectors when in fact every row is
           servable today. */
        <>
          Every artist in your catalogue — each one’s works and Market-App works. Edit the
          intro inline; tap the name or Edit for the full card.
        </>
      }
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
          onSaved={(said) => {
            setEditing(null);
            load();
            say(said);
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

      <DeskToast message={message} />
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
  /** Called with the words for the desk's toast, so the form does not own one. */
  onSaved: (said: string) => void;
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
  const [conflict, setConflict] = useState(false);

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
      onSaved(existing ? 'Artist saved ✓' : 'Artist created ✓');
    } catch (err: unknown) {
      if (isConflict(err)) setConflict(true);
      else setError(err instanceof Error ? err.message : 'Could not save.');
      throw err;
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
      {conflict && (
        <ConflictBanner
          noun="artist"
          onReload={() => {
            setConflict(false);
            onClose();
          }}
        />
      )}
      {error && (
        <p className="dz-state err" role="alert">
          {error}
        </p>
      )}
      <div className="ad-form-a">
        <button type="button" className="ad-ghostbtn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <DeskSave className="ad-action" busy={busy} onClick={save}>
          {existing ? 'Save artist' : 'Create artist'}
        </DeskSave>
      </div>
    </div>
  );
}
