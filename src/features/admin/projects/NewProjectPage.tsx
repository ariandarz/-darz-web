/**
 * NewProjectPage — `/admin/projects/new`, the old "New project" modal
 * (`DZProjects.newProject` / `saveNewProject`, `darz-studio.html:13722-13753`)
 * as a route over `POST /projects/admin/projects/`.
 *
 * Ported content:
 *  - the nine fields (:13728-13736) with their labels and placeholders, in
 *    the old `.dzp-form` grid: Project name (full width), Client (linked),
 *    Or client name, Category, Main contact, Venue / show, City, Start date,
 *    End date;
 *  - the Client (linked) menu (:13723-13724): "— none / free text —" then
 *    every partner org as "name (kind)";
 *  - Cancel / Create project (:13738), the one validation "Give the project
 *    a name" (:13741), and the client-name rule (:13743): the typed name,
 *    or the picked org's name when nothing was typed;
 *  - on success the record opens with the toast's line (:13752) — passed as
 *    `location.state.note` for `/admin/projects/:id` to show.
 *
 * What changed for the new backend:
 *  - the old menu also listed the collector app's galleries (:13296); the
 *    API's client link is a partner org only (`client_partner_org`), so the
 *    menu is `GET /partners/` — a gallery is typed as free text until it is
 *    also a partner org;
 *  - the old record's defaults (number, stage `lead`, status `New Lead`,
 *    empty money/deliverables/…, :13743-13751) are the server's now — the
 *    page sends only what was typed;
 *  - the category default is the first `projects.category` choice (the old
 *    `|| 'media'` was the first PROJ_CATS entry too, :13744);
 *  - the toast (`Lib.toast`, :13741) is the desk banner.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useOptions } from '../../../api/hooks';
import type { PartnerOrgAdmin, ProjectCategory, ProjectCreateInput } from '../../../api/types';
import { DeskBanner, DeskPage } from '../kit';
import { choices } from './projectForm';
import '../admin.css';

export function NewProjectPage() {
  const { projectsAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();
  const categories = choices(options, 'projects.category');

  // the Client (linked) menu — `projClientOptions()` (:13723), partner orgs
  // only here; `more` says whether a page-size cap left some out
  const [partners, setPartners] = useState<{ rows: PartnerOrgAdmin[]; more: boolean } | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    projectsAdmin.partners({ per_page: 100 }).then(
      (page) => alive && setPartners({ rows: page.results, more: page.pagination.has_next }),
      () => alive && setPartners({ rows: [], more: false }), // free text still works
    );
    return () => {
      alive = false;
    };
  }, [projectsAdmin]);

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [category, setCategory] = useState('');
  const [contact, setContact] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // the first category is the default until one is picked (:13744)
  const categoryValue = category || categories[0]?.value || '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the project a name'); // :13741
      return;
    }
    setError(null);
    setBusy(true);
    // :13743 — the typed client name, else the picked org's name
    const picked = partners?.rows.find((o) => o.id === clientId);
    const body: ProjectCreateInput = {
      name: trimmed,
      client_partner_org: clientId || null,
      client_name: clientName.trim() || picked?.name || '',
      contact: contact.trim(),
      venue: venue.trim(),
      city: city.trim(),
      start_date: start || null,
      end_date: end || null,
    };
    if (categories.some((c) => c.value === categoryValue))
      body.category = categoryValue as ProjectCategory;
    try {
      const created = await projectsAdmin.createProject(body);
      // :13752 — open the record with the toast's line
      navigate(`/admin/projects/${created.id}`, {
        state: { note: `Project ${created.no} created` },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create the project.');
      setBusy(false);
    }
  };

  return (
    <DeskPage title="New project">
      {error && <DeskBanner>{error}</DeskBanner>}
      <form className="dzp" onSubmit={(e) => void submit(e)} noValidate>
        {/* :13727-13737 */}
        <div className="dzp-form">
          <label className="full">
            <span className="fl">Project name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 13 Vanak · media partnership"
            />
          </label>
          <label>
            <span className="fl">Client (linked)</span>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— none / free text —</option>
              {partners?.rows.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.kind || 'org'})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="fl">Or client name</span>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="If not linked yet"
            />
          </label>
          <label>
            <span className="fl">Category</span>
            <select value={categoryValue} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="fl">Main contact</span>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Contact person"
            />
          </label>
          <label>
            <span className="fl">Venue / show</span>
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Free text or venue"
            />
          </label>
          <label>
            <span className="fl">City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
          </label>
          <label>
            <span className="fl">Start date</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            <span className="fl">End date</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        {partners?.more && (
          <p className="dzp-mut" role="note">
            Showing the first 100 partner orgs in the Client menu — type the name instead if
            yours is not listed.
          </p>
        )}

        {/* :13738 */}
        <div className="dzp-acts">
          <button type="button" className="dzp-btn gho" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="dzp-btn pri" disabled={busy}>
            Create project
          </button>
        </div>
      </form>
    </DeskPage>
  );
}
