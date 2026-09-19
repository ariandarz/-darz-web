/**
 * PortalPricelists — send Darz a pricelist file (gallery-update.html:
 * 1034-1068). The upload is real multipart into the private documents
 * bucket (`GalleryPricelistService.submit`).
 *
 * The old page's weekly 3-upload quota, processing/formatted/rejected
 * states, formatted-download link and in-portal builder describe server
 * machinery the new backend does not have — a `GalleryPricelist` row is
 * title + notes + date, nothing else — so rows here say "Received" and the
 * quota line is absent rather than false (G-PORT-4).
 */
import { useRef, useState, useSyncExternalStore, useCallback } from 'react';
import type { PortalSession } from './PortalSession';
import { fmtDate } from './portalForm';

const MAX_BYTES = 6 * 1024 * 1024; // the old page's own ceiling (:1059)

export function PortalPricelists({
  session,
  notify,
}: {
  session: PortalSession;
  notify: (m: string) => void;
}) {
  const state = useSyncExternalStore(
    useCallback((fn) => session.subscribe(fn), [session]),
    () => session.getSnapshot(),
  );
  const lists = state.data?.pricelists ?? [];
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | null | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      notify('That file is larger than 6 MB — please send a smaller file.');
      return;
    }
    setBusy(true);
    try {
      await session.uploadPricelist(file, file.name || 'Pricelist');
      // reload BEFORE the toast, so "sent" is only said once the list shows it
      await session.reload();
      notify('Pricelist sent to Darz.');
    } catch (err) {
      if (!session.noteAuthFailure(err)) notify('Could not send. Please try again.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="sec-note">
        Send Darz your pricelist (PDF, image, Excel or CSV). Darz extracts, cleans and
        reformats it into the official Darz pricelist — nothing is published automatically.
      </div>
      <button
        type="button"
        className="dropzone"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9A9A9A"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 16V4M6 10l6-6 6 6" />
          <path d="M4 20h16" />
        </svg>
        <span>{busy ? 'Sending…' : 'Tap to upload a pricelist file'}</span>
        <span style={{ fontSize: 11 }}>PDF · image · Excel · CSV · up to ~6 MB</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.csv,.xls,.xlsx,image/*,application/pdf"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <div>
        {lists.length ? (
          lists.map((p) => {
            const ext = (p.title || '').split('.').pop() ?? '';
            return (
              <div className="pl-card" key={p.id}>
                <div className="pl-ic">
                  {ext && ext.length <= 4 ? ext.toUpperCase() : 'FILE'}
                </div>
                <div className="pl-b">
                  <div className="pl-name">{p.title || 'Pricelist'}</div>
                  <div className="pl-meta">
                    {fmtDate(p.created_at)}
                    {p.notes ? ` · ${p.notes}` : ''}
                  </div>
                </div>
                <span className="pl-status">Received</span>
              </div>
            );
          })
        ) : (
          <div className="empty">No pricelists sent yet.</div>
        )}
      </div>
    </div>
  );
}
