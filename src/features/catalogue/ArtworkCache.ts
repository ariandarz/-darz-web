/**
 * ArtworkCache — one artwork detail per id, fetched once per session and
 * shared. The collector's requests carry a bare artwork uuid (`RequestCollector
 * .artwork`), so the Chat list, the thread header and the Profile activity
 * rows all need the same lookup; this keeps it to one `GET
 * /api/catalog/artworks/{id}/` per artwork, with concurrent callers sharing
 * the in-flight promise. Not persisted anywhere (offline = NO).
 */
import type { CatalogService } from '../../api/services';
import type { Artwork } from '../../api/types';
import { Observable } from '../shared/Observable';

export interface ArtworkCacheSnapshot {
  /** id → artwork, or null when the fetch failed / the work is gone */
  byId: ReadonlyMap<string, Artwork | null>;
}

export class ArtworkCache extends Observable<ArtworkCacheSnapshot> {
  private readonly catalog: CatalogService;
  private readonly inflight = new Map<string, Promise<Artwork | null>>();

  constructor(catalog: CatalogService) {
    super({ byId: new Map() });
    this.catalog = catalog;
  }

  get(id: string): Artwork | null | undefined {
    return this.getSnapshot().byId.get(id);
  }

  /** Fetch if unknown. Resolves to the artwork, or null when unavailable. */
  ensure(id: string): Promise<Artwork | null> {
    const known = this.getSnapshot().byId;
    if (known.has(id)) return Promise.resolve(known.get(id) ?? null);
    const running = this.inflight.get(id);
    if (running) return running;
    const p = this.catalog
      .artwork(id)
      .then(
        (a) => a,
        () => null,
      )
      .then((a) => {
        const next = new Map(this.getSnapshot().byId);
        next.set(id, a);
        this.patch({ byId: next });
        this.inflight.delete(id);
        return a;
      });
    this.inflight.set(id, p);
    return p;
  }

  ensureAll(ids: Iterable<string>): void {
    for (const id of ids) if (id) void this.ensure(id);
  }
}
