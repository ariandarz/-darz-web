import { useSyncExternalStore } from 'react';
import { layoutController, type LayoutName } from './LayoutController';

/** Subscribes the component to the layout (mobile ⇄ desktop). */
export function useLayout(): LayoutName {
  return useSyncExternalStore(
    (cb) => layoutController.subscribe(cb),
    () => layoutController.layout,
    () => layoutController.layout,
  );
}
