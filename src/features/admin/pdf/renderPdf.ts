/**
 * renderPdf — the non-component entry the composer lazy-imports: document
 * fields in, PDF bytes out (kept apart from `documentPdf.tsx` so that file
 * exports only components).
 */
import { createElement, type ReactElement } from 'react';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import { DarzDocument, type DocumentPdfFields } from './documentPdf';
import { DarzPricelist } from './pricelistPdf';
import type { PricelistPdfFields } from './pricelistFields';

export type { DocumentPdfFields, PricelistPdfFields };

export async function renderDocumentPdf(
  kind: 'exhibition_proposal' | 'exhibition_invoice',
  fields: DocumentPdfFields,
): Promise<Blob> {
  // createElement keeps this file JSX-free; the element IS a react-pdf
  // <Document>, which the cast states
  return pdf(
    createElement(DarzDocument, { kind, fields }) as unknown as ReactElement<DocumentProps>,
  ).toBlob();
}

/** P3c — the formatted Darz pricelist (`pricelistPdf.tsx`). */
export async function renderPricelistPdf(fields: PricelistPdfFields): Promise<Blob> {
  return pdf(
    createElement(DarzPricelist, { fields }) as unknown as ReactElement<DocumentProps>,
  ).toBlob();
}
