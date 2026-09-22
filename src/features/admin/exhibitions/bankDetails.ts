/**
 * The payee bank block an exhibition invoice prints — where it is remembered
 * between invoices, and why it is not where TD-3 proposed.
 *
 * ## The bug (TD-3)
 *
 * This page kept the block in `localStorage` alone. The consequence is not
 * subtle: **a second admin issuing an invoice got four empty fields**, and a
 * cleared browser lost the details outright. The block is not a per-viewer
 * preference — it is the studio's own payment instruction, the same on every
 * invoice, and it belongs to the studio rather than to a browser.
 *
 * ## Why NOT `theme.*`, which the audit proposed
 *
 * `docs/ADMIN_V1_AUDIT.md`'s TD-3 says it "belongs under `theme.*` or its own
 * endpoint; needs a small decision on which". The decision is **not
 * `theme.*`**, and the reason is a security one rather than a taste one:
 * `GET /api/app-theme/` is **`AllowAny`** — it is read before sign-in, by
 * design, because the collector app needs the theme at boot. Putting a card
 * number and an IBAN in it would publish them to anyone who can reach the API.
 * That is strictly worse than the bug it would fix.
 *
 * ## What it does instead
 *
 * **Every issued invoice already carries the block server-side**, in
 * `Document.fields.bank` (`issueForm.ts::buildIssueFields`). So the last
 * invoice anyone issued is a shared, durable, already-existing record of the
 * current details — no new endpoint, no new field, nothing published.
 *
 * The page therefore seeds from **the most recent issued invoice**, and falls
 * back to this device's copy while that read is in flight or if it finds
 * nothing (the very first invoice, or an environment where the list read
 * fails). The local copy is still written on issue, which keeps the page
 * instant on the device that last used it.
 *
 * What that fixes, in order: a second admin now sees the details the first one
 * used; a cleared browser recovers them; and an owner who changes bank once
 * changes them for everyone, on the next invoice, without telling anybody.
 *
 * It is not a settings screen — there is still nowhere to EDIT the studio's
 * details except by issuing an invoice, which is the old panel's behaviour
 * too. A proper home is one small endpoint. Recorded as **G-DOC-1**.
 */
import { asArray } from '../../../api/shapes';
import type { DocumentAdmin } from '../../../api/types';
import type { BankDetails } from '../exhibitionForm';

/** Per-device copy — a convenience, never the source of truth. */
const BANK_KEY = 'darz_desk_bank_details';

export const EMPTY_BANK: BankDetails = { holder: '', bank: '', card: '', iban: '' };

/** True when at least one field is filled — an all-blank block is not worth
 * seeding from, and is what an invoice issued without bank details stores. */
export function hasBank(b: BankDetails): boolean {
  return !!(b.holder || b.bank || b.card || b.iban);
}

/** Narrow whatever `fields.bank` turns out to be. It is a JSON blob on the
 * document, so `null`, a string and an array are all things that can really
 * be in there (docs/HANDOFF.md §6). */
export function bankFromFields(fields: unknown): BankDetails | null {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null;
  const raw = (fields as Record<string, unknown>).bank;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const out: BankDetails = {
    holder: str(b.holder),
    bank: str(b.bank),
    card: str(b.card),
    iban: str(b.iban),
  };
  return hasBank(out) ? out : null;
}

/**
 * The newest bank block across a page of documents.
 *
 * Takes the list as given rather than re-sorting it: the documents endpoint
 * returns newest first, and a client-side sort on a field this list may not
 * carry would be inventing an order. The first document that HAS a usable
 * block wins — an invoice issued without one does not erase the memory.
 */
export function newestBank(documents: unknown): BankDetails | null {
  for (const doc of asArray<DocumentAdmin>(documents)) {
    const found = bankFromFields((doc as { fields?: unknown }).fields);
    if (found) return found;
  }
  return null;
}

/** This device's copy. Wrapped: a private window throws on access. */
export function readLocalBank(): BankDetails {
  try {
    const raw = localStorage.getItem(BANK_KEY);
    if (!raw) return { ...EMPTY_BANK };
    const p = JSON.parse(raw) as Partial<BankDetails>;
    return {
      holder: p.holder ?? '',
      bank: p.bank ?? '',
      card: p.card ?? '',
      iban: p.iban ?? '',
    };
  } catch {
    return { ...EMPTY_BANK };
  }
}

export function saveLocalBank(bank: BankDetails): void {
  try {
    localStorage.setItem(BANK_KEY, JSON.stringify(bank));
  } catch {
    /* convenience only — the server copy is the one that matters */
  }
}
