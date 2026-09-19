/**
 * standardSet — "the standard set": Darz's REAL service catalogue as data,
 * plus the pure helpers that turn it into API bodies.
 *
 * WHAT THIS IS. 30 service lines, priced in TOMAN, copied from the two places
 * Darz's real services actually live:
 *
 *  1. THE 8 EXHIBITION SERVICES, with their real prices —
 *     `../darzmarket-api/apps/gallery/exhibition_catalogue.py:11-59`, itself a
 *     verbatim port of `../DarzStudio/gallery-update.html`'s `EXH_SVC`
 *     (:733-741). Those eight already serve the gallery portal and the
 *     exhibitions composer through `GET /api/options/`
 *     (`gallery.exhibition_service`), and THAT catalogue is not touched here:
 *     the lines are copied into the separate PROJECTS catalogue, each keeping
 *     its `serviceKey` so the two can be traced to each other later.
 *  2. THE 23 COVERAGE SERVICES, in 5 groups —
 *     `../DarzStudio/coverage-packages.html:231-265` ("Darz Studio —
 *     Exhibition Coverage Programmes", its `var DATA=[…]`). That menu carries
 *     NO prices by design: the gallery ticks the lines it wants and Darz
 *     quotes the show.
 *
 * THE CURRENCY (owner decision). Every seeded line is priced in TMN
 * ('Iranian Toman' on `GET /api/options/`) — Darz prices Iranian galleries in
 * Toman. International galleries come later and will be quoted in USD or EUR,
 * chosen at the time; nothing here pre-decides that.
 *
 * WHAT IS NOT HERE, and will not be invented:
 *  - NO invented prices. The seven priced exhibition lines carry their real
 *    Toman price and nothing else carries any: Darz Listing is "on request",
 *    and all 22 coverage-only lines are unpriced because that is the truth. Here
 *    `price: null` means "not set"; `serviceInput` sends `'0'` for it because
 *    the backend's `price` is a non-null decimal defaulting to 0, so a 0 on
 *    the desk reads as "not priced yet", never as "free". `UNPRICED_SERVICES`
 *    is that list, so the desk can say how many arrive unpriced.
 *  - NO internal costs. Darz has none recorded for these services (the demo's
 *    were invented too), so `internalCost` is 0 on every line and the
 *    calculator's margin reads as if cost were nil. Say so wherever a margin
 *    is shown.
 *  - NO descriptions on the backend (G-PROJ-8). `ProjectServiceCatalogItem`
 *    (`../darzmarket-api/apps/projects/models.py:71-76`) is name / category /
 *    unit / internal_cost / price / currency and has no description field, so
 *    each line's `about` — and a coverage line's `flow` / `time` / `need` —
 *    is kept HERE as documentation of what the service actually is, and
 *    CANNOT be stored. Only the NAMES carry over into the catalogue; the desk
 *    says that on screen.
 *  - NO invented units. Neither source states a unit and none of these
 *    services is plainly per-day or per-hour, so every line is 'piece'.
 *  - NO package fees. The five packages carry zeroed `internal` blocks: a
 *    group is a real Darz programme and its fee is quoted per show.
 *
 * WHAT WAS DROPPED, AND WHY. Until now this module held the old admin panel's
 * `projSeedIfEmpty` demo data (`../DarzStudio/darz-studio.html:13386-13433`):
 * 34 service lines and 8 package templates whose USD prices were INVENTED to
 * stop a demo looking empty. Those numbers drove the calculator's quotes, the
 * package fees and the line prices on client proposals — so invented numbers
 * reached clients. The owner ruled them out; they are gone and none of them
 * is copied into what follows. The one part of that seed that stays is the
 * four CHECKLIST templates (:13444-13447), which are workflow, not pricing.
 *
 * NEAR-DUPLICATES ARE KEPT, NOT MERGED (`NEAR_DUPLICATES`). Four coverage
 * lines look like priced exhibition services. Copying a price between two
 * services the owner never said were the same is the invented-number problem
 * again, so both sides are kept and the four pairs are listed for the owner
 * to merge in one pass. One pair — "Artist interview" / "Artist Interview" —
 * differs only in case, so the two collide on `nameKey`, the idempotency key
 * every plan and every line lookup uses; `NAME_COLLISIONS` carries that, and
 * says what it costs until the owner resolves the pair.
 *
 * HOW IT RUNS. Nothing here runs on its own: a server DB starts honest and
 * empty, so an owner clicks "Add the standard set" on the Packages desk and
 * these rows are written through the ordinary admin API, skipping by name
 * anything already there — a half-finished run resumes by clicking again.
 * Everything is pure: no React, no API calls, no clock, no `id`s. A package
 * names its service LINES and the runner resolves those names to the real ids
 * the API hands back (`serviceIdIndex`).
 */
