import { useSyncExternalStore } from 'react';
import { layoutController } from './LayoutController';

export type LayoutName = 'mobile' | 'desktop';

/** Subscribes the component to the layout (mobile ⇄ desktop). */
export function useLayout(): LayoutName {
  const desktop = useSyncExternalStore(
    (cb) => layoutController.subscribe(cb),
    () => layoutController.isDesktop,
    () => false,
  );
  return desktop ? 'desktop' : 'mobile';
}
