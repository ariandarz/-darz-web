/**
 * DocChips — the documents Darz attached to a message (D19, the enriched
 * `document_refs: [{id, kind, title}]` the collector's thread now reads), drawn
 * under the bubble's time the way the old app drew the cards Darz attached to a
 * message (`_dzChatArtCards`, app.html:7230-7231, placed after `.tm` in
 * `dzThreadBubbleHTML` :7283-7285, styled `.dz-chatart` :923).
 *
 * The chip itself is the "Your documents" row (`dzDocsSectionHTML`,
 * app.html:7909-7925, ported in `profile/Documents.tsx`): the old label
 * (`docLabel` — Invoice · Certificate · Bill of Sale, else "Document"), the
 * document's title, and "View →". It opens exactly as that row does — the
 * signed `pdf_url` from the collector's own documents list (`GET /api/documents/`,
 * G-DOC-1), marking it seen on this device — because a ref carries no URL.
 * Attaching shares the document (backend: attach = share), so it is in that
 * list; if it is not (unshared since, or no PDF yet) the chip gives the old
 * "Document not available" toast (app.html:11153), as the row does.
 */
import { useCallback, useState } from 'react';
import type { CollectorDocument, MessageDocumentRef } from '../../api/types';
import { Toast } from '../../components';
import { deviceStorage, docLabel, markSeen } from '../profile/documents';

export function DocChips({
  refs,
  shared,
}: {
  refs: readonly MessageDocumentRef[];
  shared: Map<string, CollectorDocument> | null;
}) {
  const [toast, setToast] = useState(false);
  const closeToast = useCallback(() => setToast(false), []);
  if (!refs.length) return null;
  return (
    <div className="dz-chatart dz-chatdocs">
      {refs.map((r) => {
        const doc = shared?.get(r.id);
        const body = (
          <>
            <span className="dz-chatdoc-th" />
            <span className="dz-chatdoc-b">
              <span className="l">{docLabel(r.kind)}</span>
              <span className="s">{r.title || '—'}</span>
            </span>
            <span className="dz-chatdoc-v">
              View <span className="ar">→</span>
            </span>
          </>
        );
        return doc?.pdf_url ? (
          <a
            key={r.id}
            className="dz-chatdoc"
            href={doc.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => markSeen(deviceStorage(), r.id)}
          >
            {body}
          </a>
        ) : (
          <button
            key={r.id}
            type="button"
            className="dz-chatdoc"
            onClick={() => shared && setToast(true)}
          >
            {body}
          </button>
        );
      })}
      <Toast message="Document not available" open={toast} onClose={closeToast} />
    </div>
  );
}