import type {
  ChecklistTemplateInput,
  PackageTemplateInput,
  ProjectStage,
  ServiceCatalogItemInput,
  ServiceCategory,
} from '../../../api/types';
import {
  asCounts,
  blankPackage,
  type PackageCounts,
  type PackageInternal,
  type PackageLine,
  type PackagePaymentStage,
  type UNITS,
} from './projectForm';

/** The unit vocabulary of the service editor (`UNITS`, `darz-studio.html`
 * :13935). Every line below is 'piece': see the header — neither real source
 * states a unit, and a day or hour rate would be invented. */
type ServiceUnit = (typeof UNITS)[number];

/* ── service catalogue ──────────────────────────────────────────────────── */

/** Which of the two real menus a line comes from. */
export type StandardSource = 'exhibition' | 'coverage';

export interface StandardService {
  /** Verbatim from its source — also the idempotency key (see `nameKey`). */
  name: string;
  source: StandardSource;
  /** `exhibition` only: its `gallery.exhibition_service` key, so a line here
   * can be traced back to the catalogue the gallery portal already serves. */
  serviceKey?: string;
  /** `coverage` only: the group number as the source writes it ('01'…'05'). */
  group?: string;
  /** `coverage` only: that group's title, verbatim. */
  groupTitle?: string;
  category: ServiceCategory;
  unit: ServiceUnit;
  /** Always 0 — Darz has no internal cost recorded for these (header). */
  internalCost: number;
  /** The real price in `STANDARD_CURRENCY`, or `null` for "not set / on
   * request". Never a guess. */
  price: number | null;
  /** What the service IS: the exhibition line's `desc`, or the coverage
   * line's `val`. Documentation only — the backend cannot store it
   * (G-PROJ-8). */
  about: string;
  /** `coverage` only: how the service runs (`flow`). Documentation only. */
  flow?: string;
  /** `coverage` only: when it happens (`time`). Documentation only. */
  time?: string;
  /** `coverage` only: what Darz needs from the gallery (`need`).
   * Documentation only. */
  need?: string;
}

/* ── the category mapping ────────────────────────────────────────────────────
 * The backend serves four categories (`projects.service_category` — media /
 * production / curatorial / other). Only the VALUES are written here; every
 * label the desk shows comes from `useOptions()`, never from a lookup typed
 * in this repo. Neither real source carries a category, so each line is filed
 * by what the service is:
 *
 *  - production — anything shot, filmed or built: the five photo / video /
 *    film exhibition services, the whole of coverage group 02 Content
 *    Production, the designed "Digital pricelist / catalogue" (§03) and
 *    "Sales-ready documentation" (§05, the compiled archive).
 *  - curatorial — the two authored texts of §03: "Curatorial essay" and
 *    "Artwork descriptions".
 *  - media — everything placed on a Darz channel or sent to Darz's audience:
 *    all of §01 Announcement & Pre-Show, all of §04 Distribution on
 *    Instagram, four of the five §05 amplification lines, and the exhibition
 *    catalogue's two editorial lines (Artist Interview, Exhibition Review)
 *    plus Darz Listing, a placement in the Market App.
 *  - other — nothing. Neither real menu has a line that is neither media,
 *    production nor curatorial work, so the fourth category stays empty
 *    rather than being filled to look complete. (The old demo's `other` lines
 *    — project management, translation — went with the rest of it.)
 *
 * Two are judgement calls the owner may want to flip, and both are marked at
 * their own line below.
 */

/** The 30 real lines: the 8 exhibition services first, then the 22 coverage-only
 * services in their groups — each in its source file's own order. */
