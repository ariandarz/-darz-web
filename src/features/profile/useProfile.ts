import { useEffect, useState, useSyncExternalStore } from 'react';
import { useApi } from '../../api/hooks';
import { ProfileController, type ProfileSnapshot } from './ProfileController';

export function useProfile(): { state: ProfileSnapshot; reload: () => Promise<void> } {
  const api = useApi();
  const [controller] = useState(() => new ProfileController(api));
  useEffect(() => {
    void controller.load();
  }, [controller]);
  const state = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  );
  return { state, reload: () => controller.load() };
}
