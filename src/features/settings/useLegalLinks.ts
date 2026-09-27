/**
 * Where Settings › LEGAL's three rows point.
 *
 * The old rows open long-form sheets of owner-edited theme text
 * (`DZ.legal('terms'|'privacy'|'auction')`, app.html:11576-11590, keys
 * `legalTerms` / `legalPrivacy` / `legalAuction`). This port has linked them to
 * the public site since v0.1. The backend now serves owner-published legal
 * documents at `GET /api/documents/public/{kind}/` (`AllowAny`, only a
 * **confirmed, public** document), so a row points at that document's PDF when
 * one is published, and keeps today's public-site URL otherwise — a 404, a
 * document without a PDF, or a failed read all leave the link as it was.
 *
 * **The kinds are a convention, and only one is confirmed.** `kind` is
 * freeform; the backend documents `legal_terms` (`documents/models.py` header,
 * its own tests). `legal_privacy` and `legal_auction` follow the same pattern
 * and the old theme keys' names — flagged: the owner must publish under
 * exactly these kinds for the rows to pick them up. The long-form in-app sheet
 * is not rebuilt; a PDF opens in a new tab, as the public-site link already did.
 */
import { useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';

export type LegalKey = 'terms' | 'privacy' | 'auction';

const KIND: Record<LegalKey, string> = {
  terms: 'legal_terms',
  privacy: 'legal_privacy',
  auction: 'legal_auction',
};

/** Today's links — the fallback whenever nothing is published. */
export const LEGAL_FALLBACK: Record<LegalKey, string> = {
  terms: 'https://darzmarket.art/terms',
  privacy: 'https://darzmarket.art/privacy',
  auction: 'https://darzmarket.art/auction-terms',
};

export function useLegalLinks(withAuction: boolean): Record<LegalKey, string> {
  const { publicDocuments } = useApi();
  const [links, setLinks] = useState<Record<LegalKey, string>>(LEGAL_FALLBACK);

  useEffect(() => {
    let alive = true;
    const keys: LegalKey[] = withAuction
      ? ['terms', 'privacy', 'auction']
      : ['terms', 'privacy'];
    for (const key of keys) {
      publicDocuments.byKind(KIND[key]).then(
        (doc) => {
          const url = doc?.pdf_url;
          if (alive && typeof url === 'string' && url) {
            setLinks((prev) => ({ ...prev, [key]: url }));
          }
        },
        () => {
          // nothing published under this kind (404) or unreachable — keep the fallback
        },
      );
    }
    return () => {
      alive = false;
    };
  }, [publicDocuments, withAuction]);

  return links;
}
