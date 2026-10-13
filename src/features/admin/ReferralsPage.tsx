/**
 * ReferralsPage — `/admin/referrals`, "Introductions": the review desk for the
 * leads partners send from their portal's Introduce tab (G-PORT-5,
 * `GET /gallery/admin/referrals/` + `POST …/{id}/review/`).
 *
 * **No old source.** The old panel never had this desk: its portal "Share" tab
 * handed out a `?ref=` link, and a lead arrived as an access request carrying
 * the gallery in its `ref_code` (still read by the Access Requests desk). The
 * backend's answer to D7 is a logged lead with a desk, so this one is built
 * from the panel's own parts — the Source Updates queue's card rows and
 * reviewed-diff lines (`.ad-updrow`, `.ad-revrow`), its status filter, and the
 * pricelist desk's "Mark …" buttons — rather than invented. Flagged.
 *
 * What reviewing does, said plainly on the desk: it sets the status and
 * nothing else (`PortalReferralService.review`). No invite goes out and no
 * collector is created; the admin follows up by hand. Kind and status labels
 * read `/api/options/` under the keys the backend would register — it
 * registers neither today, so the raw-value fallback shows, which is exactly
 * the model's own label.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { PortalReferral, PortalReferralStatus } from '../../api/types';
import { DeskBanner, DeskPage, Pager } from './kit';
import { choiceLabel, fmtDateTime } from '../portal/portalForm';
import './admin.css';

/** `PortalReferral.STATUS_CHOICES`, typed against the schema enum. */
const STATUSES: readonly PortalReferralStatus[] = ['new', 'reviewed', 'accepted', 'declined'];
/** What a review may set — a lead never goes back to `new` from the desk. */
const VERDICTS: readonly PortalReferralStatus[] = ['reviewed', 'accepted', 'declined'];

function tone(st: string): 'ok' | 'gone' | 'neut' {
  if (st === 'accepted') return 'ok';
  if (st === 'declined') return 'gone';
  return 'neut';
}

export function ReferralsPage() {
  const { galleryAdmin } = useApi();
  const options = useOptions();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? 'new') as PortalReferralStatus | '';
  const link = params.get('link') ?? '';
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PortalReferral[] | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [partners, setPartners] = useState<Array<{ id: string; name: string }>>([]);

  const load = useCallback(() => {
    galleryAdmin
      .referrals({ status: status || undefined, link: link || undefined, page, per_page: 25 })
      .then(
        (p) => {
          setRows(p.results);
          setPagination(p.pagination);
        },
        (err: unknown) =>
          setError(err instanceof Error ? err.message : 'Could not load the introductions.'),
      );
  }, [galleryAdmin, status, link, page]);
  useEffect(load, [load]);

  // the partner filter's names (one page — the Sources desk's own limit)
  useEffect(() => {
    let alive = true;
    galleryAdmin.links({ per_page: 100 }).then(
      (p) => alive && setPartners(p.results.map((l) => ({ id: l.id, name: l.name }))),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [galleryAdmin]);

  const setFilter = (key: 'status' | 'link', value: string) => {
    const next = new URLSearchParams(params);
    // `status` defaults to new, so "All" has to be said out loud
    if (key === 'status') next.set('status', value);
    else if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
    setPage(1);
  };

  const review = async (r: PortalReferral, verdict: PortalReferralStatus) => {
    setBusyId(r.id);
    setError(null);
    try {
      await galleryAdmin.reviewReferral(r.id, verdict);
      load(); // the row may now fall outside the status filter
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not record the review.');
    } finally {
      setBusyId(null);
    }
  };

  const kindLabel = (v: string) => choiceLabel(options, 'gallery.referral_kind', v);
  const statusLabel = (v: string) => choiceLabel(options, 'gallery.referral_status', v);

  return (
    <DeskPage
      title="Introductions"
      subtitle={
        <>
          People partners introduced to Darz from their portal. Marking one records where it
          stands — nothing is sent to anyone and no account is made; follow up yourself.
        </>
      }
      toolbar={
        <>
          <label className="ad-filter">
            <span className="ad-filter-l">Status</span>
            <select value={status} onChange={(e) => setFilter('status', e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
              <option value="">All</option>
            </select>
          </label>
          <label className="ad-filter">
            <span className="ad-filter-l">Partner</span>
            <select value={link} onChange={(e) => setFilter('link', e.target.value)}>
              <option value="">All partners</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}
      {!rows && !error && <p className="dz-state">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="dz-state">
          {status === 'new'
            ? 'Nothing new — every introduction has been looked at.'
            : 'None here.'}
        </p>
      )}

      {rows &&
        rows.map((r) => (
          <div key={r.id} className="ad-card ad-updrow">
            <div className="ad-updmain">
              <span className="ad-cellmain">
                {r.referred_name} · {kindLabel(r.referred_kind)}
              </span>
              <span className="ad-cellsub">
                from {r.source_name || 'a partner'} · {fmtDateTime(r.created_at)}
                {r.reviewed_at ? ` · reviewed ${fmtDateTime(r.reviewed_at)}` : ''}
              </span>
              <div className="ad-revrows">
                {(
                  [
                    ['Organisation', r.referred_org],
                    ['Email', r.referred_email],
                    ['Phone', r.referred_phone],
                    ['Note', r.note],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div className="ad-revrow" key={k}>
                      <span className="ad-revk">{k}</span>
                      <span className="ad-revv">
                        {k === 'Email' ? <a href={`mailto:${v}`}>{v}</a> : v}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <span className="ad-rowacts">
              <span className={`ad-stpill is-${tone(r.status)}`}>{statusLabel(r.status)}</span>
              {VERDICTS.filter((v) => v !== r.status).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`ad-rowbtn${v === 'accepted' ? ' is-primary' : v === 'declined' ? ' is-danger' : ''}`}
                  disabled={busyId === r.id}
                  onClick={() => void review(r, v)}
                >
                  Mark {statusLabel(v).toLowerCase()}
                </button>
              ))}
            </span>
          </div>
        ))}

      {pagination && <Pager pagination={pagination} onPage={setPage} />}
    </DeskPage>
  );
}
