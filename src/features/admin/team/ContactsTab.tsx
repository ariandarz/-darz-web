/**
 * Contacts & follow-ups — the owner's mini-CRM (`_contactsTabHTML` + `_ctCard`,
 * `darz-studio.html:19349-19370`) over `/workspace/contacts/` (owner-only,
 * G-TEAM-1 W3). The shell wraps it in `RequireOwner`.
 *
 * Ported as the old desk draws it: three tiles, the add row, then a card per
 * contact — name and priority in the head, company, phone · email, the two
 * date pills, notes, and "Remove contact", the card's left edge in its
 * priority colour.
 *
 * Order is the server's: the list is served high→med→low, then soonest
 * follow-up — the old desk's own sort (`:19368`) — and rendered exactly as
 * served. So an edit that can move a card (its priority, its next follow-up,
 * a new contact) re-reads the list instead of re-sorting here; any other edit
 * just takes the saved row.
 *
 * The one addition is the backend's: a contact MAY be linked to a collector or
 * an artist (`{id, display_name}`). When it is, the card carries a "jump to"
 * line; when it is not, nothing shows — neither link is ever required. Setting
 * a link is not in this desk yet (the old card had no such control); the API
 * takes it as a uuid on create/PATCH.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useOptions } from '../../../api/hooks';
import type { ContactPatch, ContactPriority, WorkspaceContact } from '../../../api/types';
import { useListController } from '../../shared/useListController';
import { ConfirmDialog, ConflictBanner, DeskBanner, deskBanner } from '../kit';
import { choices } from '../saleForm';
import { ContactsController } from './controllers';
import { ChoiceSelect, DuePill, InlineText } from './fields';
import { useRowWrites } from './useRowWrites';
import { DEFAULT_PRIORITY, contactTiles, startOfToday } from './workspace';

/** The fields whose change can move the card in the served order. */
const REORDERS: ReadonlyArray<keyof ContactPatch> = ['priority', 'next_followup'];

