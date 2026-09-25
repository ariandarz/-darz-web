/**
 * ClubPage — `/admin/club`, the Collector Club: named private selections
 * (`clubView()`, `darz-studio.html:33740`) over backend Phase 35's
 * `crm.CollectorSelection`.
 *
 * Ported card anatomy (`selCard`, `:33743-33759`): the **PRIVATE** badge, the
 * "{n} works" count, the selection's name, the invited-collector badges with
 * the old empty wording ("no collectors yet"), the note, the created date, and
 * Edit / Delete, and the cover (`:33740-33741`): the FIRST work's image
 * (`works[0]`), else the old fallback gradient. Since G-CLUB-1 each nested
 * artwork carries `thumb`, so the cover is `artworks[0].thumb`.
 *
 * The editor is the old "New private selection" shape — name · note · pick
 * works · pick collectors — with search-backed pickers instead of the old
 * all-in-memory tile wall (the catalogue here is paginated; a wall of every
 * work does not survive that).
 *
 * **The grant-overlap rule matters and the desk must not lie about it**
 * (Phase 35, verified by a real backend test): saving syncs the underlying
 * per-(artwork, collector) grants, and removing a pair only revokes its grant
 * if no OTHER selection still wants it. So deleting a selection does not
 * necessarily un-curate a work for a collector — another selection may keep
 * it. The delete confirm says exactly that.
 *
 * **Compared against `14-collector-club`, 2026-09-22.** Three differences,
 * all recorded rather than built:
 *
 *  - **The sub-line is this app's, not the old one's, and deliberately.**
 *    `:33772` says a private selection shows "as a “Private — for you”
 *    section". That section does not exist in the collector app any more:
 *    `app.html:8890` records v669 REMOVING it, and curated works now reach a
 *    collector through the "Curated for You" chip on the catalogue
 *    (`docs/PHASE_24_35_PLAN.md` step 2). Porting the old sentence would
 *    describe a screen this port deliberately did not build.
 *  - ~~**The 3-tile strip**~~ (Private selections · Private auctions ·
 *    Collector keys, `:33774`) — **built 2026-09-22, G-CLUB-2 decided the
 *    same way G-4 was.** Two of the three: the selections this desk already
 *    loads, and the collector roster's count. "Private auctions" is left out
 *    because there is nothing to count, not because it costs a read — see
 *    `clubTiles.ts` and G-CLUB-3 below.
 *  - **The "Auction access" section and the "Private auctions" tile are not
 *    here yet — Phase 9, not a backend gap.** The old desk lists every auction
 *    with Public / "Make private…" and explains the badge (`:33779`), and
 *    counts auctions with private keys (`:33774`). Invite-only auctions DO
 *    exist now (G-CLUB-3 closed: `invite_only` + invited collectors) and are
 *    already wired on the auction's own page (`AuctionAdminDetailPage`,
 *    `…/invite-only/`). Rebuilding the Club's copy of that control is an
 *    owner-gated Phase 9 item (Q-5), so this desk does not duplicate it.
 *
 * **Whole list:** selections are walked page by page (`walkPages`) — the list
 * used to stop at one `per_page: 100` read with no pager (C-5's shape).
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import { MAX_PER_PAGE, walkPages } from '../../api/paging';
import type { CollectorSelection } from '../../api/types';
import { clubTiles, type ClubCounts } from './clubTiles';
import {
  ConfirmDialog,
  ConflictBanner,
  DeskAction,
  DeskBanner,
  DeskPage,
  DeskSave,
  DeskToast,
  Picker,
  isConflict,
  useDeskToast,
  type PickItem,
} from './kit';
import './admin.css';

export function ClubPage() {
  const { crm, adminAccounts } = useApi();
  const [selections, setSelections] = useState<CollectorSelection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CollectorSelection | null | 'new'>(null);
  const [deleting, setDeleting] = useState<CollectorSelection | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    walkPages((page) => crm.adminSelections({ page, per_page: MAX_PER_PAGE })).then(
      (all) => setSelections(all),
      (err: unknown) => setError(err instanceof Error ? err.message : 'Could not load.'),
    );
  }, [crm]);
  useEffect(load, [load]);

  /* The strip's two counts (`:33774`, G-CLUB-2). Selections come from the list
     this desk already holds — no second read for a number it has — and the
     roster is one `per_page: 1` call whose `total_count` is all that is
     wanted. A failed read stays `null` and the tile shows `—`. */
  const [keys, setKeys] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    adminAccounts
      .collectors({ per_page: 1 })
      .then((page) => alive && setKeys(page.pagination.total_count))
      .catch(() => alive && setKeys(null));
    return () => {
      alive = false;
    };
  }, [adminAccounts]);
  const counts: ClubCounts = { selections: selections?.length ?? null, keys };

  const { say, message } = useDeskToast();

  const remove = async (sel: CollectorSelection) => {
    setBusy(true);
    setError(null);
    try {
      await crm.deleteSelection(sel.id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DeskPage
      title="Collector Club"
      action={
        <DeskAction onClick={() => setEditing('new')}>＋ New private selection</DeskAction>
      }
      subtitle={
        <>
          A named selection grants its works to its collectors — they appear under “Curated for
          You” in the app. Two selections can share a work and a collector; a grant only lifts
          when no selection still wants it.
        </>
      }
      strip={
        /* `:33774`'s stat row, two of its three (G-CLUB-2 — `clubTiles.ts`).
           `.ad-tiles-sales` is the same narrow variant the Collectors strip
           uses; it is the shape the old row has, not a per-desk choice. */
        <div className="ad-tiles ad-tiles-sales">
          {clubTiles(counts).map((t) => (
            <div key={t.key} className="ad-tile">
              <span className="ad-tile-v">{t.value}</span>
              <span className="ad-tile-l">{t.label}</span>
            </div>
          ))}
        </div>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}
      {!selections && !error && <p className="dz-state">Loading…</p>}
      {selections?.length === 0 && !editing && (
        /* `:33777`, verbatim — this desk had shortened it to its first four
           words, dropping the half that tells a new owner what the feature
           is FOR. Restored 2026-09-22 against `14-collector-club`. */
        <p className="dz-state">
          No private selections yet. Tap <b>＋ New private selection</b>, pick a few works and
          invite the collectors who should feel they saw it first.
        </p>
      )}

      {editing && (
        <SelectionEditor
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(said) => {
            setEditing(null);
            load();
            say(said);
          }}
        />
      )}

      <div className="ad-clubgrid">
        {(selections ?? []).map((sel) => (
          <div key={sel.id} className="ad-clubcard">
            {/* :33740-33741 — the first work's image, else the old gradient
                (the CSS default); `thumb` since G-CLUB-1 */}
            <div
              className="ad-clubtop"
              style={
                sel.artworks[0]?.thumb
                  ? { backgroundImage: `url("${sel.artworks[0].thumb}")` }
                  : undefined
              }
            >
              <span className="ad-clubbadge">PRIVATE</span>
              <span className="ad-clubcnt">
                {sel.artworks.length} work{sel.artworks.length === 1 ? '' : 's'}
              </span>
              <div className="ad-clubtitle">{sel.name || 'Private selection'}</div>
            </div>
            <div className="ad-clubbody">
              <div>
                Invited:{' '}
                {sel.collectors.length ? (
                  sel.collectors.map((c) => (
                    <span key={c.id} className="ad-clubwho">
                      {c.display_name}
                    </span>
                  ))
                ) : (
                  /* :33756 — the old empty wording */
                  <span className="ad-cellsub">no collectors yet</span>
                )}
              </div>
              {sel.note && <div className="ad-clubnote">{sel.note}</div>}
              <div className="ad-cellsub">
                Created {new Date(sel.created_at).toLocaleDateString('en-GB')}
              </div>
            </div>
            <div className="ad-clubacts">
              <button type="button" className="ad-rowbtn" onClick={() => setEditing(sel)}>
                Edit
              </button>
              <button
                type="button"
                className="ad-rowbtn is-danger"
                onClick={() => setDeleting(sel)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {deleting && (
        <ConfirmDialog
          message={`Delete “${deleting.name}”? Its grants lift — except where another selection still wants the same work for the same collector.`}
          okLabel="Delete"
          danger
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const sel = deleting;
            setDeleting(null);
            void remove(sel);
          }}
        />
      )}

      <DeskToast message={message} />
    </DeskPage>
  );
}

/* ---- the editor ---------------------------------------------------------- */

function SelectionEditor({
  existing,
  onClose,
  onSaved,
}: {
  existing: CollectorSelection | null;
  onClose: () => void;
  /** Called with the words for the desk's toast, so the editor owns none. */
  onSaved: (said: string) => void;
}) {
  const { crm, catalogAdmin, adminAccounts } = useApi();
  const [name, setName] = useState(existing?.name ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [works, setWorks] = useState<PickItem[]>(
    () => existing?.artworks.map((a) => ({ id: a.id, label: a.title })) ?? [],
  );
  const [people, setPeople] = useState<PickItem[]>(
    () => existing?.collectors.map((c) => ({ id: c.id, label: c.display_name })) ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const save = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError('A selection needs a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        note,
        artwork_ids: works.map((w) => w.id),
        collector_ids: people.map((p) => p.id),
      };
      if (existing) {
        await crm.updateSelection(existing.id, {
          ...body,
          expected_version: existing.version,
        });
      } else {
        await crm.createSelection(body);
      }
      onSaved(existing ? 'Selection saved ✓' : 'Selection created ✓');
    } catch (err: unknown) {
      // Two curators editing the same selection: the grants the other one
      // added would be silently dropped by a retry, so say so (TD-5).
      if (isConflict(err)) setConflict(true);
      else setError(err instanceof Error ? err.message : 'Could not save.');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">
        {existing ? 'Edit private selection' : 'New private selection'}
      </div>
      <div className="ad-form-grid">
        <label className="ad-field">
          <span className="ad-filter-l">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!existing}
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Note · optional</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <Picker
        label="Works"
        placeholder="Search the catalogue — artist, title, medium…"
        picked={works}
        onChange={setWorks}
        search={async (q) => {
          const page = await catalogAdmin.artworks({ search: q, per_page: 8 });
          // the row's resolved artist name (G-CAT-1), else the raw legacy one
          return page.results.map((a) => {
            const artist = a.artist_name || a.artist_name_raw;
            return { id: a.id, label: artist ? `${artist} — ${a.title}` : a.title };
          });
        }}
      />
      <Picker
        label="Collectors"
        placeholder="Search collectors — name, email, phone…"
        picked={people}
        onChange={setPeople}
        search={async (q) => {
          const page = await adminAccounts.collectors({ search: q, per_page: 8 });
          return page.results.map((c) => ({ id: c.id, label: c.display_name }));
        }}
      />

      {conflict && (
        <ConflictBanner
          noun="selection"
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
          {existing ? 'Save selection' : 'Create selection'}
        </DeskSave>
      </div>
    </div>
  );
}
