/**
 * React seams over the auction controllers. `useAuctionList` wraps the shared
 * `useListController`; `useAuction` / `useLots` / `useBidHistory` are one-shot
 * fetches for the event and lot pages; `useLot` drives a live `LotController`
 * (REST + WebSocket) with start/stop on mount/unmount.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { resolveWsUrl } from '../../api';
import { useApi, useSession } from '../../api/hooks';
import type { AuctionQuery } from '../../api/types';
import { useResource } from '../catalogue/useCatalogue';
import { useListController } from '../shared/useListController';
import { AuctionListController } from './AuctionListController';
import { LotController, type LotControllerSnapshot } from './LotController';

export { useResource } from '../catalogue/useCatalogue';

export function useAuctionList(initial: AuctionQuery = {}) {
  const { auctions } = useApi();
  return useListController(() => new AuctionListController(auctions, initial));
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
 * per `lotId`, started on mount, stopped on unmount. */
export function useLot(lotId: string): LotControllerSnapshot & { reload: () => void } {
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

  return { ...snapshot, reload: () => void controller.reload() };
}