export const STANDARD_SERVICES: readonly StandardService[] = [
  /* the 8 exhibition services — `exhibition_catalogue.py` :11-59, in that file's order */
  {
    // exhibition_catalogue.py:13
    name: 'Exhibition Photo Coverage',
    source: 'exhibition',
    serviceKey: 'exhibition_photo',
    category: 'production',
    unit: 'piece',
    internalCost: 0,
    price: 700000,
    about:
      'Professional photographic documentation of the exhibition, including installation views, individual artworks, details, spatial elements, and overall atmosphere.',
  },
  {
    // exhibition_catalogue.py:19
    name: 'Video Documentation',
    source: 'exhibition',
    serviceKey: 'video_documentation',
    category: 'production',
    unit: 'piece',
    internalCost: 0,
    price: 10000000,
    about:
      'A short, professionally edited video documenting the exhibition, its spatial arrangement, artworks, and overall atmosphere.',
  },
  {
    // exhibition_catalogue.py:25
    name: 'Pre-opening Teaser',
    source: 'exhibition',
    serviceKey: 'preopening_teaser',
    category: 'production',
    unit: 'piece',
    internalCost: 0,
    price: 12000000,
    about:
      'A short, professionally edited teaser capturing the installation process and selected moments leading up to the exhibition opening.',
  },
  {
    // exhibition_catalogue.py:31
    name: 'Studio Visit & Interview',
    source: 'exhibition',
    serviceKey: 'studio_visit',
    category: 'production',
    unit: 'piece',
    internalCost: 0,
    price: 20000000,
    about:
      'A longer-form edited video featuring an interview with the artist, accompanied by photographic documentation of the artist, studio, and working process.',
  },
  {
    // exhibition_catalogue.py:37
    name: 'Cinematic Exhibition Film',
    source: 'exhibition',
    serviceKey: 'cinematic_film',
    category: 'production',
    unit: 'piece',
    internalCost: 0,
    price: 36000000,
    about:
      'A longer, visually driven video capturing the exhibition through cinematic footage, focusing on the artworks, spatial experience, and atmosphere.',
  },
  {
    // exhibition_catalogue.py:43
    name: 'Artist Interview',
    source: 'exhibition',
    serviceKey: 'artist_interview',
    // ALSO the coverage menu's §02 "Artist interview" (`coverage-packages.html`
    // `con-intv`). The two names are the same string but for one capital, and
    // the catalogue's idempotency key is case-folded, so they CANNOT be two
    // rows: one would never be written and the §02 programme would link to
    // whichever the catalogue happened to return first. They are one service,
    // and this is the side carrying Darz's real price, so it takes the group
    // membership and the coverage menu's own wording below. The other three
    // NEAR_DUPLICATES have genuinely different names and stay separate —
    // merging those is the owner's call, not one the key forces.
    group: '02',
    groupTitle: 'Content Production',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: 8000000,
    about: 'An editorial interview with the artist, produced and edited in Farsi and English.',
    flow: 'We prepare questions · record/edit · deliver clip + pull-quotes.',
    time: '~1 week',
    need: "30–45 min of the artist's time",
  },
  {
    // exhibition_catalogue.py:48
    name: 'Exhibition Review',
    source: 'exhibition',
    serviceKey: 'exhibition_review',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: 10000000,
    about:
      "An editorial review examining the exhibition's concept, artistic approach, works, and broader context, produced in Farsi and English.",
  },
  {
    // exhibition_catalogue.py:54
    name: 'Darz Listing',
    source: 'exhibition',
    serviceKey: 'darz_listing',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about:
      'Selected artworks listed on the private Darz Market App, providing direct access to a curated network of collectors and art professionals.',
  },
  /* group 01 Announcement & Pre-Show — coverage-packages.html:232 */
  {
    // coverage-packages.html:233
    name: 'Exhibition announcement',
    source: 'coverage',
    group: '01',
    groupTitle: 'Announcement & Pre-Show',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about:
      'A designed feed post on the Darz channel announcing your show — artist, title, dates, venue.',
    flow: 'We design from your key image and details · one round of approval · scheduled.',
    time: 'Live 7–10 days before opening',
    need: 'Key image, artist, dates, venue, one-line blurb',
  },
  {
    // coverage-packages.html:234
    name: 'Save-the-date stories',
    source: 'coverage',
    group: '01',
    groupTitle: 'Announcement & Pre-Show',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'A 3–5 frame story countdown — date reveal, artist teaser, a signature work.',
    flow: 'Built from the announcement assets · posted across the opening week.',
    time: 'Starts ~5 days out',
    need: 'Same assets, optional artist quote',
  },
  {
    // coverage-packages.html:235
    name: 'Artist introduction',
    source: 'coverage',
    group: '01',
    groupTitle: 'Announcement & Pre-Show',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'A carousel introducing the artist — portrait, short bio, 2–3 signature works.',
    flow: 'We write/edit the bio · design the carousel · you approve.',
    time: '5–7 days before',
    need: 'Artist portrait, bio/CV, image rights',
  },
  {
    // coverage-packages.html:236
    name: 'Press note & listings',
    source: 'coverage',
    group: '01',
    groupTitle: 'Announcement & Pre-Show',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'A clean press text plus submission to relevant art listings and contacts.',
    flow: 'We draft · you approve · we distribute.',
    time: '10–14 days before',
    need: 'Show details, any embargo date',
  },
  /* group 02 Content Production — coverage-packages.html:238 */
  {
    // coverage-packages.html:239
    name: 'Installation photography',
    source: 'coverage',
    group: '02',
    groupTitle: 'Content Production',
    category: 'production',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'Professional photos of the hung exhibition — full room views and detail shots.',
    flow: 'On-site shoot · colour-corrected edit · delivered web + print sizes.',
    time: 'Shoot day-of · 3–4 day delivery',
    need: 'Access window with lighting on, work list',
  },
  {
    // coverage-packages.html:240
    name: 'Opening-night coverage',
    source: 'coverage',
    group: '02',
    groupTitle: 'Content Production',
    category: 'production',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'Candid documentation of the opening — atmosphere, crowd, collectors.',
    flow: 'On-site shoot · curated, story-ready edit.',
    time: 'Opening night · same-week delivery',
    need: 'Timing, consent for recognisable faces',
  },
  {
    // coverage-packages.html:241
    name: 'Artwork photography',
    source: 'coverage',
    group: '02',
    groupTitle: 'Content Production',
    category: 'production',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'Catalogue-grade shots of individual works, ready for sales and print.',
    flow: 'Wall/studio shoot · colour-corrected · multiple sizes.',
    time: '4–6 days',
    need: 'Access to works, titles & dimensions',
  },
  {
    // coverage-packages.html:242
    name: 'Video walkthrough / reel',
    source: 'coverage',
    group: '02',
    groupTitle: 'Content Production',
    category: 'production',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'A short vertical reel walking through the show, paced and captioned.',
    flow: 'We shoot + edit to a 20–40s reel with captions and music.',
    time: 'From opening · 4–5 day delivery',
    need: 'Quiet access window; artist optional',
  },
  /* group 03 Editorial & Catalogue — coverage-packages.html:245 */
  {
    // coverage-packages.html:246
    name: 'Curatorial essay',
    source: 'coverage',
    group: '03',
    groupTitle: 'Editorial & Catalogue',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'An original text framing the exhibition — its concept, the work, the artist.',
    flow: 'We interview + write · you approve · formatted for web and print.',
    time: '7–10 days',
    need: 'Concept notes, artist input',
  },
  {
    // coverage-packages.html:247
    name: 'Artwork descriptions',
    source: 'coverage',
    group: '03',
    groupTitle: 'Editorial & Catalogue',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'Concise, consistent written entries for each work.',
    flow: 'We write from your data and images.',
    time: '4–6 days',
    need: 'Work list with details',
  },
  {
    // coverage-packages.html:248
    name: 'Digital pricelist / catalogue',
    source: 'coverage',
    group: '03',
    groupTitle: 'Editorial & Catalogue',
    // judgement call — a designed artefact built from supplied data, so production rather than the
    // curatorial writing it sits beside (the old demo filed 'Catalogue development' under
    // curatorial; flip it if the owner reads it that way)
    category: 'production',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'A designed Darz pricelist or catalogue of the show — share and print ready.',
    flow: 'Built in the Darz template · delivered as a clean document.',
    time: '3–5 days after data',
    need: 'Full work list, prices, images',
  },
  /* group 04 Distribution on Instagram — coverage-packages.html:250 */
  {
    // coverage-packages.html:251
    name: 'Feed post on @darz',
    source: 'coverage',
    group: '04',
    groupTitle: 'Distribution on Instagram',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'One designed post placed on the Darz channel to our audience.',
    flow: 'Designed · scheduled · posted with tags.',
    time: 'Scheduled slot',
    need: 'Approved assets',
  },
  {
    // coverage-packages.html:252
    name: 'Collaborator (co-author) post',
    source: 'coverage',
    group: '04',
    groupTitle: 'Distribution on Instagram',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about:
      "One post that appears on BOTH the gallery's feed and Darz's — two audiences, one post.",
    flow: 'We publish as an Instagram collab so it lands on both grids and pools the reach.',
    time: 'Scheduled slot',
    need: 'Gallery handle + accept the collab invite',
  },
  {
    // coverage-packages.html:253
    name: 'Story series',
    source: 'coverage',
    group: '04',
    groupTitle: 'Distribution on Instagram',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'A multi-frame story set — works, details, link and tags.',
    flow: 'Designed · posted with tags and your handle.',
    time: 'Across show week',
    need: 'Assets, accounts to tag',
  },
  {
    // coverage-packages.html:254
    name: 'Reel placement',
    source: 'coverage',
    group: '04',
    groupTitle: 'Distribution on Instagram',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'A short vertical video on the Darz channel — the highest-reach format.',
    flow: 'Edited reel (from your footage or our shoot) · scheduled.',
    time: 'Scheduled slot',
    need: 'Footage, or add the shoot from §02',
  },
  {
    // coverage-packages.html:255
    name: 'Carousel of works',
    source: 'coverage',
    group: '04',
    groupTitle: 'Distribution on Instagram',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'A swipeable set of the key works with captions.',
    flow: 'Designed multi-image post · scheduled.',
    time: 'Scheduled slot',
    need: 'Selected works + captions',
  },
  {
    // coverage-packages.html:256
    name: 'Highlight placement',
    source: 'coverage',
    group: '04',
    groupTitle: 'Distribution on Instagram',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'Your show saved into a permanent Darz story Highlight with a curated cover.',
    flow: 'Stories grouped under a designed highlight cover · kept after the run.',
    time: 'During the run',
    need: 'Stories posted first',
  },
  /* group 05 Amplification & Collector Reach — coverage-packages.html:258 */
  {
    // coverage-packages.html:259
    name: 'Featured in weekly highlights',
    source: 'coverage',
    group: '05',
    groupTitle: 'Amplification & Collector Reach',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about:
      'An editorial feature in the Darz weekly highlight — a curated pick, not just a post.',
    flow: 'Selected + placed by the Darz editorial desk.',
    time: 'One week of the run',
    need: 'Approved assets',
  },
  {
    // coverage-packages.html:260
    name: 'Collector network push',
    source: 'coverage',
    group: '05',
    groupTitle: 'Amplification & Collector Reach',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'Your works surfaced inside the private Darz collector app and network.',
    flow: 'Curated into the Market App · collectors notified.',
    time: 'During the run',
    need: 'Work list with images and prices',
  },
  {
    // coverage-packages.html:261
    name: 'Direct collector push',
    source: 'coverage',
    group: '05',
    groupTitle: 'Amplification & Collector Reach',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'A dedicated mention sent straight to collectors.',
    flow: 'We write + send to the collector list.',
    time: 'Scheduled',
    need: 'Approved copy and images',
  },
  {
    // coverage-packages.html:262
    name: 'Paid promotion / boost',
    source: 'coverage',
    group: '05',
    groupTitle: 'Amplification & Collector Reach',
    category: 'media',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about: 'Sponsored reach on a chosen post to a targeted audience, with a reach report.',
    flow: 'We set targeting · run the boost · report the results.',
    time: 'Runs over set days',
    need: 'Budget sign-off, target audience',
  },
  {
    // coverage-packages.html:263
    name: 'Sales-ready documentation',
    source: 'coverage',
    group: '05',
    groupTitle: 'Amplification & Collector Reach',
    category: 'production',
    unit: 'piece',
    internalCost: 0,
    price: null,
    about:
      'A complete archive of the show — photos, texts and list — for your records and sales.',
    flow: 'All assets compiled into one delivered package.',
    time: 'After the show closes',
    need: 'Access to all gathered assets',
  },
];

