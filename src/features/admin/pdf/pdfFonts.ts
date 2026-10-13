/**
 * pdfFonts — the brand faces every client-rendered Darz PDF embeds, registered
 * ONCE for the whole lazy PDF chunk (react-pdf's `Font` registry is global, so
 * two modules each registering "Barlow" would race over one family).
 *
 * Barlow 300/600/700 and Cormorant Garamond 500/600 are the documents' TTFs.
 * Barlow 300 italic is the formatted pricelist's title line (`pricelist.html`
 * `.pl-row .ti`, italic 300) — the Fontsource WOFF, which fontkit reads; the
 * family had no italic face before P3c.
 */
import { Font } from '@react-pdf/renderer';
import barlowLight from './fonts/Barlow-Light.ttf';
import barlowSemi from './fonts/Barlow-SemiBold.ttf';
import barlowBold from './fonts/Barlow-Bold.ttf';
import cormorantMedium from './fonts/Cormorant-Medium.ttf';
import cormorantSemi from './fonts/Cormorant-SemiBold.ttf';
import barlowLightItalic from '@fontsource/barlow/files/barlow-latin-300-italic.woff';

Font.register({
  family: 'Barlow',
  fonts: [
    { src: barlowLight, fontWeight: 300 },
    { src: barlowLightItalic, fontWeight: 300, fontStyle: 'italic' },
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
