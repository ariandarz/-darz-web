/** Helpers for the "Your acquisitions" section — kept out of the component
 * file so fast refresh stays clean (same split as `conversations/rows.ts`). */
import type { CollectorRequest } from '../../api/types';

/** app.html:9686 — `KL`: the three kinds the pipeline follows, and the name
 * each one carries there (not the activity list's `ACT_KL` label). */
export const ACQUISITION_LABEL: Record<string, string> = {
  purchase: 'Purchase request',
  offer: 'Offer',
  hold: 'Hold request',
};

export function isAcquisition(request: CollectorRequest): boolean {
  return request.kind in ACQUISITION_LABEL;
}