/** Owner decision: Darz prices Iranian galleries in Toman, so every seeded
 * line is written in TMN ('Iranian Toman' on `GET /api/options/`).
 * International galleries come later and will be quoted in USD or EUR, chosen
 * at the time — that is not decided here. The desk still checks this value
 * against the served `currency` options before using it, so the enum is never
 * assumed. */
export const STANDARD_CURRENCY = 'TMN';

/** The lines that arrive with no price — the 22 coverage-only services plus Darz
 * Listing. Exposed so the desk can say "N of these arrive unpriced" instead
 * of letting a 0 on the catalogue read as "free". */
export const UNPRICED_SERVICES: readonly StandardService[] = STANDARD_SERVICES.filter(
  (s) => s.price === null,
);

/* ── near-duplicates: kept, listed, never merged ────────────────────────── */

export interface NearDuplicate {
  /** The coverage line's name, verbatim. */
  coverage: string;
  /** The exhibition line's name, verbatim. */
  exhibition: string;
  /** What overlaps and what differs — the note the owner decides from. */
  why: string;
  /** True when the two names case-fold to ONE `nameKey`. Derived from the
   * names above, so it can never drift from them. */
  sameNameKey: boolean;
}

/** Four coverage lines look like priced exhibition services. They are NOT
 * merged and no price is copied across: two services the owner never said
 * were the same would otherwise end up sharing an invented price, which is
 * the whole problem this data exists to undo. Both sides are seeded; this is
 * the list the desk shows so the owner can merge them in one pass. */
