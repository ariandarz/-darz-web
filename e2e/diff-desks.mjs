/**
 * Compare a fresh set of desk captures against a saved one.
 *
 * Written for TD-8 (splitting `admin.css`), where the whole safety argument is
 * "the rendered result did not change" and nothing could check it. The
 * refactor's own run is the reason this exists rather than a `cmp`: **two of
 * the 34 files differed byte-for-byte and were pixel-identical.** Chromium's
 * PNG encoder is not deterministic to the byte across runs — a re-render can
 * round an antialiased edge one value differently — so a byte comparison
 * reports changes that are not there, and a reviewer who trusts it either
 * chases nothing or, worse, stops trusting it.
 *
 * So this decodes both images and compares pixels, with a tolerance of 2 per
 * channel. That is far below anything a CSS change can produce (a moved
 * element, a changed colour, a different font all shift whole regions) and
 * above the encoder's own noise floor, which measured 1.
 *
 * Usage:
 *
 *   cp -r dist-desk-shots /tmp/baseline      # before the change
 *   …make the change, rebuild, re-capture…
 *   node e2e/diff-desks.mjs /tmp/baseline
 *
 * Exits non-zero if any desk really moved, and names it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const BASELINE = process.argv[2];
const CURRENT = new URL('../dist-desk-shots/', import.meta.url).pathname;
/** Per-channel difference that counts as a real change — see the header. */
const TOLERANCE = 2;

if (!BASELINE) {
  console.error('usage: node e2e/diff-desks.mjs <baseline-dir>');
  process.exit(2);
}

/** A minimal PNG decoder — enough for what Playwright writes (8-bit RGBA, no
 * interlace), so the harness needs no image dependency. */
function decode(path) {
  const d = readFileSync(path);
  let i = 8;
  let idat = [];
  let w, h, colourType;
  while (i < d.length) {
    const len = d.readUInt32BE(i);
    const type = d.toString('ascii', i + 4, i + 8);
    if (type === 'IHDR') {
      w = d.readUInt32BE(i + 8);
      h = d.readUInt32BE(i + 12);
      colourType = d[i + 17];
    } else if (type === 'IDAT') {
      idat.push(d.subarray(i + 8, i + 8 + len));
    }
    i += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[colourType];
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      if (filter === 1) line[x] = (line[x] + a) & 255;
      else if (filter === 2) line[x] = (line[x] + b) & 255;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return { w, h, ch, data: out };
}

let failed = 0;
let noise = 0;
for (const name of readdirSync(CURRENT).filter((f) => f.endsWith('.png')).sort()) {
  let a, b;
  try {
    a = decode(CURRENT + name);
    b = decode(`${BASELINE}/${name}`);
  } catch {
    console.log(`?  ${name} — no baseline to compare against`);
    continue;
  }
  if (a.w !== b.w || a.h !== b.h) {
    console.log(`✗  ${name} — size changed: ${a.w}x${a.h} was ${b.w}x${b.h}`);
    failed++;
    continue;
  }
  let changed = 0;
  let maxDelta = 0;
  for (let i = 0; i < a.data.length; i += a.ch) {
    for (let k = 0; k < 3; k++) {
      const delta = Math.abs(a.data[i + k] - b.data[i + k]);
      if (delta > maxDelta) maxDelta = delta;
      if (delta > TOLERANCE) {
        changed++;
        break;
      }
    }
  }
  if (changed > 0) {
    console.log(`✗  ${name} — ${changed} px changed (max delta ${maxDelta})`);
    failed++;
  } else if (maxDelta > 0) {
    noise++;
  }
}

console.log(
  failed === 0
    ? `✓ every desk renders identically${noise ? ` (${noise} differ only as encoder noise)` : ''}`
    : `${failed} desk(s) changed`,
);
process.exit(failed === 0 ? 0 : 1);
