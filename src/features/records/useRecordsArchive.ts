import { useContext, useEffect, useSyncExternalStore } from 'react';
import type { ArchiveSnapshot, RecordsArchiveController } from './RecordsArchiveController';
import { RecordsArchiveContext } from './recordsContext';

export function useRecordsArchive(): ArchiveSnapshot & {
  controller: RecordsArchiveController;
} {
  const controller = useContext(RecordsArchiveContext);
  if (!controller)
    throw new Error('useRecordsArchive must be used within <RecordsArchiveProvider>.');
  useEffect(() => {
    void controller.ensureLoaded();
  }, [controller]);
  const snapshot = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  );
  return { ...snapshot, controller };
}
