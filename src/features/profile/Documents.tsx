/**
 * "Your documents" — Profile › Account's Documents group, port of
 * `dzDocsSectionHTML` (app.html:7909-7945): a `.pf-grp` "Documents" over one
 * collapsed `<details class="lacc">` whose summary is the file icon, "Your
 * documents" (+ a magenta dot while anything is unseen), "Invoices,
 * certificates & provenance", the count pill and the caret; inside, one row
 * per document — thumbnail well, label, sub-line, and "New" or "View →".
 * The old inline styles are lifted into `.pf-docs*` classes (`profile.css`).
 *
 * Data: `GET /api/documents/` (G-DOC-1), the documents Darz has shared with
 * this collector. **Hidden when there are none** — the old section returned
 * `''` for an empty list — and hidden while loading or after a failed read,
 * which is what the old app showed in both cases (it rendered from its local
 * copy and swallowed a failed pull, :7892-7907). The Account tab around it
 * never waits on or breaks for this read.
 *
 * Opening a row: the old app rendered the document in-app (`DZ.docView`,
 * :11151) with "Download PDF" / "Print". This backend stores the finished PDF
 * and returns a signed `pdf_url`, so a row **opens that PDF** in a new tab and
 * marks the document seen. A document with no PDF yet shows the old
 * "Document not available" toast (:11153). The thumbnail is always the old
 * no-image well (`matbg`, :7919): the collector serializer has no image.
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import { asArray } from '../../api/shapes';
import type { CollectorDocument } from '../../api/types';
import { Toast } from '../../components';
import { deviceStorage, docLabel, docSub, markSeen, readSeen } from './documents';

// app.html:7911-7912 — the file icon and the caret, verbatim
const IC_FILE = (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);
const CARET = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--ink3)"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export function Documents() {
  const { documents } = useApi();
  const [docs, setDocs] = useState<CollectorDocument[] | null>(null);
  const [seen, setSeen] = useState<string[]>(() => readSeen(deviceStorage()));
  const [toast, setToast] = useState(false);
  const closeToast = useCallback(() => setToast(false), []);

  useEffect(() => {
    let alive = true;
    // the old pull's own ceiling was 200 rows (`limit=200`, :7897); one page
    // of the backend's maximum is the same order and needs no walk
    documents.mine({ per_page: 100 }).then(
      (page) => alive && setDocs(asArray<CollectorDocument>(page?.results)),
      () => alive && setDocs([]),
    );
    return () => {
      alive = false;
    };
  }, [documents]);

  if (!docs || docs.length === 0) return null;
  const isNew = (id: string) => !seen.includes(id);
  const open = (id: string) => setSeen(markSeen(deviceStorage(), id));

  return (
    <>
      <div className="pf-grp">Documents</div>
      <details className="lacc pf-docs">
        <summary>
          <span className="pf-docs-ic">{IC_FILE}</span>
          <span className="pf-docs-h">
            <span className="t">
              Your documents
              {docs.some((d) => isNew(d.id)) && <span className="pf-docs-dot" />}
            </span>
            <span className="s">Invoices, certificates &amp; provenance</span>
          </span>
          <span className="pf-docs-n">{docs.length}</span>
          <span className="lacc-c">{CARET}</span>
        </summary>
        <div className="pf-docs-list">
          {docs.map((d) => {
            const body = (
              <>
                <span className="pf-doc-th" />
                <span className="pf-doc-b">
                  <span className="l">{docLabel(d.kind)}</span>
                  <span className="s">{docSub(d)}</span>
                </span>
                {isNew(d.id) ? (
                  <span className="pf-doc-new">New</span>
                ) : (
                  <span className="pf-doc-view">
                    View <span className="ar">→</span>
                  </span>
                )}
              </>
            );
            return d.pdf_url ? (
              <a
                key={d.id}
                className="pf-doc"
                href={d.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => open(d.id)}
              >
                {body}
              </a>
            ) : (
              <button
                key={d.id}
                type="button"
                className="pf-doc"
                onClick={() => setToast(true)}
              >
                {body}
              </button>
            );
          })}
        </div>
      </details>
      <Toast message="Document not available" open={toast} onClose={closeToast} />
    </>
  );
}
