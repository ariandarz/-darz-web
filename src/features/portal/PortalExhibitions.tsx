/**
 * PortalExhibitions — the Exhibition Services workspace (gallery-update.html
 * :1476-1619, v883/§78/§79/§91): the source's shows with Darz, each opening
 * onto the WHOLE services menu with prices ("the gallery sees the whole
 * catalogue, ticks what it wants") and a running total; submitting sends the
 * ticked keys to Darz. What the source may set is deliberately narrow —
 * its own show fields and `gallery_selected`, nothing else: "prices, per-
 * service status, the discount and every note stay Darz's, so a gallery can
 * choose from the menu but never write the bill."
 *
 * Editability mirrors the server exactly (draft + requested; §91's "a
 * SUBMITTED show is no longer editable" tightened server-side to lock only
 * once Darz composes): a locked record shows the old refusal copy. Once
 * Darz PUBLISHES, the composed `service_lines` replace the catalogue
 * pricing and the issued documents appear. Signing is the old §80 pad
 * again (`SignaturePad`, G-PORT-7): the typed name is still required, the
 * drawn PNG rides beside it, and a signed row shows the stored mark from
 * `signature_image_url`. An invoice opens the pad with the old v1187 words;
 * a proposal — which the old page CONFIRMED by dialog, with no mark — opens
 * it with that dialog's own words (:1940), because the backend signs both
 * through one endpoint and stores a mark on either. The signer's name is
 * remembered into the header's "Your name" when that is empty (old :2054).
 *
 * The PDF behind "Open" is the one Darz rendered when it issued the document,
 * so the drawn mark is NOT on it — the row is where it shows (flagged).
 */
import { useEffect, useState, useSyncExternalStore, useCallback } from 'react';
import type { OptionsMap } from '../../api/services';
import type { DocumentAdmin, PortalExhibition, PortalExhibitionInput } from '../../api/types';
import type { PortalSession } from './PortalSession';
import { SignaturePad } from './SignaturePad';
import {
  canEditExhibition,
  choiceLabel,
  exhibitionMoney,
  exhibitionTotals,
  fmtDate,
} from './portalForm';