export const NEAR_DUPLICATES: readonly NearDuplicate[] = [
  {
    coverage: 'Installation photography',
    exhibition: 'Exhibition Photo Coverage',
    why: 'Both photograph the hung show. The coverage line is the §02 on-site shoot and carries no price; the exhibition line is the priced one the gallery portal already offers (700,000 T).',
  },
  {
    coverage: 'Video walkthrough / reel',
    exhibition: 'Video Documentation',
    why: 'Both are an edited video of the show. The coverage line is a 20–40s captioned vertical reel; the exhibition line is a short documentary edit, priced at 10,000,000 T.',
  },
  {
    coverage: 'Collector network push',
    exhibition: 'Darz Listing',
    why: 'Both put the works in front of the Darz collector network. The coverage line is the §05 push into the Market App; the exhibition line is the Market App listing itself, quoted on request.',
  },
].map((p) => ({ ...p, sameNameKey: sameName(p.coverage, p.exhibition) }));
// A fourth pair is NOT here: "Artist interview" and "Artist Interview" are the
// same string but for a capital, so the folded key cannot hold both and one
// row would simply never be written. That pair is merged into the priced line;
// the three above have different names, so whether they are one service is the
// owner's call.

export interface NameCollision {
  /** The shared `nameKey`. */
  key: string;
  /** Every `STANDARD_SERVICES` name that folds to it, in catalogue order. */
  names: readonly string[];
}

