/**
 * tidyUp — removing the rows a merge superseded, without emptying a package.
 *
 * On 2026-09-19 the owner ruled that four coverage lines and four priced
 * exhibition services are the same service each (`MERGED_SERVICES`). The seed
 * only ever adds, so a workspace seeded before that ruling still holds the
 * folded rows as their own catalogue lines — and the package templates that
 * run wrote still point at THOSE ids.
 *
 * Deleting the rows first would therefore quietly shrink a programme: the
 * package keeps a line whose `svcId` no longer resolves, and the desk counts
 * it as missing. So the order matters, and it is the whole reason this is a
 * module rather than three calls in a click handler:
 *
 *   1. RE-POINT every package line that names a superseded row at the row it
 *      was merged into, collapsing a duplicate if the package already had
 *      both (`3 × photo` + `1 × photo` is one line of 4, not two lines).
 *   2. Only then DELETE the superseded rows.
 *
 * Nothing here calls the API: it computes the two plans, and the desk carries
 * them out in that order and stops on the first failure — a half-done tidy
 * that deleted before re-pointing is exactly what this exists to prevent.
 */
import type { PackageTemplateAdmin, ServiceCatalogItemAdmin } from '../../../api/types';
import { MERGED_SERVICES, nameKey } from './standardSet';

export interface PackageLineRef {
  svcId?: string;
  count?: number;
}

/** One package that has to be rewritten before anything is deleted. */
export interface PackageRepoint {
  id: string;
  name: string;
  version: number;
  lines: PackageLineRef[];
  /** How many of its lines pointed at a superseded row. */
  moved: number;
}

export interface TidyPlan {
  /** Rewrites, to run FIRST. */
  repoint: PackageRepoint[];
  /** Rows to delete, once every rewrite has landed. */
  remove: Array<{ id: string; name: string; version: number }>;
  /** A superseded row whose merged partner is NOT in this catalogue: its
   * lines have nowhere to go, so neither it nor its packages are touched. */
  orphans: Array<{ name: string; wanted: string }>;
}

const EMPTY: TidyPlan = { repoint: [], remove: [], orphans: [] };

/**
 * What tidying this workspace would do. Pure, and safe to call on every
 * render: it reads the catalogue and the packages and decides nothing else.
 */
export function planTidy(
  services: readonly ServiceCatalogItemAdmin[],
  packages: readonly PackageTemplateAdmin[],
): TidyPlan {
  const byKey = new Map<string, ServiceCatalogItemAdmin>();
  for (const s of services) {
    const k = nameKey(s.name ?? '');
    if (k && !byKey.has(k)) byKey.set(k, s);
  }

  // folded row id -> the id of the row it was merged into
  const moveTo = new Map<string, string>();
  const remove: TidyPlan['remove'] = [];
  const orphans: TidyPlan['orphans'] = [];

  for (const m of MERGED_SERVICES) {
    const folded = byKey.get(nameKey(m.folded));
    const kept = byKey.get(nameKey(m.kept));
    // the case-folded pair resolves to the same row; nothing to tidy
    if (!folded || folded.id === kept?.id) continue;
    if (!kept) {
      orphans.push({ name: folded.name ?? m.folded, wanted: m.kept });
      continue;
    }
    moveTo.set(folded.id, kept.id);
    remove.push({ id: folded.id, name: folded.name ?? m.folded, version: folded.version });
  }

  if (!moveTo.size) return { ...EMPTY, orphans };

  const repoint: PackageRepoint[] = [];
  for (const p of packages) {
    const lines = ((p.lines ?? []) as PackageLineRef[]).map((l) => ({ ...l }));
    let moved = 0;
    for (const l of lines) {
      const to = l.svcId ? moveTo.get(l.svcId) : undefined;
      if (to) {
        l.svcId = to;
        moved += 1;
      }
    }
    if (!moved) continue;
    repoint.push({
      id: p.id,
      name: p.name ?? '',
      version: p.version,
      lines: collapse(lines),
      moved,
    });
  }

  return { repoint, remove, orphans };
}

/** Two lines naming one service become one, their counts added — otherwise a
 * package that held both sides of a merged pair would list it twice. */
export function collapse(lines: readonly PackageLineRef[]): PackageLineRef[] {
  const out: PackageLineRef[] = [];
  for (const l of lines) {
    const hit = l.svcId ? out.find((o) => o.svcId === l.svcId) : undefined;
    if (hit) hit.count = (Number(hit.count) || 1) + (Number(l.count) || 1);
    else out.push({ ...l });
  }
  return out;
}

/** Whether there is anything to do — what the desk shows its button on. */
export function hasWork(plan: TidyPlan): boolean {
  return plan.remove.length > 0 || plan.repoint.length > 0;
}

/** The plan in one sentence, for the desk to say before it runs. */
export function describeTidy(plan: TidyPlan): string {
  if (!hasWork(plan)) {
    return plan.orphans.length
      ? `Nothing can be tidied: ${plan.orphans.length === 1 ? 'a line' : `${plan.orphans.length} lines`} would have nowhere to move to.`
      : 'Nothing to tidy — this workspace has no superseded lines.';
  }
  const parts: string[] = [];
  if (plan.repoint.length) {
    const lines = plan.repoint.reduce((n, p) => n + p.moved, 0);
    parts.push(
      `move ${lines} package line${lines === 1 ? '' : 's'} onto the service ${
        lines === 1 ? 'it was' : 'they were'
      } merged into (${plan.repoint.map((p) => p.name).join(', ')})`,
    );
  }
  if (plan.remove.length) {
    parts.push(
      `delete ${plan.remove.map((r) => `“${r.name}”`).join(', ')} from the catalogue`,
    );
  }
  return `This will ${parts.join(', then ')}.`;
}
