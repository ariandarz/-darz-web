/**
 * ExhibitionsQueue — the third face of the Sources desk: every show across
 * every partner, opened on what needs Darz (`requested`), each row jumping
 * straight into the composer. The queue is how a portal submission becomes
 * desk work without anyone forwarding it.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { ExhibitionAdmin } from '../../api/types';
import { DeskBanner, Pager } from './kit';
import { choiceLabel, choices } from '../portal/portalForm';
import { exhibitionMetaLine } from './exhibitionForm';

export function ExhibitionsQueue({
  options,
  linkNames,
}: {
  options: OptionsMap | null;
  linkNames: Map<string, string>;
}) {
  const { galleryAdmin } = useApi();
  const navigate = useNavigate();
  const [status, setStatus] = useState('requested');
  const [rows, setRows] = useState<ExhibitionAdmin[] | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<
    Parameters<typeof Pager>[0]['pagination'] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    galleryAdmin.exhibitions({ request_status: status || undefined, page, per_page: 25 }).then(
      (p) => {
        setRows(p.results);
        setPagination(p.pagination);
      },
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the shows.'),
    );
  }, [galleryAdmin, status, page]);
  useEffect(load, [load]);

  const statuses = choices(options, 'gallery.exhibition_request_status');

  return (
    <>
      <div className="ad-toolbar">
        <label className="ad-filter">
          <span className="ad-filter-l">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
            <option value="">All</option>
          </select>
        </label>
      </div>

      {error && <DeskBanner>{error}</DeskBanner>}
      {!rows && !error && <p className="dz-state">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="dz-state">
          {status === 'requested'
            ? 'Nothing waiting — no show is asking for a package.'
            : 'No shows here.'}
        </p>
      )}

      {rows &&
        rows.map((ev) => (
          <button
            key={ev.id}
            type="button"
            className="ad-card ad-updrow ad-exhrow"
            onClick={() => navigate(`/admin/sources/${ev.link}/exhibitions/${ev.id}`)}
          >
            <div className="ad-updmain">
              <span className="ad-cellmain">
                {linkNames.get(ev.link) ?? 'A partner'} · {ev.title || 'Untitled show'}
              </span>
              <span className="ad-cellsub">
                {exhibitionMetaLine(ev)} ·{' '}
                {ev.service_lines.length
                  ? `${ev.service_lines.length} composed line${ev.service_lines.length === 1 ? '' : 's'}`
                  : `${ev.gallery_selected.length} service${ev.gallery_selected.length === 1 ? '' : 's'} ticked`}
              </span>
            </div>
            <span className="ad-rowacts">
              {ev.published && <span className="ad-stpill is-ok">on the portal</span>}
              <span
                className={`ad-stpill is-${ev.request_status === 'approved' ? 'ok' : ev.request_status === 'rejected' ? 'gone' : ev.request_status === 'requested' ? 'res' : 'neut'}`}
              >
                {choiceLabel(options, 'gallery.exhibition_request_status', ev.request_status)}
              </span>
            </span>
          </button>
        ))}

      {pagination && <Pager pagination={pagination} onPage={setPage} />}
    </>
  );
}