function collisions(rows: readonly { name: string }[]): NameCollision[] {
  const byKey = new Map<string, string[]>();
  for (const r of rows) {
    const k = nameKey(r.name);
    const hit = byKey.get(k);
    if (hit) hit.push(r.name);
    else byKey.set(k, [r.name]);
  }
  const out: NameCollision[] = [];
  for (const [key, names] of byKey) if (names.length > 1) out.push({ key, names });
  return out;
}

/**
 * Names that case-fold to the SAME `nameKey` — today exactly one:
 * "Artist interview" (coverage §02) and "Artist Interview" (the exhibition
 * catalogue). Neither is renamed, because renaming a real service is
 * inventing copy, so the cost is stated instead:
 *
 *  - a run writes BOTH rows, and the catalogue then holds two lines whose
 *    names differ only in case;
 *  - `serviceIdIndex` keeps the FIRST row per key, so the "Content
 *    Production" package's "Artist interview" line links to whichever of the
 *    two the catalogue read returns first — possibly the priced one;
 *  - a second run skips both, so nothing multiplies.
 *
 * The fix is the owner's, not this module's: merge the pair (it is also the
 * third entry of `NEAR_DUPLICATES`) or rename one side, then re-link that
 * package's line.
 */
export const NAME_COLLISIONS: readonly NameCollision[] = collisions(STANDARD_SERVICES);

/* ── package templates: the 5 coverage groups ───────────────────────────── */

/** One service line of a template, named rather than id'd: a template links
 * its lines by the id the API hands back, which does not exist until the
 * catalogue rows are written, so the runner resolves the NAME. */
export interface StandardPackageLine {
  /** Matches a `StandardService.name`. */
  service: string;
  count: number;
}

/** What a template overrides on top of the shared defaults — `blankPackage()`
 * (`darz-studio.html:13954` `_blankPkg`): counts zeroed, onsite false,
 * revisions 1, "One internal + one client review.", "Darz channels; client
 * re-use with credit.", "12 months", deposit 50, Deposit 50 / On delivery 50,
 * "Deposit non-refundable once work has begun." The five groups override one
 * thing only: `internal`, zeroed (see below). */
export interface StandardPackageOverrides {
  onsite?: boolean;
  usageRights?: string;
  archiveDuration?: string;
  internal?: PackageInternal;
  depositPct?: number;
  paymentStages?: readonly PackagePaymentStage[];
}

export interface StandardPackage {
  name: string;
  purpose: string;
  lines: readonly StandardPackageLine[];
  /** Only the keys a template sets; the rest stay at the shared zeroes. The
   * five groups set none — a deliverable count is per show. */
  counts: Partial<PackageCounts>;
  overrides?: StandardPackageOverrides;
}

/**
 * No fee, anywhere. `blankPackage()` starts a NEW package at a 40% target
 * margin, which is the editor's own default for something an owner is about
 * to price; these five are not that. A coverage group is a real Darz
 * programme whose fee is quoted per show, so every figure in its `internal`
 * block is 0 — including `targetMargin`, because a 40 sitting there would
 * read as a target Darz set for these programmes, and nobody set one. Set
 * them on the desk when a show is priced.
 */
function zeroInternal(): PackageInternal {
  return { internalCost: 0, externalCost: 0, minFee: 0, recFee: 0, targetMargin: 0 };
}

/** The five groups of `coverage-packages.html`, verbatim (`no` / `title` /
 * `desc`). A group IS the package: its title names it, its `desc` is the
 * purpose, and its own services are its lines. */