export function PortalExhibitions({
  session,
  options,
  notify,
  staff,
  onStaff,
}: {
  session: PortalSession;
  options: OptionsMap | null;
  notify: (m: string) => void;
  /** the header's "Your name" — the pad's default signer */
  staff: string;
  onStaff: (name: string) => void;
}) {
  const state = useSyncExternalStore(
    useCallback((fn) => session.subscribe(fn), [session]),
    () => session.getSnapshot(),
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // force on every tab open: Darz composes/publishes from the desk while
    // this tab sits in memory, and the source must see it without a full
    // page reload (which would re-ask the access code)
    session.loadExhibitions(true).catch(() => setFailed(true));
  }, [session]);

  if (failed)
    return (
      <div className="empty">
        Could not load your exhibitions.{' '}
        <button
          className="btn"
          type="button"
          onClick={() => {
            setFailed(false);
            session.loadExhibitions(true).catch(() => setFailed(true));
          }}
        >
          Try again
        </button>
      </div>
    );
  if (state.exhibitions === null) return <div className="empty">Loading…</div>;

  const shows = state.exhibitions;
  const cat = state.catalogue ?? [];
  const open = openId ? shows.find((e) => e.id === openId) : null;

  if (creating)
    return (
      <ShowForm
        onCancel={() => setCreating(false)}
        onCreate={async (fields) => {
          try {
            const ev = await session.createExhibition(fields);
            await session.loadExhibitions(true);
            setCreating(false);
            setOpenId(ev.id);
            notify('Show started.');
          } catch (err) {
            if (!session.noteAuthFailure(err)) notify('Could not save. Please try again.');
          }
        }}
      />
    );

  if (open)
    return (
      <ShowDetail
        key={open.id}
        ev={open}
        cat={cat}
        options={options}
        session={session}
        notify={notify}
        staff={staff}
        onStaff={onStaff}
        onBack={() => setOpenId(null)}
      />
    );

  return (
    <div>
      <div className="sec-note">
        The exhibitions Darz has worked on with you. Open a show to choose its services and
        send it to Darz — Darz confirms each service and prices the package.
      </div>
      <div className="exh-showlist">
        {shows.length ? (
          shows.map((ev) => {
            const t = exhibitionTotals(ev, ev.gallery_selected, cat);
            const meta = [ev.artists, ev.event_date, ev.venue].filter(Boolean).join(' · ');
            const count =
              ev.published && ev.service_lines.length
                ? ev.service_lines.length
                : ev.gallery_selected.length;
            return (
              <button
                type="button"
                className="exh-showcard"
                key={ev.id}
                onClick={() => setOpenId(ev.id)}
              >
                <div className="esc-main">
                  <div className="esc-title">{ev.title || 'Untitled show'}</div>
                  {meta && <div className="esc-meta">{meta}</div>}
                </div>
                <div className="esc-side">
                  <span className={`exh-status ${ev.request_status}`}>
                    {choiceLabel(
                      options,
                      'gallery.exhibition_request_status',
                      ev.request_status,
                    )}
                  </span>
                  <div className="esc-sum">
                    {count} service{count === 1 ? '' : 's'}
                    {t.sub ? ` · ${exhibitionMoney(ev.currency, t.tot)}` : ''}
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="empty">No shows yet — start one below.</div>
        )}
      </div>
      <button className="btn btn--primary" type="button" onClick={() => setCreating(true)}>
        + Start a new show
      </button>
    </div>
  );
}

/* ── the new-show form (ExhibitionEventCreateSerializer's fields) ───────── */

function ShowForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (fields: PortalExhibitionInput) => Promise<void>;
}) {
  const [f, setF] = useState<PortalExhibitionInput>({ title: '' });
  const [busy, setBusy] = useState(false);
  const set = (patch: PortalExhibitionInput) => setF((x) => ({ ...x, ...patch }));
  return (
    <div className="exh-card">
      <div className="exh-h">Start a new show</div>
      <div className="exh-sub">
        Tell Darz about the exhibition — you can choose its services on the next step.
      </div>
      <div className="fld">
        <label htmlFor="exh-t">Exhibition title *</label>
        <input
          id="exh-t"
          value={f.title ?? ''}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>
      <div className="row2">
        <div className="fld">
          <label htmlFor="exh-d">Date</label>
          <input
            id="exh-d"
            placeholder="e.g. Sept 2026"
            value={f.event_date ?? ''}
            onChange={(e) => set({ event_date: e.target.value })}
          />
        </div>
        <div className="fld">
          <label htmlFor="exh-v">Space / venue</label>
          <input
            id="exh-v"
            value={f.venue ?? ''}
            onChange={(e) => set({ venue: e.target.value })}
          />
        </div>
      </div>
      <div className="fld">
        <label htmlFor="exh-a">Artist / artists</label>
        <input
          id="exh-a"
          value={f.artists ?? ''}
          onChange={(e) => set({ artists: e.target.value })}
        />
      </div>
      <div className="fld">
        <label htmlFor="exh-n">Note for Darz</label>
        <textarea
          id="exh-n"
          value={f.gallery_note ?? ''}
          onChange={(e) => set({ gallery_note: e.target.value })}
        />
      </div>
      <div className="exh-acts">
        <button
          className="btn btn--primary"
          type="button"
          disabled={busy || !f.title?.trim()}
          onClick={() => {
            setBusy(true);
            void onCreate(f).finally(() => setBusy(false));
          }}
        >
          {busy ? 'Saving…' : 'Start the show'}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── one show: facts · the whole menu · totals · documents ──────────────── */

function ShowDetail({
  ev,
  cat,
  options,
  session,
  notify,
  staff,
  onStaff,
  onBack,
}: {
  ev: PortalExhibition;
  cat: NonNullable<ReturnType<PortalSession['getSnapshot']>['catalogue']>;
  options: OptionsMap | null;
  session: PortalSession;
  notify: (m: string) => void;
  staff: string;
  onStaff: (name: string) => void;
  onBack: () => void;
}) {
  // opening a record always starts from what is SAVED (v1182, :1499)
  const [sel, setSel] = useState<string[]>(() => [...ev.gallery_selected]);
  const [busy, setBusy] = useState(false);
  const canEdit = canEditExhibition(ev);
  const dirty =
    sel.length !== ev.gallery_selected.length ||
    sel.some((k) => !ev.gallery_selected.includes(k));
  const totals = exhibitionTotals(ev, sel, cat);
  const composed = ev.published && ev.service_lines.length > 0;
  const lineByKey = new Map(ev.service_lines.map((l) => [l.service_key, l]));

  const toggle = (key: string, on: boolean) => {
    if (!canEdit) return;
    setSel((s) => (on ? [...s.filter((k) => k !== key), key] : s.filter((k) => k !== key)));
  };

  const submit = async () => {
    if (!sel.length) {
      notify('Choose at least one service first.');
      return;
    }
    setBusy(true);
    try {
      await session.submitExhibition(ev.id, sel);
      await session.loadExhibitions(true);
      notify('Sent to Darz.');
    } catch (err) {
      if (session.noteAuthFailure(err)) return;
      notify(
        err instanceof Error && /composed/i.test(err.message)
          ? 'Darz has already composed this package — it can’t be edited from the portal.'
          : 'Could not send. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  // the document the pad is open for, or null
  const [signing, setSigning] = useState<DocumentAdmin | null>(null);
  const sign = async (doc: DocumentAdmin, png: string, who: string): Promise<boolean> => {
    const isProposal = doc.kind === 'exhibition_proposal';
    try {
      await session.signExhibitionDocument(ev.id, doc.id, who, png);
      setSigning(null);
      // old :2050 / :1944 — the server's answer, then the re-read
      notify(
        isProposal
          ? 'Confirmed — Darz will issue the invoice.'
          : 'Signed — thank you. Darz has been notified.',
      );
      if (!staff.trim()) onStaff(who);
      await session.loadExhibitions(true);
      return true;
    } catch (err) {
      if (session.noteAuthFailure(err)) return false;
      // old docFail (:1928-1936), on what this backend can say
      notify(`Could not ${isProposal ? 'confirm' : 'sign'}. Please try again.`);
      return false;
    }
  };

  const facts: Array<[string, string]> = [
    ['Date', ev.event_date],
    ['Venue', ev.venue],
    ['Artists', ev.artists],
    ['Started', fmtDate(ev.created_at)],
  ];

  // the whole menu, plus any key already on the record that the catalogue
  // no longer offers (a legacy key still shows, :1590)
  const keys = cat.map((c) => c.key);
  for (const k of sel) if (!keys.includes(k)) keys.push(k);

  return (
    <div>
      <button className="exh-back" type="button" onClick={onBack}>
        ‹ All shows
      </button>
      <div className="exh-card">
        <span className={`exh-status ${ev.request_status}`}>
          {choiceLabel(options, 'gallery.exhibition_request_status', ev.request_status)}
        </span>
        <div className="exh-h" style={{ marginTop: 10 }}>
          {ev.title || 'Untitled show'}
        </div>
        {ev.gallery_note && <div className="exh-sub">{ev.gallery_note}</div>}
        <div className="exh-facts">
          {facts
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div className="exh-fact" key={k}>
                <div className="k">{k}</div>
                <div className="v">{v}</div>
              </div>
            ))}
        </div>
      </div>

      {!canEdit && !composed && (
        <div className="exh-banner">
          <span>
            Darz has already composed this package — it can’t be edited from the portal.
            Anything you need changed, ask in <b>Messages</b>.
          </span>
        </div>
      )}

      <div className="exh-card">
        <div className="exh-h" style={{ fontSize: 15, margin: '0 0 4px' }}>
          Darz services
        </div>
        <div className="exh-sub">
          {canEdit
            ? 'Choose the services you would like. Darz confirms each one and sets what is not priced yet.'
            : 'The services Darz produced for this exhibition.'}
        </div>
        <div className="svc-list">
          {keys.map((key) => {
            const entry = cat.find((c) => c.key === key);
            const line = lineByKey.get(key);
            const on = composed ? !!line && line.status !== 'declined' : sel.includes(key);
            const locked = !canEdit || (!!line && line.status !== 'proposed');
            // G-PORT-16 — "3 × …" when Darz composed more than one (the
            // document builder's own quantity wording)
            const qty = line && line.quantity > 1 ? `${line.quantity} × ` : '';
            const title = qty + (line?.title || entry?.title || key);
            const desc = line?.description || entry?.description || '';
            const priceLabel = line
              ? line.price !== null && line.price !== ''
                ? exhibitionMoney(line.currency || ev.currency, Number(line.price))
                : 'Pricing to be announced'
              : entry && entry.default_price !== null
                ? exhibitionMoney(ev.currency || 'TMN', Number(entry.default_price))
                : 'Pricing to be announced';
            const hasPrice = line
              ? line.price !== null && line.price !== ''
              : !!entry && entry.default_price !== null;
            const body = (
              <>
                <div className="svc-b">
                  <div className="svc-t">{title}</div>
                  {desc && <div className="svc-d">{desc}</div>}
                  {line?.admin_note && (
                    <div className="svc-anote">Darz: {line.admin_note}</div>
                  )}
                </div>
                <div className="svc-r">
                  <span className={`svc-p${hasPrice ? '' : ' tba'}`}>{priceLabel}</span>
                  {line && (
                    <span className={`svc-st ${line.status}`}>
                      {line.status.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </>
            );
            if (locked)
              return (
                <div className={`svc${on ? ' on' : ''} locked`} key={key}>
                  {body}
                </div>
              );
            return (
              <label className={`svc${on ? ' on' : ''}`} key={key}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => toggle(key, e.target.checked)}
                />
                {body}
              </label>
            );
          })}
        </div>
      </div>

      <div className="exh-card">
        <div className="exh-h" style={{ fontSize: 15, margin: '0 0 8px' }}>
          Summary
        </div>
        <div className="exh-sum">
          <div className="exh-line">
            <span>Services</span>
            <span className="v">{totals.count}</span>
          </div>
          {totals.unpriced > 0 && (
            <div className="exh-line">
              <span>Priced on confirmation</span>
              <span className="v">{totals.unpriced}</span>
            </div>
          )}
          {!!totals.disc && (
            <div className="exh-line">
              <span>Discount</span>
              <span className="v">−{exhibitionMoney(ev.currency, totals.disc)}</span>
            </div>
          )}
          <div className="exh-line tot">
            <span>Total</span>
            <span className="v">{exhibitionMoney(ev.currency || 'TMN', totals.tot)}</span>
          </div>
        </div>
        {canEdit && (
          <div className="exh-acts">
            <button
              className="btn btn--primary"
              type="button"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy
                ? 'Sending…'
                : dirty || ev.request_status === 'draft'
                  ? 'Send to Darz'
                  : 'Send again'}
            </button>
          </div>
        )}
      </div>

      {composed && (
        <div className="exh-card">
          <div className="exh-h" style={{ fontSize: 15, margin: '0 0 8px' }}>
            Documents
          </div>
          {ev.documents.length ? (
            <div className="doc-list">
              {ev.documents.map((d) => {
                // The source's acceptance is STAMPED INTO fields —
                // `portal_accepted_*` (proposal) / `portal_signed_*`
                // (invoice), never the desk's own `signed_at`
                // (`ExhibitionDocumentService.portal_stamp`). §80's rule:
                // the row itself says whether it went through.
                const f = (d.fields ?? {}) as Record<string, unknown>;
                const isProposal = d.kind === 'exhibition_proposal';
                const signed = !!(f.portal_accepted_at || f.portal_signed_at);
                const mark = signed ? d.signature_image_url : null;
                return (
                  <div className="doc-row" key={d.id}>
                    <div className="doc-main">
                      <div className="doc-t">{d.title || d.kind}</div>
                      <div className="doc-m">{fmtDate(d.created_at)}</div>
                      <span className={`doc-state ${signed ? 'ok' : 'wait'}`}>
                        {signed
                          ? isProposal
                            ? 'Accepted — nothing more needed.'
                            : 'Signed — nothing more needed.'
                          : isProposal
                            ? 'Awaiting your acceptance.'
                            : 'Awaiting your signature.'}
                      </span>
                      {/* G-PORT-7 — the stored mark (presigned), under its state */}
                      {mark && <img className="doc-sig" src={mark} alt="Your signature" />}
                    </div>
                    <div className="doc-acts">
                      {d.pdf_url && (
                        <a
                          className="btn"
                          href={d.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open
                        </a>
                      )}
                      {/* the old row buttons (`docRowHtml`, passport-v1.js:204-206) */}
                      {!signed && (
                        <button
                          className="btn btn--primary"
                          type="button"
                          disabled={busy}
                          onClick={() => setSigning(d)}
                        >
                          {isProposal ? 'Confirm & request invoice' : 'Sign & confirm'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="exh-sub" style={{ margin: 0 }}>
              Darz issues the proposal and invoice here once the package is confirmed.
            </div>
          )}
        </div>
      )}

      {signing && (
        <SignaturePad
          key={signing.id}
          {...padWords(signing)}
          defaultName={staff}
          onCancel={() => setSigning(null)}
          onRefuse={notify}
          onSign={(png, who) => sign(signing, png, who)}
        />
      )}
    </div>
  );
}

/** The pad's words for one document. The human reference is
 * `fields.reference` (`Document.ref` is the backend's own handle). An invoice
 * is the old v1187 pad verbatim (:1971-1974); a proposal carries the old
 * confirm dialog's words (:1940) and its row button's label. */
function padWords(doc: DocumentAdmin): { title: string; sub: string; okLabel: string } {
  const f = (doc.fields ?? {}) as Record<string, unknown>;
  const ref = typeof f.reference === 'string' && f.reference ? f.reference : '—';
  if (doc.kind === 'exhibition_proposal')
    return {
      title: 'Confirm this proposal',
      sub: `Ref ${ref}. Darz will prepare the invoice and send it here for you to sign. Nothing is charged by confirming.`,
      okLabel: 'Confirm & request invoice',
    };
  return {
    title: 'Sign the invoice',
    sub: `Ref ${ref}. Sign below with your finger or your mouse, add the name of the person signing, then confirm. Your signature is stored on the invoice itself.`,
    okLabel: 'Sign & confirm invoice',
  };
}
