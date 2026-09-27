/**
 * ExhibitionServicesPage — `/admin/exhibition-services`.
 *
 * One list: what Darz offers a gallery, and what each one costs. Its own
 * section because it is the price list every proposal and invoice is built
 * from, and an owner should reach it in one click rather than three tabs deep
 * inside Projects.
 *
 * Deliberately small: name · description · price, edit in place, add a line.
 * The description is the row's own (`description`, G-PROJ-8), read and
 * written through the API — no local name → text map.
 * No categories, no units matrix, no margin columns — those belong to the
 * Projects desk, which still reads the same rows. Editing here is the whole
 * point (prices are expected to change), so the edit is inline rather than a
 * page of its own.
 *
 * Programmes are listed under the services, read-only, so an owner can see
 * what a package puts on a document before choosing it there.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useOptions } from '../../../api/hooks';
import type {
  PackageTemplateAdmin,
  ServiceCatalogItemAdmin,
  ServiceCategory,
} from '../../../api/types';
import { ConfirmDialog, DeskAction, DeskBanner, DeskPage, SearchFilter } from '../kit';
import { choiceLabel } from '../../portal/portalForm';
import { group, num } from './issueForm';
import {
  groupServices,
  libraryCurrency,
  search,
  serviceNotes,
  toLibrary,
  toPackages,
  withQuantities,
  type LibraryService,
} from './servicesLibrary';
import { walkPages } from '../../../api/paging';
import './exhibitions.css';

export function ExhibitionServicesPage() {
  const { projectsAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const [rows, setRows] = useState<ServiceCatalogItemAdmin[] | null>(null);
  const [packageRows, setPackageRows] = useState<PackageTemplateAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [removing, setRemoving] = useState<LibraryService | null>(null);
  /** The bulk pricing pass: id -> the price as typed. null = not in it. */
  const [pass, setPass] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      walkPages((page) => projectsAdmin.services({ page, per_page: 100 })),
      walkPages((page) => projectsAdmin.packages({ page, per_page: 100 })),
    ]).then(
      ([s, p]) => {
        setRows(s);
        setPackageRows(p);
      },
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the services.'),
    );
  }, [projectsAdmin]);
  useEffect(load, [load]);

  const services = useMemo(() => toLibrary(rows ?? []), [rows]);
  const packages = useMemo(
    () => toPackages(packageRows ?? [], services),
    [packageRows, services],
  );
  const shown = useMemo(() => search(services, query), [services, query]);
  // Folded into their programmes: 27 services in one column is a screen you
  // scroll rather than read. A search opens every group that matches, because
  // hiding a hit behind a closed fold is worse than a long list.
  const groups = useMemo(() => groupServices(shown), [shown]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const isOpen = (title: string) => !!query || open.has(title);
  const toggle = (title: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  const currency = libraryCurrency(services, 'TMN');
  const currencyLabel = choiceLabel(options, 'currency', currency) || currency;
  const unpricedRows = useMemo(() => services.filter((x) => x.price === null), [services]);
  const unpriced = unpricedRows.length;

  const save = async (draft: {
    id?: string;
    version?: number;
    name: string;
    description: string;
    price: string;
  }) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const price = draft.price.trim() === '' ? '0' : String(num(draft.price));
      if (draft.id) {
        await projectsAdmin.updateService(draft.id, {
          name: draft.name.trim(),
          description: draft.description.trim(),
          price,
          expected_version: draft.version ?? 0,
        });
      } else {
        await projectsAdmin.createService({
          name: draft.name.trim(),
          description: draft.description.trim(),
          price,
          currency: currency as ServiceCatalogItemAdmin['currency'],
          unit: 'piece',
          internal_cost: '0',
          category: 'media' as ServiceCategory,
        });
      }
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * The pricing pass writes only the rows actually typed into, one at a time,
   * so a rejection names the service it happened on and everything before it
   * still stands. Pressing Save again carries on from there — the rows that
   * landed are no longer unpriced, so they are not in the pass any more.
   */
  const savePass = async () => {
    if (!pass || busy) return;
    const todo = unpricedRows.filter(
      (x) => (pass[x.id] ?? '').trim() !== '' && num(pass[x.id]) > 0,
    );
    if (!todo.length) {
      setPass(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const x of todo) {
        setSaving(`Pricing ${x.name}…`);
        await projectsAdmin.updateService(x.id, {
          price: String(num(pass[x.id])),
          expected_version: x.version,
        });
      }
      setPass(null);
      load();
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : 'That did not save.') +
          ' The prices before it were saved — press Save again to carry on.',
      );
      load();
    } finally {
      setSaving('');
      setBusy(false);
    }
  };

  const remove = async (s: LibraryService) => {
    setBusy(true);
    setError(null);
    try {
      await projectsAdmin.deleteService(s.id);
      setRemoving(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not delete.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DeskPage
      title="Exhibition Services"
      action={<DeskAction onClick={() => setEditing('new')}>＋ Add a service</DeskAction>}
      toolbar={
        <SearchFilter
          label="Find a service"
          placeholder="Name or what it covers…"
          value={query}
          onChange={(v) => setQuery(v ?? '')}
        />
      }
      subtitle={
        <>
          What Darz offers a gallery, and what each one costs. Every proposal and invoice is
          built from this list — change a price here and the next document follows.
        </>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}

      {editing === 'new' && (
        <ServiceEditor
          currencyLabel={currencyLabel}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={(name, description, price) => void save({ name, description, price })}
        />
      )}

      {!rows && !error && <p className="dz-state">Loading…</p>}
      {rows && shown.length === 0 && (
        <p className="dz-state">
          {query ? `Nothing matches “${query.trim()}”.` : 'No services yet — add the first.'}
        </p>
      )}

      {groups.length > 0 && (
        <div className="dzx-groups">
          {groups.map((g) => (
            <section className="dzx-group" key={g.title}>
              <button
                type="button"
                className="dzx-grouph"
                aria-expanded={isOpen(g.title)}
                onClick={() => toggle(g.title)}
              >
                <span className={`dzx-caret${isOpen(g.title) ? ' is-open' : ''}`} aria-hidden>
                  ▸
                </span>
                <span className="dzx-groupt">{g.title}</span>
                <span className="dzx-mut">
                  {g.services.length} service{g.services.length === 1 ? '' : 's'}
                  {g.services.some((x) => x.price === null)
                    ? ` · ${g.services.filter((x) => x.price === null).length} unpriced`
                    : ''}
                </span>
              </button>
              {isOpen(g.title) && (
                <div className="dzx-list">
                  {g.services.map((sv) =>
                    editing === sv.id ? (
                      <ServiceEditor
                        key={sv.id}
                        service={sv}
                        currencyLabel={currencyLabel}
                        busy={busy}
                        onCancel={() => setEditing(null)}
                        onSave={(name, description, price) =>
                          void save({
                            id: sv.id,
                            version: sv.version,
                            name,
                            description,
                            price,
                          })
                        }
                      />
                    ) : (
                      <ServiceRow
                        key={sv.id}
                        service={sv}
                        currency={currency}
                        onEdit={() => setEditing(sv.id)}
                        onRemove={() => setRemoving(sv)}
                      />
                    ),
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Pricing twenty services one Edit at a time is sixty clicks. This is
          one pass: every unpriced service in a column, type down it, save
          once. Only the ones actually typed into are written. */}
      {rows && unpriced > 0 && !pass && (
        <p className="dzx-note">
          {unpriced} {unpriced === 1 ? 'service is' : 'services are'} not priced yet — they
          read “quoted per show” on a document until you set a price. A price of 0 is stored as
          not priced, never as free.{' '}
          <button
            type="button"
            className="ad-ghostbtn"
            onClick={() => setPass(Object.fromEntries(unpricedRows.map((x) => [x.id, ''])))}
          >
            Price them all in one pass →
          </button>
        </p>
      )}

      {pass && (
        <PricingPass
          services={unpricedRows}
          values={pass}
          currencyLabel={currencyLabel}
          busy={busy}
          saving={saving}
          onChange={(id, v) => setPass({ ...pass, [id]: v })}
          onCancel={() => setPass(null)}
          onSave={() => void savePass()}
        />
      )}

      {packages.length > 0 && (
        <section className="dzx-sec">
          <h2 className="dzx-sect">Packages</h2>
          {/* not `.ad-desksub`: its negative top margin is for a line sitting
              directly under a page title, and here it rode up over the heading */}
          <p className="dzx-sub">
            A named set of services. Choosing one on a document adds every service in it, with
            its price — you can still adjust each line afterwards.
          </p>
          <div className="dzx-list">
            {packages.map((p) => (
              <div className="dzx-pkg" key={p.id}>
                <div className="dzx-pkgh">
                  <b>{p.name}</b>
                  <span className="dzx-mut">
                    {p.services.length} service{p.services.length === 1 ? '' : 's'}
                    {p.missing > 0 ? ` · ${p.missing} no longer in the list` : ''}
                  </span>
                </div>
                <div className="dzx-mut">
                  {withQuantities(p.services)
                    .map((o) => (o.qty > 1 ? `${o.qty} × ${o.service.name}` : o.service.name))
                    .join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="dzx-note">
        A service’s description is what its document line prints — edit it here and the next
        document follows.{' '}
        <button type="button" className="ad-ghostbtn" onClick={() => navigate('/admin/issue')}>
          Issue a document →
        </button>
      </p>

      {removing && (
        <ConfirmDialog
          message={`Delete “${removing.name}” from the list? Documents already issued keep their own copy of it.`}
          okLabel="Delete"
          danger
          busy={busy}
          onConfirm={() => void remove(removing)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </DeskPage>
  );
}

/**
 * Every unpriced service in one column. Typing down it and saving once is the
 * difference between one pass and sixty clicks — and a blank stays blank, so
 * a half-finished pass prices what was filled and leaves the rest alone.
 */
function PricingPass({
  services,
  values,
  currencyLabel,
  busy,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  services: LibraryService[];
  values: Record<string, string>;
  currencyLabel: string;
  busy: boolean;
  saving: string;
  onChange: (id: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const filled = services.filter((s) => (values[s.id] ?? '').trim() !== '').length;
  return (
    <section className="dzx-pass">
      <div className="dzx-passh">
        <b>Price them all</b>
        <span className="dzx-mut">
          in {currencyLabel} · leave one blank to keep it quoted per show
        </span>
      </div>
      <div className="dzx-list">
        {services.map((s) => (
          <div className="dzx-row" key={s.id}>
            <div className="dzx-rowmain">
              <div className="dzx-rowt">{s.name}</div>
              {s.description && <div className="dzx-rowd">{s.description}</div>}
            </div>
            <div className="dzx-rowp">
              <input
                className="dzx-input dzx-price"
                aria-label={`Price for ${s.name}`}
                inputMode="numeric"
                placeholder="Quoted per show"
                value={values[s.id] ?? ''}
                onChange={(e) => onChange(s.id, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="ad-rowacts" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="ad-rowbtn is-primary"
          disabled={busy || filled === 0}
          onClick={onSave}
        >
          {busy
            ? saving || 'Saving…'
            : `Save ${filled || 'no'} price${filled === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="ad-rowbtn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function ServiceRow({
  service,
  currency,
  onEdit,
  onRemove,
}: {
  service: LibraryService;
  currency: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const notes = serviceNotes(service.name);
  return (
    <div className="dzx-row">
      <div className="dzx-rowmain">
        <div className="dzx-rowt">{service.name}</div>
        {service.description && <div className="dzx-rowd">{service.description}</div>}
        {(notes.time || notes.need) && (
          <div className="dzx-mut">{[notes.time, notes.need].filter(Boolean).join(' · ')}</div>
        )}
      </div>
      <div className="dzx-rowp">
        {service.price === null ? (
          <span className="dzx-mut">quoted per show</span>
        ) : (
          <b>
            {group(service.price)} {service.currency || currency}
          </b>
        )}
      </div>
      <div className="dzx-rowacts">
        <button type="button" className="ad-rowbtn" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="ad-rowbtn is-danger" onClick={onRemove}>
          ✕
        </button>
      </div>
    </div>
  );
}

function ServiceEditor({
  service,
  currencyLabel,
  busy,
  onSave,
  onCancel,
}: {
  service?: LibraryService;
  currencyLabel: string;
  busy: boolean;
  onSave: (name: string, description: string, price: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(
    service?.price === null ? '' : String(service?.price ?? ''),
  );
  return (
    <div className="dzx-row is-editing">
      <div className="dzx-rowmain">
        <input
          className="dzx-input"
          aria-label="Service name"
          placeholder="What the service is called"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <textarea
          className="dzx-input"
          aria-label="Service description"
          placeholder="What it covers — printed on the document line"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="dzx-rowp">
        <input
          className="dzx-input dzx-price"
          aria-label="Price"
          inputMode="numeric"
          placeholder="Not priced"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <span className="dzx-mut">{currencyLabel}</span>
      </div>
      <div className="dzx-rowacts">
        <button
          type="button"
          className="ad-rowbtn is-primary"
          disabled={busy || !name.trim()}
          onClick={() => onSave(name, description, price)}
        >
          Save
        </button>
        <button type="button" className="ad-rowbtn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