const COVERAGE_GROUPS: readonly { no: string; title: string; desc: string }[] = [
  {
    // coverage-packages.html:232
    no: '01',
    title: 'Announcement & Pre-Show',
    desc: 'Build anticipation before the doors open — the audience should know your show before opening night.',
  },
  {
    // coverage-packages.html:238
    no: '02',
    title: 'Content Production',
    desc: 'The raw material everything else is built from — photography, video and interviews, shot to a professional standard.',
  },
  {
    // coverage-packages.html:245
    no: '03',
    title: 'Editorial & Catalogue',
    desc: 'Written depth that gives the work context and makes it sellable and quotable.',
  },
  {
    // coverage-packages.html:250
    no: '04',
    title: 'Distribution on Instagram',
    desc: 'The reach engine. How the show actually travels — on the Darz channel and, where it counts, co-published onto your own grid.',
  },
  {
    // coverage-packages.html:258
    no: '05',
    title: 'Amplification & Collector Reach',
    desc: 'Beyond the public feed — targeted reach and direct lines to collectors.',
  },
];

/** The 5 coverage programmes, DERIVED from the groups and the catalogue
 * above — so a package can never name a line the catalogue does not have, and
 * can never miss one its group does. Each line is count 1: a count is per
 * show and there is nothing real to copy. */
export const STANDARD_PACKAGES: readonly StandardPackage[] = COVERAGE_GROUPS.map((g) => ({
  name: g.title,
  purpose: g.desc,
  // by GROUP, not by source: §02's "Artist interview" is the priced exhibition
  // row (see its comment), so a programme keeps all of its services
  lines: STANDARD_SERVICES.filter((s) => s.group === g.no).map((s) => ({
    service: s.name,
    count: 1,
  })),
  counts: {},
  overrides: { internal: zeroInternal() },
}));

/* ── checklist templates (`darz-studio.html`:13444-13447) ───────────────── */

export interface StandardChecklist {
  /** The old `stage` key — all four are real `projects.stage` values, so they
   * carry over unchanged. */
  name: string;
  stage: ProjectStage;
  items: readonly string[];
}

/** The one part of the old `projSeedIfEmpty` seed that stays: these are
 * workflow, not pricing, so nothing about them was invented and nothing about
 * them changes. :13444-13447, in the old file's order. */
export const STANDARD_CHECKLISTS: readonly StandardChecklist[] = [
  {
    name: 'Proposal checklist',
    stage: 'proposal',
    items: [
      'Confirm scope with the client',
      'Draft deliverables & counts',
      'Attach the pricing summary',
      'Set the client approval deadline',
    ],
  },
  {
    name: 'Shoot-day checklist',
    stage: 'production',
    items: [
      'Confirm venue access & time',
      'Prepare equipment list',
      'Shot list agreed with the client',
      'Backup & label files same day',
    ],
  },
  {
    name: 'Publication checklist',
    stage: 'publication',
    items: [
      'Final internal review passed',
      'Client approval recorded',
      'Captions & credits verified',
      'Scheduled across Darz channels',
    ],
  },
  {
    name: 'Archive handoff',
    stage: 'archive',
    items: [
      'Collect all final assets',
      'Write the post-project report',
      'File to the Darz archive',
      'Confirm retention duration',
    ],
  },
];

/** What the card's copy counts, derived from the arrays themselves. */
export const STANDARD_SET_COUNTS = {
  services: STANDARD_SERVICES.length,
  packages: STANDARD_PACKAGES.length,
  checklists: STANDARD_CHECKLISTS.length,
  /** How many service lines arrive with no price, so the desk can say it
   * rather than let a 0 read as "free". */
  unpriced: UNPRICED_SERVICES.length,
};

/* ── the plan (idempotency by name) ─────────────────────────────────────── */

/** The one name rule every plan and every lookup uses: trimmed, case-folded.
 * (The old panel matched deliverables the same way, `_doApplyPackage`
 * `darz-studio.html`:14006.) */
export function nameKey(s: string): string {
  return s.trim().toLowerCase();
}

