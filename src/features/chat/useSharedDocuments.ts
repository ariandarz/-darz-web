/**
 * The collector's shared documents by id (`GET /api/documents/`, G-DOC-1) —
 * where a thread's document chip finds its signed `pdf_url` (see `DocChips`).
 */
import { useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import { asArray } from '../../api/shapes';
import type { CollectorDocument } from '../../api/types';

/** The collector's shared documents by id — read once, and only when the
 * thread has an attached document at all. */
export function useSharedDocuments(enabled: boolean): Map<string, CollectorDocument> | null {
  const { documents } = useApi();
  const [byId, setById] = useState<Map<string, CollectorDocument> | null>(null);
  useEffect(() => {
    if (!enabled || byId) return;
    let alive = true;
    documents.mine({ per_page: 100 }).then(
      (page) =>
        alive &&
        setById(new Map(asArray<CollectorDocument>(page?.results).map((d) => [d.id, d]))),
      () => alive && setById(new Map()),
    );
    return () => {
      alive = false;
    };
  }, [enabled, byId, documents]);
  return byId;
}
