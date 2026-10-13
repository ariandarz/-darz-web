/**
 * Text helpers the PDF and the composer share — kept out of `documentPdf.tsx`
 * so a page can use them without pulling in @react-pdf.
 */

/** The old `splitParagraphs` (`packages/domain/darz-studio-helpers.js:56`):
 * split on newlines, every non-empty line a paragraph. */
export function paragraphs(text: string | undefined): string[] {
  return String(text ?? '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}
