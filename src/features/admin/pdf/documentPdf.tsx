/**
 * documentPdf — the Darz proposal / services-invoice PDF, rendered
 * CLIENT-SIDE (the backend "never generates document visuals" — its own
 * words on `Document.object_key`) and uploaded to the exhibition document.
 *
 * The design is the golden fixtures' paper theme, one for one:
 * `../DarzStudio/test/fixtures/proposal-golden.html` / `invoice-golden.html`
 * — lockup + kicker/meta head, 1pt seam, Cormorant title, facts grid,
 * the priced lines, totals, note inset, bank block (invoice), terms, the
 * two signature columns, `darz.art` foot. Fixture px sizes ride at ×0.75pt.
 *
 * Fonts are the brand's own (Barlow 300/600/700, Cormorant Garamond 500),
 * bundled as TTFs — @react-pdf embeds them, so the PDF looks the same on
 * every machine, offline included.
 *
 * This module is HEAVY (@react-pdf/renderer) — always `import()` it lazily
 * from the composer, never statically from a page.
 */
import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import barlowLight from './fonts/Barlow-Light.ttf';
import barlowSemi from './fonts/Barlow-SemiBold.ttf';
import barlowBold from './fonts/Barlow-Bold.ttf';
import cormorantMedium from './fonts/Cormorant-Medium.ttf';
import cormorantSemi from './fonts/Cormorant-SemiBold.ttf';

Font.register({
  family: 'Barlow',
  fonts: [
    { src: barlowLight, fontWeight: 300 },
    { src: barlowSemi, fontWeight: 600 },
    { src: barlowBold, fontWeight: 700 },
  ],
});
Font.register({
  family: 'Cormorant Garamond',
  fonts: [
    { src: cormorantMedium, fontWeight: 500 },
    { src: cormorantSemi, fontWeight: 600 },
  ],
});
// long strings (IBANs, notes) must wrap by character, not hyphenate
Font.registerHyphenationCallback((word) => [word]);

/* the paper palette (fixture `:root.paper`) */
const INK = '#0A0A0A';
const TEXT = '#3C3C3C';
const LBL = '#9A9A9A';
const HAIR = '#EBEBEB';
const NOTE_BG = '#F7F7F7';

const st = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 46,
    paddingHorizontal: 45,
    fontFamily: 'Barlow',
    fontWeight: 300,
    fontSize: 10,
    lineHeight: 1.5,
    color: TEXT,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  wm: { fontSize: 13.5, color: INK, fontWeight: 300 },
  wmBold: { fontWeight: 700 },
  kicker: {
    fontSize: 7.6,
    fontWeight: 700,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#767676',
    marginBottom: 4,
    textAlign: 'right',
  },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 1 },
  metaK: {
    fontSize: 6.8,
    fontWeight: 700,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: LBL,
    marginRight: 9,
    marginTop: 1.6,
  },
  metaV: { fontSize: 9, color: INK },
  seam: { height: 1, backgroundColor: INK, marginTop: 8, marginBottom: 12 },
  h1: {
    fontFamily: 'Cormorant Garamond',
    fontWeight: 500,
    fontSize: 18,
    color: INK,
    lineHeight: 1.15,
  },
  sub: { fontSize: 10, color: TEXT, marginTop: 2 },
  facts: { flexDirection: 'row', marginTop: 12, gap: 15 },
  fact: { flexGrow: 1, flexBasis: 0 },
  factK: {
    fontSize: 6.8,
    fontWeight: 700,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: LBL,
    marginBottom: 2,
  },
  factV: { fontSize: 9.6, color: INK },
  secLbl: {
    fontSize: 7.4,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#767676',
    marginTop: 18,
    marginBottom: 6,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: HAIR,
    paddingVertical: 7,
    gap: 12,
  },
  lineMain: { flexGrow: 1, flexBasis: 0 },
  lineT: { fontSize: 10, fontWeight: 600, color: INK },
  lineD: { fontSize: 8.6, color: LBL, marginTop: 1 },
  lineP: { fontSize: 10, fontWeight: 600, color: INK },
  totals: { alignSelf: 'flex-end', width: 200, marginTop: 10 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totK: { fontSize: 9, color: TEXT },
  totV: { fontSize: 9.6, color: INK },
  totGrand: { borderTopWidth: 1, borderTopColor: INK, marginTop: 4, paddingTop: 6 },
  totGrandK: { fontSize: 10.4, fontWeight: 700, color: INK },
  totGrandV: { fontSize: 12.6, fontWeight: 700, color: INK },
  noteBlock: { backgroundColor: NOTE_BG, padding: 10, marginTop: 14, borderRadius: 3 },
  noteK: {
    fontSize: 6.8,
    fontWeight: 700,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: LBL,
    marginBottom: 3,
  },
  noteV: { fontSize: 9.4, color: TEXT, lineHeight: 1.55 },
  bankGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  bankCell: { width: '50%', paddingRight: 12, marginBottom: 6 },
  sigRow: { flexDirection: 'row', gap: 24, marginTop: 26 },
  sigCol: { flexGrow: 1, flexBasis: 0 },
  sigHead: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#767676',
    marginBottom: 14,
  },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#DCDCDC',
    marginTop: 16,
    marginBottom: 3,
  },
  sigLbl: { fontSize: 7.4, color: LBL },
  foot: {
    position: 'absolute',
    bottom: 20,
    left: 45,
    right: 45,
    textAlign: 'center',
    fontSize: 8,
    color: LBL,
    letterSpacing: 0.5,
  },
});

