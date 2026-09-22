/**
 * ClubPage — `/admin/club`, the Collector Club: named private selections
 * (`clubView()`, `darz-studio.html:33740`) over backend Phase 35's
 * `crm.CollectorSelection`.
 *
 * Ported card anatomy (`selCard`, `:33743-33759`): the **PRIVATE** badge, the
 * "{n} works" count, the selection's name, the invited-collector badges with
 * the old empty wording ("no collectors yet"), the note, the created date, and
 * Edit / Delete. The old card's cover image does not port — the nested
 * selection serializer carries `{id, title}` only, no image (recorded as
 * G-CLUB-1) — so the cover is the old fallback gradient, always.
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
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { CollectorSelection } from '../../api/types';
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
  const { crm } = useApi();
  const [selections, setSelections] = useState<CollectorSelection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CollectorSelection | null | 'new'>(null);
  const [deleting, setDeleting] = useState<CollectorSelection | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    crm.adminSelections({ per_page: 100 }).then(
      (page) => setSelections(page.results),
      (err: unknown) => setError(err instanceof Error ? err.message : 'Could not load.'),
    );
  }, [crm]);
  useEffect(load, [load]);
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
    >
      {error && <DeskBanner>{error}</DeskBanner>}
      {!selections && !error && <p className="dz-state">Loading…</p>}
      {selections?.length === 0 && !editing && (
        <p className="dz-state">No private selections yet.</p>
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
            {/* :33747 — no image in the serializer (G-CLUB-1), so always the
                old fallback gradient */}
            <div className="ad-clubtop">
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
          // the admin row has no artist object (G-CAT-1) — the raw name is
          // the label's best available prefix
          return page.results.map((a) => ({
            id: a.id,
            label: a.artist_name_raw ? `${a.artist_name_raw} — ${a.title}` : a.title,
          }));
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
