/**
 * Row helpers shared by `ConversationRow` and the Profile lists — kept out of
 * the component file so fast refresh stays clean (same split as
 * `catalogue/format.ts`).
 */
/** app.html's `ACT_KL` — the kind labels the rows show. */
export const KIND_LABEL: Record<string, string> = {
  information: 'Enquiry',
  message: 'Message',
  price: 'Price request',
  availability: 'Availability',
  hold: 'Hold',
  offer: 'Offer',
  viewing: 'Viewing',
  purchase: 'Purchase',
};

/** `dzActShortDate` — "12 Sep" / "12 Sep 2025" when not this year. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** `dzStatusMeta` — a status pill class for the closed set. */
export function statusClass(status: string): string {
  if (['answered', 'accepted', 'granted', 'completed', 'paid'].includes(status)) return 's-ok';
  if (['closed', 'declined', 'withdrawn', 'expired', 'released', 'cancelled'].includes(status))
    return 's-cl';
  return '';
}