export interface DocumentPdfFields {
  reference?: string;
  doc_label?: string;
  issued_at?: string;
  show?: {
    title?: string;
    gallery?: string;
    artists?: string;
    dates?: string;
    venue?: string;
    project?: string;
  };
  billed_to?: string;
  lines?: Array<{ title?: string; description?: string; price?: string; currency?: string }>;
  currency?: string;
  subtotal?: number;
  discount?: number;
  total?: number;
  note?: string;
  terms?: string;
  bank?: { holder?: string; bank?: string; card?: string; iban?: string };
}

const SYM: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', TMN: 'T ', T: 'T ' };
const moneyStr = (currency: string | undefined, n: number | undefined) => {
  const code = String(currency ?? '').toUpperCase();
  const prefix = SYM[code] ?? (code ? `${code} ` : '');
  return prefix + String(Math.round(n ?? 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <View style={st.metaRow}>
      <Text style={st.metaK}>{k}</Text>
      <Text style={st.metaV}>{v}</Text>
    </View>
  );
}

export function DarzDocument({
  kind,
  fields,
}: {
  kind: 'exhibition_proposal' | 'exhibition_invoice';
  fields: DocumentPdfFields;
}) {
  const invoice = kind === 'exhibition_invoice';
  const show = fields.show ?? {};
  const lines = fields.lines ?? [];
  const facts: Array<[string, string | undefined]> = [
    ['Dates', show.dates],
    ['Space', show.venue],
    ['Project', show.project],
  ];
  if (invoice) facts.unshift(['Billed to', fields.billed_to]);
  const shownFacts = facts.filter(([, v]) => v);
  const bank = fields.bank ?? {};
  const bankRows: Array<[string, string | undefined]> = [
    ['Account holder', bank.holder],
    ['Bank', bank.bank],
    ['Card no.', bank.card],
    ['Sheba (IBAN)', bank.iban],
  ].filter(([, v]) => v) as Array<[string, string]>;

  return (
    <Document title={`${show.title ?? ''} — ${fields.doc_label ?? ''}`} creator="darz.art">
      <Page size="A4" style={st.page}>
        <View style={st.top}>
          <Text style={st.wm}>
            darz<Text style={st.wmBold}>.art</Text>
          </Text>
          <View>
            <Text style={st.kicker}>
              {fields.doc_label ?? (invoice ? 'Services invoice' : 'Exhibition proposal')}
            </Text>
            <Meta k="Issued by" v="Darz.art" />
            <Meta k="Issued" v={fields.issued_at ?? ''} />
            <Meta k="Reference" v={fields.reference ?? ''} />
          </View>
        </View>
        <View style={st.seam} />

        <Text style={st.h1}>{show.title ?? ''}</Text>
        <Text style={st.sub}>{[show.gallery, show.artists].filter(Boolean).join(' · ')}</Text>

        {shownFacts.length > 0 && (
          <View style={st.facts}>
            {shownFacts.map(([k, v]) => (
              <View style={st.fact} key={k}>
                <Text style={st.factK}>{k}</Text>
                <Text style={st.factV}>{v}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={st.secLbl}>
          {invoice ? 'Exhibition services' : 'Proposed for this exhibition'}
        </Text>
        {lines.map((l, i) => (
          <View style={st.line} key={i} wrap={false}>
            <View style={st.lineMain}>
              <Text style={st.lineT}>{l.title ?? ''}</Text>
              {l.description ? <Text style={st.lineD}>{l.description}</Text> : null}
            </View>
            <Text style={st.lineP}>
              {l.price
                ? `${SYM[String(l.currency ?? '').toUpperCase()] ?? `${l.currency ?? ''} `}${l.price}`
                : 'On confirmation'}
            </Text>
          </View>
        ))}

        <View style={st.totals}>
          <View style={st.totRow}>
            <Text style={st.totK}>Subtotal</Text>
            <Text style={st.totV}>{moneyStr(fields.currency, fields.subtotal)}</Text>
          </View>
          {(fields.discount ?? 0) > 0 && (
            <View style={st.totRow}>
              <Text style={st.totK}>Discount</Text>
              <Text style={st.totV}>−{moneyStr(fields.currency, fields.discount)}</Text>
            </View>
          )}
          <View style={[st.totRow, st.totGrand]}>
            <Text style={st.totGrandK}>{invoice ? 'Total due' : 'Total'}</Text>
            <Text style={st.totGrandV}>{moneyStr(fields.currency, fields.total)}</Text>
          </View>
        </View>

        {fields.note ? (
          <View style={st.noteBlock} wrap={false}>
            <Text style={st.noteK}>Note from Darz</Text>
            <Text style={st.noteV}>{fields.note}</Text>
          </View>
        ) : null}

        {invoice && bankRows.length > 0 && (
          <View wrap={false}>
            <Text style={st.secLbl}>Bank account details</Text>
            <View style={st.bankGrid}>
              {bankRows.map(([k, v]) => (
                <View style={st.bankCell} key={k}>
                  <Text style={st.factK}>{k}</Text>
                  <Text style={st.factV}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {fields.terms ? (
          <View wrap={false}>
            <Text style={st.secLbl}>Terms</Text>
            <Text style={st.noteV}>{fields.terms}</Text>
          </View>
        ) : null}

        <View style={st.sigRow} wrap={false}>
          <View style={st.sigCol}>
            <Text style={st.sigHead}>From the gallery</Text>
            <View style={st.sigLine} />
            <Text style={st.sigLbl}>Name</Text>
            <View style={st.sigLine} />
            <Text style={st.sigLbl}>Date</Text>
          </View>
          <View style={st.sigCol}>
            <Text style={st.sigHead}>From Darz.art</Text>
            <View style={st.sigLine} />
            <Text style={st.sigLbl}>Name</Text>
            <View style={st.sigLine} />
            <Text style={st.sigLbl}>Date</Text>
          </View>
        </View>

        <Text style={st.foot} fixed>
          darz.art
        </Text>
      </Page>
    </Document>
  );
}
