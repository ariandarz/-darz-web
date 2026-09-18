/**
 * CuratedChip — the old app's "Curated for You" smart filter
 * (app.html:8583-8594, CSS :278-289, behaviour :8871).
 *
 * A **chip that sits with the other filters, never a separate section.** That
 * distinction is the whole point: `app.html:3432` still describes a
 * "Private — for you" section above the catalogue, but :8890 records that v669
 * **removed** it — *"the curated set is now a smart filter inside the normal
 * catalogue, so the homepage layout is unchanged. The container is kept but
 * always emptied."* Porting the section would ship something the old app
 * deliberately deleted.
 *
 * Hidden entirely when the collector holds no grants — the original opens with
 * `var ids=curatedIds(); if(!ids.length) return '';`, so a collector with an
 * empty curated set never saw the chip at all, and an empty curated grid was
 * not a state that screen could reach.
 *
 * **Two pieces of the original are deliberately absent**, both for want of an
 * API signal (docs/PHASE_24_35_API_GAPS.md, owner decisions D5 / D6):
 *
 *  - the `.neu` flash and `.dz-curdot` — they mark an *unseen new batch*, and
 *    there are no batches here: the backend replaced the old named selection
 *    with a flat per-(artwork, collector) grant, and the collector-facing
 *    serializer exposes no `created_at` to compare against (G-P24-2). A
 *    localStorage heuristic would be invention, not a port, and would misfire
 *    whenever a work *left* the set.
 *  - a selection **name** on the label. The old chip reads
 *    `(s[0]&&s[0].name)||'Curated for You'` (:3458); grants have no name, so
 *    only the fallback is reachable (G-P24-1). Note the shipped ternary is
 *    `(on?'Curated for You':'Curated for You')` — identical either way — so
 *    the label here is faithful to what actually rendered.
 */

// :8589 — the star, verbatim
const IC_STAR = (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3l2.5 5.6L20.5 9l-4.3 4.2 1 6L12 16.5 6.8 19.2l1-6L3.5 9l5.9-.4z" />
  </svg>
);

export function CuratedChip({
  count,
  on,
  onToggle,
}: {
  /** how many works the collector has been granted; 0 hides the chip */
  count: number;
  on: boolean;
  onToggle: (on: boolean) => void;
}) {
  if (count <= 0) return null;
  return (
    <div className="tbar-cur">
      <button
        type="button"
        className={`dz-curchip${on ? ' on' : ''}`}
        aria-pressed={on}
        /* :8588 — both titles verbatim */
        title={
          on
            ? 'Showing your curated selection — tap to show all works'
            : 'See the works Darz curated for you'
        }
        onClick={() => onToggle(!on)}
      >
        {IC_STAR}
        <span className="dz-curl">Curated for You</span>
        <span className="dz-curn">{count}</span>
      </button>
    </div>
  );
}
