/**
 * PortalSession — the no-login portal's state machine, on the shared
 * `Observable` base (same contract as `AuthSession` / `ListController`).
 *
 * The old page's flow (gallery-update.html:818-895) is splash → landing →
 * portal, with one probe BEFORE the PIN that fetched the gallery's name and
 * whether a code is required. The new backend gates **every** read behind the
 * PIN (`PortalAuthService.resolve` — there is no probe endpoint), so the
 * landing opens straight onto the access-code step with the generic label,
 * and the name arrives with the first authenticated load (G-PORT-10 in
 * `docs/ADMIN_ARCHITECTURE.md` §2).
 *
 * Failure vocabulary (old :804-813): a dead/expired/unknown link is a
 * terminal `dead` state ("This link is no longer active"), a transport
 * failure is `unreachable` with a retry ("the link is fine, so offer a retry
 * rather than blaming the link"), and a wrong code stays on the gate with
 * the old inline error line.
 */
import type { GalleryPortalService } from '../../api/services';
import type {
  PortalCatalogueEntry,
  PortalExhibition,
  PortalExhibitionInput,
  PortalState,
  PortalUpdateSubmit,
} from '../../api/types';
import { HttpError, NetworkError, UnauthorizedError } from '../../api/errors';
import { Observable } from '../shared/Observable';

export type PortalPhase = 'gate' | 'opening' | 'ready' | 'dead' | 'unreachable';

export interface PortalSnapshotState {
  phase: PortalPhase;
  /** inline error under the PIN boxes (old #pinErr) */
  pinError: string;
  data: PortalState | null;
  /** in-session "Sent to Darz" marks — artwork id → ISO stamp. The server
   * keeps no portal-readable pending list (G-PORT-2), so these live only as
   * long as the tab. */
  sentAt: Record<string, string>;
  /** Exhibition Services — loaded on first open of the tab. */
  exhibitions: PortalExhibition[] | null;
  catalogue: PortalCatalogueEntry[] | null;
}

export class PortalSession extends Observable<PortalSnapshotState> {
  readonly token: string;
  private pin = '';
  private readonly service: GalleryPortalService;

  constructor(service: GalleryPortalService, token: string) {
    super({
      phase: 'gate',
      pinError: '',
      data: null,
      sentAt: {},
      exhibitions: null,
      catalogue: null,
    });
    this.service = service;
    this.token = token;
  }

  /** The stored code, for calls made outside this class (none today). */
  get currentPin(): string {
    return this.pin;
  }

  /** Enter with the code from the gate. Resolves to true when the portal
   * opened; a wrong code stays on the gate with the old inline copy. */
  async enter(pin: string): Promise<boolean> {
    this.patch({ phase: 'opening', pinError: '' });
    try {
      const data = await this.service.state(this.token, pin);
      this.pin = pin;
      this.patch({ phase: 'ready', data, pinError: '' });
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        if (/pin/i.test(err.message)) {
          this.patch({
            phase: 'gate',
            pinError: 'That code did not match. Please try again.',
          });
          return false;
        }
        this.patch({ phase: 'dead' }); // deactivated / expired
        return false;
      }
      if (err instanceof HttpError && err.status === 404) {
        this.patch({ phase: 'dead' });
        return false;
      }
      if (err instanceof NetworkError) {
        this.patch({ phase: 'unreachable' });
        return false;
      }
      // Anything else (a 5xx, an unexpected 4xx, a 429) is a failure the
      // collector can only retry. It used to be rethrown with the phase left
      // on 'opening', which froze the gate on its busy state forever (C-4).
      this.patch({ phase: 'unreachable' });
      return false;
    }
  }

  /** Back to the gate from the unreachable screen (old #errRetry). */
  retry(): void {
    this.patch({ phase: 'gate', pinError: '' });
  }

  /** Re-read the whole state (old `reload()`, :926) — after every accepted
   * submission, "so the card reflects confirmed server state, not a client
   * guess" (:1434). A link disabled mid-session turns the phase dead. */
  async reload(): Promise<void> {
    try {
      const data = await this.service.state(this.token, this.pin);
      this.patch({ data });
    } catch (err) {
      if (err instanceof UnauthorizedError) this.patch({ phase: 'dead' });
      // transport blips keep the last good state (old reload ignores them)
    }
  }

  /** A 401 on ANY portal action means the link stopped answering — disabled,
   * expired or revoked mid-session. The page turns into the terminal card
   * (the old page's failLink on its next load) and the caller stops instead
   * of toasting a generic failure. Returns true when handled. */
  noteAuthFailure(err: unknown): boolean {
    if (err instanceof UnauthorizedError) {
      this.patch({ phase: 'dead' });
      return true;
    }
    return false;
  }

  markSent(artworkId: string): void {
    this.patch({
      sentAt: { ...this.getSnapshot().sentAt, [artworkId]: new Date().toISOString() },
    });
  }

  submitUpdate(body: PortalUpdateSubmit) {
    return this.service.submitUpdate(this.token, this.pin, body);
  }

  uploadPricelist(file: File, title: string) {
    return this.service.uploadPricelist(this.token, this.pin, file, title);
  }

  sendMessage(body: string) {
    return this.service.sendMessage(this.token, this.pin, body);
  }

  /** Load (once) the shows + the services menu when the tab first opens. */
  async loadExhibitions(force = false): Promise<void> {
    const snap = this.getSnapshot();
    if (!force && snap.exhibitions !== null) return;
    const [list, cat] = await Promise.all([
      this.service.exhibitions(this.token, this.pin),
      snap.catalogue === null
        ? this.service.exhibitionCatalogue(this.token, this.pin)
        : Promise.resolve({ services: snap.catalogue }),
    ]);
    this.patch({ exhibitions: list.exhibitions, catalogue: cat.services });
  }

  createExhibition(body: PortalExhibitionInput) {
    return this.service.createExhibition(this.token, this.pin, body);
  }

  updateExhibition(id: string, body: PortalExhibitionInput) {
    return this.service.updateExhibition(this.token, this.pin, id, body);
  }

  submitExhibition(id: string, serviceKeys: string[]) {
    return this.service.submitExhibition(this.token, this.pin, id, serviceKeys);
  }

  signExhibitionDocument(eventId: string, documentId: string, signerName: string) {
    return this.service.signExhibitionDocument(
      this.token,
      this.pin,
      eventId,
      documentId,
      signerName,
    );
  }
}
