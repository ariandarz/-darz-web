/**
 * React seams over the auction controllers. `useAuctionList` wraps the shared
 * `useListController`; `useAuction` / `useLots` / `useBidHistory` are one-shot
 * fetches for the event and lot pages; `useLot` drives a live `LotController`
 * (REST + WebSocket) with start/stop on mount/unmount.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { resolveWsUrl } from '../../api';
import { useApi, useSession } from '../../api/hooks';
import type { AuctionQuery, AuctionRecordQuery } from '../../api/types';
import { useResource } from '../catalogue/useCatalogue';
import { useListController } from '../shared/useListController';
import { AuctionListController } from './AuctionListController';
import { LotController, type LotControllerSnapshot } from './LotController';
import { RecordsController } from './RecordsController';
import { RegistrationController, type RegistrationSnapshot } from './RegistrationController';

export { useResource } from '../catalogue/useCatalogue';

export function useAuctionList(initial: AuctionQuery = {}) {
  const { auctions } = useApi();
  return useListController(() => new AuctionListController(auctions, initial));
}

/** The external auction-house results archive (`/records`). Returns the
 * shared list-controller seam plus the concrete `RecordsController` for its
 * `setSearch` / `setOrdering`. */
export function useRecords(initial: AuctionRecordQuery = {}) {
  const { auctions } = useApi();
  const [controller] = useState(() => new RecordsController(auctions, initial));
  useEffect(() => {
    void controller.reload();
  }, [controller]);
  const state = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  );
  return { state, controller };
}

export function useRecord(id: string) {
  const { auctions } = useApi();
  return useResource(() => auctions.record(id), [id]);
}

export function useAuction(id: string) {
  const { auctions } = useApi();
  return useResource(() => auctions.auction(id), [id]);
}

export function useLots(auctionId: string) {
  const { auctions } = useApi();
  return useResource(() => auctions.lots(auctionId, { per_page: 100 }), [auctionId]);
}

export function useBidHistory(lotId: string) {
  const { auctions } = useApi();
  return useResource(() => auctions.bidHistory(lotId, { per_page: 50 }), [lotId]);
}

/** Live lot state: a `LotController` (REST snapshot + `LotSocket`) constructed
 * per `lotId`, started on mount, stopped on unmount. Also exposes the
 * place-bid action + its in-flight / error / accepted state (Phase 8 step 2). */
export function useLot(lotId: string): LotControllerSnapshot & {
  reload: () => void;
  placeBid: (maxAmount: number | string) => Promise<boolean>;
  clearBidState: () => void;
} {
  const { auctions, session } = useApi();
  const { me, principal } = useSession();
  const myCollectorId = principal === 'collector' ? (me?.id ?? null) : null;

  const [controller] = useState(
    () => new LotController(auctions, session, resolveWsUrl(), lotId, myCollectorId),
  );

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  const snapshot = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  );

  return {
    ...snapshot,
    reload: () => void controller.reload(),
    placeBid: (maxAmount) => controller.placeBid(maxAmount),
    clearBidState: () => controller.clearBidState(),
  };
}

/** The collector's paddle registrations, scoped to one auction event screen.
 * Loads on mount; `register` files a request and reloads. */
export function useMyRegistration(auctionId: string): RegistrationSnapshot & {
  registration: RegistrationSnapshot['registrations'][number] | null;
  register: (agreeTerms: boolean) => Promise<boolean>;
  clearRegisterError: () => void;
} {
  const { auctions } = useApi();
  const [controller] = useState(() => new RegistrationController(auctions));

  useEffect(() => {
    void controller.load();
  }, [controller]);

  const snapshot = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  );

  return {
    ...snapshot,
    registration: controller.forAuction(auctionId),
    register: (agreeTerms) => controller.register(auctionId, agreeTerms),
    clearRegisterError: () => controller.clearRegisterError(),
  };
}