/** Two names are the same line: trimmed, case-insensitive. */
export function sameName(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

/** A row already in the catalogue / the templates — only its name matters. */
export interface NamedRow {
  name: string;
}

/** What a run would do: `create` is written, `skip` is already there. */
export interface StandardPlan<T> {
  create: T[];
  skip: T[];
}

function plan<T extends { name: string }>(
  standard: readonly T[],
  existing: readonly NamedRow[],
): StandardPlan<T> {
  const create: T[] = [];
  const skip: T[] = [];
  for (const s of standard) {
    if (existing.some((e) => sameName(e.name, s.name))) skip.push(s);
    else create.push(s);
  }
  return { create, skip };
}

/** Never duplicates and never overwrites: a name already in the catalogue is
 * skipped, whatever its price — so a half-finished run resumes by clicking
 * again, and a line the owner has since priced is left alone. */
export function planServices(existing: readonly NamedRow[]): StandardPlan<StandardService> {
  return plan(STANDARD_SERVICES, existing);
}

export function planPackages(existing: readonly NamedRow[]): StandardPlan<StandardPackage> {
  return plan(STANDARD_PACKAGES, existing);
}

export function planChecklists(
  existing: readonly NamedRow[],
): StandardPlan<StandardChecklist> {
  return plan(STANDARD_CHECKLISTS, existing);
}

/* ── API bodies ─────────────────────────────────────────────────────────── */

/**
 * `POST …/service-catalog/`. The money fields are `Format: decimal`, so the
 * wire wants strings (the service editor sends them the same way,
 * `PackagesPage.saveSvc`). `currency` is the caller's — `STANDARD_CURRENCY`
 * when the options serve it, the desk's default otherwise.
 *
 * An unpriced line (`price: null`) is sent as `'0'`: the backend's `price` is
 * a non-null decimal defaulting to 0 and there is no "unpriced" flag to send,
 * so a 0 in the catalogue means "not priced yet" (`UNPRICED_SERVICES` is
 * which ones, and the desk says how many). `internal_cost` is `'0'` on every
 * line for the same reason — Darz has no internal cost recorded for these.
 *
 * What does NOT go on the wire: `about`, `flow`, `time` and `need`.
 * `ProjectServiceCatalogItem` has no description field (G-PROJ-8), so only
 * the NAME of a service reaches the catalogue.
 */
export function serviceInput(s: StandardService, currency: string): ServiceCatalogItemInput {
  return {
    name: s.name,
    category: s.category,
    unit: s.unit,
    internal_cost: String(s.internalCost),
    price: String(s.price ?? 0),
    currency: currency as ServiceCatalogItemInput['currency'],
  };
}

/** Index the real catalogue for `packageInput` / `missingServices`: keyed by
 * `nameKey`, so a template's named line finds the id the API gave the row.
 * First row wins, so a later duplicate name never steals the link — which is
 * also why `NAME_COLLISIONS` matters. */
export function serviceIdIndex(
  rows: readonly { id: string; name: string }[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    const k = nameKey(r.name);
    if (!out.has(k)) out.set(k, r.id);
  }
  return out;
}

/** The names this template could not resolve against the catalogue — the
 * desk reports them rather than letting the package go out short. */
export function missingServices(p: StandardPackage, idByName: Map<string, string>): string[] {
  const out: string[] = [];
  for (const l of p.lines) {
    if (!idByName.has(nameKey(l.service)) && !out.includes(l.service)) out.push(l.service);
  }
  return out;
}

/**
 * `POST …/packages/`. The template's own values over `blankPackage()` — the
 * `darz-studio.html`:13954 defaults — so a field the template does not set
 * keeps exactly that default. The five groups set one thing: a zeroed
 * `internal` block (`zeroInternal`), because their fee is quoted per show.
 *
 * A line whose service is not in the index is DROPPED (a dangling id would
 * make the card read "(removed service)" and the apply write a deliverable
 * for nothing). The drop is silent HERE by design: call `missingServices`
 * first and say so on screen — never create a short package without telling
 * the owner which lines it lost.
 */
export function packageInput(
  p: StandardPackage,
  idByName: Map<string, string>,
): PackageTemplateInput {
  const base = blankPackage();
  const o = p.overrides ?? {};
  const lines: PackageLine[] = [];
  for (const l of p.lines) {
    const id = idByName.get(nameKey(l.service));
    if (id) lines.push({ svcId: id, count: l.count });
  }
  return {
    ...base,
    name: p.name,
    purpose: p.purpose,
    lines,
    counts: { ...asCounts(base.counts), ...p.counts } satisfies PackageCounts,
    onsite: o.onsite ?? base.onsite,
    usage_rights: o.usageRights ?? base.usage_rights,
    archive_duration: o.archiveDuration ?? base.archive_duration,
    internal: o.internal ?? base.internal,
    deposit_pct: o.depositPct ?? base.deposit_pct,
    payment_stages: o.paymentStages ? [...o.paymentStages] : base.payment_stages,
  };
}

/** `POST …/checklists/` — the items are plain strings (`asChecklistStrings`). */
export function checklistInput(c: StandardChecklist): ChecklistTemplateInput {
  return { name: c.name, stage: c.stage, items: [...c.items] };
}
