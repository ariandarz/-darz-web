/**
 * ArtistsPage — `/admin/artists`, the Artists desk (`artistsView()`,
 * `darz-studio.html:33522`) over backend Phase 7's admin artists CRUD.
 *
 * Ported content:
 *  - the title, the search ("Search artists…", `:33583`) — now the server's
 *    `search` (G-CAT-3) — and the sort select (`:33587`) cut to the orderings
 *    the API serves: "Sort: Most works" (the old default, `works`) and
 *    "Sort: Name A–Z" (`name`);
 *  - the table's **Works** column (`:33599`/`:33571`) from the row's
 *    `works_count` — every non-deleted work, the old `r.works`;
 *  - the roster line "Showing n of m artists" (`:33596`): n is the search's
 *    match count, m the whole roster's (one `per_page: 1` read), as the old
 *    line counted the filtered rows against every artist;
 *  - the INLINE intro edit — the old one-line bio input on every row, "Type
 *    a one-line intro — saves instantly" (`:33576`) — here a real PATCH
 *    with the optimistic lock;
 *  - the empty copy "No artists yet — artists appear here automatically as
 *    artworks and records are added." (`:33607`) — trimmed of "and records":
 *    auction records are a later phase, and here artists are also created
 *    by hand (the roster is a real table, not a derivation).
 *
 * **Paged by the kit** (`ArtistsController` + `DeskList`): the roster is read
 * a page at a time with the kit's pager, not walked whole (C-5).
 *
 * **"Sort: Recently updated" (`:33587`) became "Sort: Recently added"** —
 * the API orders by `created`, not by update time, and a client-side sort of
 * one page would order that page only. Flagged for the owner.
 *
 * **Not ported, stated** (no server counterpart yet):
 *  - the "In app" count and the scope select (Has works · Has auction records
 *    · … · In the Market App, `:33585`) and the record-based sorts — the
 *    roster carries `works_count` only;
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
 *    Recorded here rather than built: the card face is three counts, and
 *    only one of them (`works_count`, the Works column since V1 Phase 4)
 *    has a server aggregate — a card would be a name, a count and two
 *    blanks.
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { ArtistAdmin, ArtistAdminQuery } from '../../api/types';
import { useListController } from '../shared/useListController';
import { ArtistsController } from './ArtistsController';
import {
  ConfirmDialog,
  ConflictBanner,
  DeskAction,
  DeskBanner,
  DeskList,
  DeskPage,
  DeskSave,
  DeskToast,
  SearchFilter,
  SelectFilter,
  isConflict,
  useDeskToast,
  type Column,
} from './kit';
import './admin.css';

/** `:33587`'s sort list, cut to what `ArtistAdminFilterSet` orders by. The
 * default ("Most works") is the select's "any" option — see the controller. */
const SORTS: Array<{ value: NonNullable<ArtistAdminQuery['ordering']>; label: string }> = [
  { value: 'name', label: 'Sort: Name A–Z' },
  { value: '-created', label: 'Sort: Recently added' },
];

export function ArtistsPage() {
  const { catalogAdmin } = useApi();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ArtistAdmin | null | 'new'>(null);
  const [removing, setRemoving] = useState<ArtistAdmin | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { say, message } = useDeskToast();

  const { state, setQuery, setPage, reload } = useListController<
    ArtistAdmin,
    ArtistAdminQuery
  >(() => new ArtistsController(catalogAdmin));

  /* "of m" — the whole roster, whatever the search. One `per_page: 1` read,
     re-read when a write may have changed it. `null` until known. */
  const [total, setTotal] = useState<number | null>(null);
  const loadTotal = useCallback(() => {
    catalogAdmin.artists({ per_page: 1 }).then(
      (page) => setTotal(page.pagination.total_count),
      () => setTotal(null),
    );
  }, [catalogAdmin]);
  useEffect(loadTotal, [loadTotal]);

  /** After a write: re-read the page (never merge a write's response into a
   * row — `works_count` is null on it, C-16) and the roster total. */
  const load = () => {
    void reload();
    loadTotal();
  };
  const shown = state.pagination?.total_count ?? state.results.length;

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
      // :33571 — the old table's Works cell, the row's `works_count` (list-only,
      // C-16; `—` if a row ever arrives without it).
      key: 'works',
      header: 'Works',
      cell: (a) => (a.works_count == null ? '—' : a.works_count.toLocaleString('en-US')),
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
          <SearchFilter
            label="Search"
            value={state.query.search}
            onChange={(search) => setQuery({ search })}
            placeholder="Search artists…"
          />
          <SelectFilter
            label="Sort"
            anyLabel="Sort: Most works"
            value={state.query.ordering === 'works' ? undefined : state.query.ordering}
            onChange={(ordering) =>
              setQuery({ ordering: (ordering ?? 'works') as ArtistAdminQuery['ordering'] })
            }
            choices={SORTS}
          />
        </>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}

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

      {state.pagination && (
        /* :33596 — n matches of m artists */
        <p className="ad-cellsub">
          Showing {shown} of {total ?? '…'} artist{total === 1 ? '' : 's'}
        </p>
      )}
      <DeskList
        label="Artists"
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(a) => a.id}
        busyKey={busyId}
        empty={
          state.query.search || total
            ? 'No artists match.'
            : 'No artists yet — artists appear here automatically as artworks are added.'
        }
      />

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
