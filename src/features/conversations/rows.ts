/**
 * Row helpers shared by `ConversationRow` and the Profile lists — kept out of
 * the component file so fast refresh stays clean (same split as
 * `catalogue/format.ts`).
 *
 * The status vocabulary itself lives in `features/requests/status.ts` — one
 * module, not a lookup re-typed per call site (CLAUDE.md).
 */

/** `ACT_KL` (app.html:7512), mapped onto the backend's request kinds. The
 * hold reads **48h** rather than the old app's 24h because the backend keeps
 * it for 48 h (`Hold.DEFAULT_TTL`) — owner decision D2, 2026-09-17. */
export const KIND_LABEL: Record<string, string> = {
  purchase: 'Buy now',
  hold: '48h hold',
  viewing: 'Viewing request',
  offer: 'Offer made',
  price: 'Price enquiry',
  information: 'Enquiry',
  message: 'Message to Darz',
  // the old app had no `availability` surface (G-P5-7); labelled for the feed
  availability: 'Availability',
};

/** `dzActShortDate` (app.html:7513) — "5 Sep · 14:30", with the year added
 * when it is not this one. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const day = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}
