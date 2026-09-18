/**
 * The access-key expiry cell's logic — `expCell` (`darz-studio.html:33042`),
 * the old Access desk's own rules: Never / Expired / "Expires today" /
 * "*n*d left", red when expired, amber inside a week, green otherwise. Pure,
 * so the date math is testable without a renderer.
 */
export interface ExpiryParts {
  label: string;
  tone: 'never' | 'expired' | 'soon' | 'ok';
}

export function expiryParts(expiresAt: string | null, now = Date.now()): ExpiryParts {
  if (!expiresAt) return { label: 'Never', tone: 'never' };
  const ts = new Date(expiresAt).getTime();
  if (Number.isNaN(ts)) return { label: 'Never', tone: 'never' };
  if (ts <= now) return { label: 'Expired', tone: 'expired' };
  const days = Math.floor((ts - now) / 86_400_000);
  if (days <= 0) return { label: 'Expires today', tone: 'soon' };
  return { label: `${days}d left`, tone: days <= 7 ? 'soon' : 'ok' };
}
