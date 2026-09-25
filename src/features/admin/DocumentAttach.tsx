/**
 * DocumentAttach — the admin composer's "Attach document" (D19,
 * `document_refs` on `POST /crm/admin/requests/{id}/messages/`).
 *
 * **No old counterpart (flagged).** The old composer was a textarea and a
 * send button (`_chatDetail`, `darz-studio.html:40474-40475`); a document
 * reached a collector from the deal's share toggle, or as a link pasted into a
 * message. The backend now takes the attach directly, so the control is kept
 * as small as it can be: one ghost button beside nothing else, a search box
 * over a short list, and the picked document as one removable chip (the kit
 * `Picker`'s chip look). Its words are new.
 *
 * **What it offers.** The admin documents list has exactly one filter, `kind`
 * — no collector and no search (`admin_document_list_create`) — so the list is
 * read whole once (`walkPages`, capped) when the picker first opens, and
 * narrowed here: collector-visible kinds only, never archived, and never a
 * document already issued to ANOTHER collector, because attaching re-shares
 * it with this thread's collector and would move it (`attachableDocuments`).
 * The search is over title, reference and kind, client-side.
 */
import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../../api/hooks';
import { MAX_PER_PAGE, walkPages } from '../../api/paging';
import type { DocumentAdmin } from '../../api/types';
import { attachableDocuments } from './documentRules';

const SHOWN = 8;

export function DocumentAttach({
  collectorId,
  picked,
  onPick,
}: {
  /** The thread's collector — from the list's router state; `null` on a cold
   * deep link (G-CHAT-1), which narrows the offer to unissued documents. */
  collectorId: string | null;
  picked: DocumentAdmin | null;
  onPick: (doc: DocumentAdmin | null) => void;
}) {
  const { documentsAdmin } = useApi();
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<DocumentAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open || all) return;
    let alive = true;
    walkPages((page) => documentsAdmin.documents({ page, per_page: MAX_PER_PAGE })).then(
      (rows) => alive && setAll(rows),
      (err: unknown) =>
        alive &&
        setError(err instanceof Error ? err.message : 'Could not read the documents.'),
    );
    return () => {
      alive = false;
    };
  }, [open, all, documentsAdmin]);

  const offer = useMemo(() => {
    const rows = attachableDocuments(all ?? [], collectorId);
    const term = q.trim().toLowerCase();
    return term
      ? rows.filter((d) => `${d.title} ${d.ref ?? ''} ${d.kind}`.toLowerCase().includes(term))
      : rows;
  }, [all, collectorId, q]);

  if (picked) {
    return (
      <div className="ad-attach">
        <span className="ad-pickchip" aria-label="Attached document">
          {picked.kind.replace(/_/g, ' ')} · {picked.title}
          <button
            type="button"
            aria-label={`Remove ${picked.title}`}
            onClick={() => onPick(null)}
          >
            ×
          </button>
        </span>
        <span className="ad-cellsub">shared with the collector when you send</span>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="ad-attach">
        <button type="button" className="ad-ghostbtn" onClick={() => setOpen(true)}>
          Attach document
        </button>
      </div>
    );
  }

  return (
    <div className="ad-attach is-open">
      <div className="ad-attach-h">
        <input
          className="ad-pickin"
          placeholder="Search documents — title, reference, kind…"
          aria-label="Search documents"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="ad-ghostbtn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error ? (
        <p className="dz-state err" role="alert">
          {error}
        </p>
      ) : !all ? (
        <p className="dz-state">Loading…</p>
      ) : offer.length === 0 ? (
        <p className="dz-state">
          {q.trim()
            ? 'No document matches.'
            : collectorId
              ? 'No shareable document for this collector yet.'
              : 'No unissued shareable document.'}
        </p>
      ) : (
        <div className="ad-attach-list">
          {offer.slice(0, SHOWN).map((d) => (
            <button
              key={d.id}
              type="button"
              className="ad-attach-row"
              onClick={() => {
                onPick(d);
                setOpen(false);
                setQ('');
              }}
            >
              <span className="ad-cellmain">{d.title}</span>
              <span className="ad-cellsub">
                {d.kind.replace(/_/g, ' ')}
                {d.ref ? ` · ${d.ref}` : ''} · {d.status}
                {d.collector ? '' : ' · not issued yet'}
              </span>
            </button>
          ))}
          {offer.length > SHOWN && (
            <p className="ad-cellsub">
              {offer.length - SHOWN} more — search to narrow the list.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
