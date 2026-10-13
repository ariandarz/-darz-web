/**
 * pricelistPdf — the formatted Darz pricelist (P3c), rendered CLIENT-SIDE and
 * stored against the pricelist (`POST …/pricelists/{id}/rendered/`), the same
 * "the backend never generates document visuals" rule as every document here.
 *
 * The design is the old Listed Pricelist's A4 sheet on its white ground
 * (`../DarzStudio/pricelist.html` — `renderSheet` :747-799, CSS :59-66 and
 * :88-135), one for one: the masthead (date on the left; the darzmarket.art
 * Cormorant lockup with its 26px chroma line on the right) over a hairline,
 * the eyebrow / serif title / intro block, the 1.5px chroma seam, the
 * "No. · Artist · Work · Price" head, one row per work (number, artist,
 * italic title + year, the detail line, the price with its accent currency or
 * "Price on request") and the masthead foot. Sheet px ride at ×0.75pt.
 *
 * Not ported, with the reason: the 56px thumbnail column — a built line
 * carries an artwork id, not an image, and the snapshot's presigned image is
 * cross-origin to the renderer; the sheet's edit-in-place, style mode, cream
 * and black grounds — those are the builder's own tools, not the document;
 * the logistics terms block — no logistics backend (V2).
 *
 * HEAVY (@react-pdf/renderer) — reached only through `renderPdf.ts`'s lazy
 * `import()`, never statically from a page.
 */
import {
  Defs,
  Document,
  LinearGradient,
  Page,
  Rect,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer';
import './pdfFonts';
import type { PricelistPdfFields } from './pricelistFields';

/* the WHITE ground (`#sheet .pl…`, pricelist.html:59-66) */
const INK = '#0A0A0A';
const TEXT = '#3C3C3C';
const MUTED = '#9A9A9A';
const HAIR = '#EBEBEB';
const ACCENT = '#E11D48';
const CYAN = '#00D4CC';
const MAGENTA = '#E8005C';

const st = StyleSheet.create({
  // .pl — padding 62px 66px 56px
  page: {
    paddingTop: 46.5,
    paddingBottom: 42,
    paddingHorizontal: 49.5,
    fontFamily: 'Barlow',
    fontWeight: 300,
    fontSize: 10,
    color: INK,
  },
  // .pl-top
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 15,
    borderBottomWidth: 0.75,
    borderBottomColor: HAIR,
  },
  // .pl-meta / .pl-date
  meta: {
    fontSize: 7.9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: MUTED,
    fontWeight: 600,
    lineHeight: 1.8,
  },
  lock: { alignItems: 'flex-end' },
  // .pl-wm (22px Cormorant 600, .d + .s)
  wm: { fontFamily: 'Cormorant Garamond', fontWeight: 600, fontSize: 16.5, color: INK },
  // .pl-titleblock / .pl-eyebrow / .pl-title / .pl-sub
  titleblock: { marginTop: 28.5 },
  eyebrow: {
    fontSize: 8.25,
    letterSpacing: 2.1,
    textTransform: 'uppercase',
    fontWeight: 700,
    color: INK,
  },
  title: {
    fontFamily: 'Cormorant Garamond',
    fontWeight: 500,
    fontSize: 33,
    lineHeight: 1.04,
    marginTop: 8.25,
    color: INK,
  },
  sub: { fontSize: 9.75, lineHeight: 1.7, color: TEXT, marginTop: 11.25, maxWidth: 330 },
  // .pl-head — 34px | 1fr | 150px
  head: {
    flexDirection: 'row',
    paddingTop: 9.75,
    paddingBottom: 6.75,
    borderBottomWidth: 1.1,
    borderBottomColor: INK,
  },
  headCell: {
    fontSize: 7.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontWeight: 700,
    color: MUTED,
  },
  // .pl-row — no row divider, whitespace separates (v1130)
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  colNo: { width: 25.5, marginRight: 10.5 },
  colMain: { flexGrow: 1, flexBasis: 0, marginRight: 10.5 },
  colPrice: { width: 112.5, alignItems: 'flex-end' },
  no: { fontSize: 9, color: MUTED },
  ar: { fontSize: 11.25, fontWeight: 600, color: INK },
  ti: { fontSize: 10.1, fontStyle: 'italic', fontWeight: 300, color: TEXT, marginTop: 1 },
  dt: { fontSize: 8.6, color: MUTED, marginTop: 2.25 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  n: { fontSize: 13.5, fontWeight: 600, color: INK },
  c: { fontSize: 8.25, fontWeight: 600, color: ACCENT, marginLeft: 3 },
  por: { fontSize: 9, fontWeight: 600, color: MUTED },
  // .pl-foot
  foot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 21,
    paddingTop: 10.5,
    borderTopWidth: 0.75,
    borderTopColor: HAIR,
    fontSize: 8.25,
    color: MUTED,
  },
});