export function ContactsTab({
  refreshKey,
  say,
}: {
  refreshKey: number;
  say: (message: string) => void;
}) {
  const { workspace } = useApi();
  const options = useOptions();
  const priorities = choices(options, 'workspace.contact_priority');

  const [ctrl] = useState(() => new ContactsController(workspace));
  const { state, reload } = useListController(() => ctrl);
  const writes = useRowWrites();

  const lastKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey === lastKey.current) return;
    lastKey.current = refreshKey;
    void ctrl.reload();
  }, [refreshKey, ctrl]);

  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<WorkspaceContact | null>(null);

  const today = startOfToday();
  const contacts = state.results;
  const tiles = contactTiles(contacts, today);

  const current = (id: string) => ctrl.getSnapshot().results.find((r) => r.id === id);

  const patch = async (id: string, body: Omit<ContactPatch, 'expected_version'>) => {
    const row = current(id);
    if (!row) return;
    const saved = await writes.run(() =>
      workspace.updateContact(id, { ...body, expected_version: row.version }),
    );
    if (!saved) return;
    ctrl.put(saved);
    if (REORDERS.some((k) => k in body)) void ctrl.reload();
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) {
      say('Enter a name');
      return;
    }
    if (adding) return;
    setAdding(true);
    const saved = await writes.run(() =>
      workspace.createContact({ name, company: newCompany.trim() }),
    );
    setAdding(false);
    if (saved) {
      setNewName('');
      setNewCompany('');
      void ctrl.reload(); // the server decides where it goes
    }
  };

  const remove = async (c: WorkspaceContact) => {
    const ok = await writes.run(() => workspace.deleteContact(c.id).then(() => true));
    if (ok) ctrl.drop(c.id);
  };

  // `_wsStat(n, label, '')` — no filter behind these, so not a control
  const tile = (n: number, text: string, accent?: string) => (
    <div className={`ws-stat is-static${accent ? ` ${accent}` : ''}`}>
      <div className="ws-stat-n">{n}</div>
      <div className="ws-stat-l">{text}</div>
    </div>
  );

  const banner = deskBanner(state.status, state.error, writes.error);

  return (
    <>
      <div className="ws-stats is-3">
        {tile(tiles.total, 'Contacts')}
        {tile(tiles.dueSoon, 'Follow-ups due', 'due')}
        {tile(tiles.high, 'High priority', 'warn')}
      </div>

      <div className="ws-add">
        <input
          className="ws-addinput"
          placeholder="Add a contact — type a name, then Enter"
          aria-label="New contact name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
          }}
        />
        <input
          className="ws-sel is-field"
          placeholder="Company"
          aria-label="New contact company"
          value={newCompany}
          onChange={(e) => setNewCompany(e.target.value)}
        />
        <button
          type="button"
          className="ws-addbtn"
          disabled={adding}
          onClick={() => void add()}
        >
          Add
        </button>
      </div>

      {writes.conflict && (
        <ConflictBanner
          noun="contact"
          onReload={() => {
            writes.clear();
            void reload();
          }}
        />
      )}
      {banner && <DeskBanner>{banner}</DeskBanner>}

      {state.status === 'loading' && contacts.length === 0 ? (
        <p className="dz-state">Loading…</p>
      ) : contacts.length > 0 ? (
        <div className="ws-cgrid">
          {contacts.map((c) => {
            const pri: ContactPriority = c.priority ?? DEFAULT_PRIORITY;
            const v = c.version;
            return (
              <div className={`ws-contact pri-${pri}`} key={c.id}>
                <div className="ws-c-head">
                  <InlineText
                    key={`n${v}`}
                    className="ws-c-name"
                    label="Name"
                    placeholder="Name"
                    value={c.name ?? ''}
                    onCommit={(name) => void patch(c.id, { name })}
                  />
                  <ChoiceSelect
                    className="ws-c-pri"
                    label="Priority"
                    value={pri}
                    choices={priorities}
                    onChange={(p) => void patch(c.id, { priority: p as ContactPriority })}
                  />
                </div>
                <InlineText
                  key={`c${v}`}
                  className="ws-c-f"
                  label="Company / role"
                  placeholder="Company / role"
                  value={c.company ?? ''}
                  onCommit={(company) => void patch(c.id, { company })}
                />
                <div className="ws-qa-row">
                  <InlineText
                    key={`p${v}`}
                    className="ws-c-f"
                    label="Phone"
                    placeholder="Phone"
                    value={c.phone ?? ''}
                    onCommit={(phone) => void patch(c.id, { phone })}
                  />
                  <InlineText
                    key={`e${v}`}
                    className="ws-c-f"
                    label="Email"
                    placeholder="Email"
                    value={c.email ?? ''}
                    onCommit={(email) => void patch(c.id, { email })}
                  />
                </div>
                <div className="ws-c-dates">
                  <div>
                    <div className="ws-c-dlab">Last contact</div>
                    <DuePill
                      date={c.last_contact}
                      placeholder="Set"
                      label="Last contact"
                      today={today}
                      onChange={(last_contact) => void patch(c.id, { last_contact })}
                    />
                  </div>
                  <div>
                    <div className="ws-c-dlab">Next follow-up</div>
                    <DuePill
                      date={c.next_followup}
                      placeholder="Set"
                      label="Next follow-up"
                      today={today}
                      onChange={(next_followup) => void patch(c.id, { next_followup })}
                    />
                  </div>
                </div>
                {(c.collector || c.artist) && (
                  <div className="ws-c-link">
                    {c.collector && (
                      <>
                        Collector ·{' '}
                        <Link to={`/admin/collectors/${c.collector.id}`}>
                          {c.collector.display_name}
                        </Link>
                      </>
                    )}
                    {c.collector && c.artist && ' · '}
                    {c.artist && (
                      <>
                        Artist ·{' '}
                        <Link to={`/artists/${c.artist.id}`}>{c.artist.display_name}</Link>
                      </>
                    )}
                  </div>
                )}
                <InlineText
                  key={`o${v}`}
                  multiline
                  className="ws-c-f ws-c-notes"
                  label="Notes"
                  placeholder="Notes…"
                  value={c.notes ?? ''}
                  onCommit={(notes) => void patch(c.id, { notes })}
                />
                <button type="button" className="ws-c-del" onClick={() => setRemoving(c)}>
                  Remove contact
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ws-empty">
          No contacts yet. Add collectors, artists, partners or leads above — and set when you
          next mean to reach them.
        </div>
      )}

      {removing && (
        <ConfirmDialog
          message="Remove this contact?"
          okLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const c = removing;
            setRemoving(null);
            void remove(c);
          }}
        />
      )}
    </>
  );
}
