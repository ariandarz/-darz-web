/**
 * PortalReferrals — the portal's Introduce tab (G-PORT-5), on the old view's
 * frame (`#viewIntroduce`, `renderIntroduce`, gallery-update.html:1090-1112):
 * the `.sec-note` lede over a 560px column of labelled fields.
 *
 * **The old tab and this one do different things — read before changing it.**
 * The old tab (labelled "Share", owner-gated by `feat_referral`) gave the
 * gallery a `?ref=` link to forward, and said in so many words that the
 * gallery "never share[s] anyone’s contact details". The backend built the
 * owner's D7 answer instead: a `PortalReferral` — a logged LEAD with a name
 * and, optionally, an organisation, email, phone and note, which a desk
 * reviews and nothing acts on automatically. So:
 *  - the form, its words and the list below have no old source (flagged);
 *    the old "never share contact details" line is NOT carried, because here
 *    the gallery does — the lede asks for consent instead;
 *  - the old share link is not ported: `?ref=gallery:<slug>` needs a slug the
 *    new link does not have (flagged);
 *  - the tab is always offered: the link has no `feat_referral` switch and the
 *    endpoint is ungated.
 *
 * A referral is its own record, not a pending update: it never shows in
 * History or Pending review, and its status (new · reviewed · accepted ·
 * declined) is whatever the desk set.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ValidationError } from '../../api/errors';
import type { OptionsMap } from '../../api/services';
import type { PortalSession } from './PortalSession';
import {
  REFERRAL_KINDS,
  blankReferral,
  buildReferralBody,
  choiceLabel,
  fmtDate,
  referralTone,
  type ReferralDraft,
} from './portalForm';

export function PortalReferrals({
  session,
  options,
  notify,
}: {
  session: PortalSession;
  options: OptionsMap | null;
  notify: (m: string) => void;
}) {
  const state = useSyncExternalStore(
    useCallback((fn) => session.subscribe(fn), [session]),
    () => session.getSnapshot(),
  );
  const [draft, setDraft] = useState<ReferralDraft>(blankReferral);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const set = (patch: Partial<ReferralDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const load = useCallback(() => {
    session.loadReferrals().catch((err: unknown) => {
      if (!session.noteAuthFailure(err)) setFailed(true);
    });
  }, [session]);
  // every open re-reads: the desk reviews while this tab sits in memory
  useEffect(load, [load]);

  const send = async () => {
    const out = buildReferralBody(draft);
    if (!out.ok) {
      notify(out.error);
      return;
    }
    setBusy(true);
    try {
      await session.submitReferral(out.body);
      setDraft(blankReferral());
      notify('Sent to Darz.');
    } catch (err) {
      if (session.noteAuthFailure(err)) return;
      // a field the server refused (a malformed email, mostly) says which
      const first =
        err instanceof ValidationError ? Object.values(err.fields).flat()[0] : undefined;
      notify(first || 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const rows = state.referrals;

  return (
    <div>
      <div className="sec-note">
        Introduce Darz to a collector, gallery or artist you know. Tell us who they are and how
        to reach them — Darz reviews each introduction and decides how to follow up. Nothing is
        sent to them automatically. Please only share details they are happy for Darz to have.
      </div>
      <div style={{ maxWidth: 560 }}>
        <div className="row2">
          <div className="fld">
            <label htmlFor="ref-kind">Introducing</label>
            <select
              id="ref-kind"
              value={draft.kind}
              onChange={(e) => set({ kind: e.target.value as ReferralDraft['kind'] })}
            >
              {REFERRAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {choiceLabel(options, 'gallery.referral_kind', k)}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="ref-name">Name *</label>
            <input
              id="ref-name"
              autoComplete="off"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="ref-org">Organisation</label>
          <input
            id="ref-org"
            placeholder="Gallery, collection or studio — optional"
            value={draft.org}
            onChange={(e) => set({ org: e.target.value })}
          />
        </div>
        <div className="row2">
          <div className="fld">
            <label htmlFor="ref-email">Email</label>
            <input
              id="ref-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={draft.email}
              onChange={(e) => set({ email: e.target.value })}
            />
          </div>
          <div className="fld">
            <label htmlFor="ref-phone">Phone</label>
            <input
              id="ref-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={draft.phone}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="ref-note">Note for Darz</label>
          <textarea
            id="ref-note"
            placeholder="Anything we should know…"
            value={draft.note}
            onChange={(e) => set({ note: e.target.value })}
          />
        </div>
        <button
          className="btn btn--primary"
          type="button"
          disabled={busy}
          onClick={() => void send()}
        >
          {busy ? 'Sending…' : 'Send to Darz'}
        </button>
      </div>

      <div className="sec-note" style={{ marginTop: 24 }}>
        <b>Your introductions</b> — each one shows where Darz has got to with it.
      </div>
      {failed ? (
        <div className="empty">
          Could not load your introductions.{' '}
          <button
            className="btn"
            type="button"
            onClick={() => {
              setFailed(false);
              load();
            }}
          >
            Try again
          </button>
        </div>
      ) : rows === null ? (
        <div className="empty">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty">No introductions yet.</div>
      ) : (
        rows.map((r) => {
          const meta = [
            choiceLabel(options, 'gallery.referral_kind', r.referred_kind),
            r.referred_org,
            r.referred_email || r.referred_phone,
            fmtDate(r.created_at),
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <div className="pl-card" key={r.id}>
              <div className="pl-b">
                <div className="pl-name">{r.referred_name}</div>
                <div className="pl-meta">{meta}</div>
                {r.note && <div className="pl-meta">“{r.note}”</div>}
              </div>
              <span className={`pl-status ${referralTone(r.status)}`.trim()}>
                {choiceLabel(options, 'gallery.referral_status', r.status)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