/** The chroma, cyan → magenta, as a gradient bar (react-pdf draws gradients
 * only inside an Svg). `id` must be unique per document. */
function Chroma({ id, width, height }: { id: string; width: number; height: number }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={CYAN} />
          <Stop offset="1" stopColor={MAGENTA} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

/** A4 content width at the sheet's side padding. */
const CONTENT_W = 595.28 - 2 * 49.5;

export function DarzPricelist({ fields }: { fields: PricelistPdfFields }) {
  return (
    <Document title={`${fields.title} — ${fields.eyebrow}`} creator="darzmarket.art">
      <Page size="A4" style={st.page}>
        <View style={st.top}>
          <Text style={st.meta}>{fields.date}</Text>
          <View style={st.lock}>
            <Text style={st.wm}>darzmarket.art</Text>
            {/* .pl-cline — 2px × 26px, 7px under the wordmark */}
            <View style={{ marginTop: 5.25 }}>
              <Chroma id="cline" width={19.5} height={1.5} />
            </View>
          </View>
        </View>

        <View style={st.titleblock}>
          {fields.eyebrow ? <Text style={st.eyebrow}>{fields.eyebrow}</Text> : null}
          <Text style={st.title}>{fields.title}</Text>
          {fields.intro ? <Text style={st.sub}>{fields.intro}</Text> : null}
        </View>

        {/* .pl-seam — 1.5px, 34px under the title block, at .9 */}
        <View style={{ marginTop: 25.5, opacity: 0.9 }}>
          <Chroma id="seam" width={CONTENT_W} height={1.1} />
        </View>

        <View style={st.head}>
          <Text style={[st.headCell, st.colNo]}>No.</Text>
          <Text style={[st.headCell, st.colMain]}>Artist · Work</Text>
          <Text style={[st.headCell, { width: 112.5, textAlign: 'right' }]}>Price</Text>
        </View>

        {fields.lines.map((l, i) => (
          <View style={st.row} key={i} wrap={false}>
            <Text style={[st.no, st.colNo]}>{String(i + 1).padStart(2, '0')}</Text>
            <View style={st.colMain}>
              {l.artist ? <Text style={st.ar}>{l.artist}</Text> : null}
              <Text style={l.artist ? st.ti : st.ar}>
                {l.title}
                {l.year ? `, ${l.year}` : ''}
              </Text>
              {l.details ? <Text style={st.dt}>{l.details}</Text> : null}
            </View>
            <View style={st.colPrice}>
              {l.price ? (
                <View style={st.priceRow}>
                  <Text style={st.n}>{l.price}</Text>
                  {l.currency ? <Text style={st.c}>{l.currency}</Text> : null}
                </View>
              ) : (
                <Text style={st.por}>Price on request</Text>
              )}
            </View>
          </View>
        ))}

        <View style={st.foot} wrap={false}>
          <Text>{fields.foot}</Text>
          <Text />
        </View>
      </Page>
    </Document>
  );
}
