/**
 * useConfirmAvailable — the confirm write both freshness desks share (G-CAT-9):
 * the old `spConfirm` / `spConfirmAs` (`darz-studio.html:38150-38156`) with
 * their toasts, over `POST /catalog/admin/artworks/{id}/confirm-available/`.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { ArtworkAdmin, Choice } from '../../api/types';
import { confirmAsStatus, type ConfirmAs } from './freshness';

/** The confirm half both desks share. `onDone` re-reads whatever the desk
 * shows (the row's `freshness` and the summary counts both move). */
export function useConfirmAvailable({
  say,
  setError,
  onDone,
}: {
  say: (message: string) => void;
  setError: (message: string | null) => void;
  onDone: () => void;
}) {
  const { catalogAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const statuses = (options?.['catalog.availability_status'] as Choice[] | undefined) ?? [];

  const run = async (w: ArtworkAdmin, as?: ConfirmAs) => {
    if (busyId) return;
    setBusyId(w.id);
    setError(null);
    try {
      const status = as ? confirmAsStatus(as) : undefined;
      await catalogAdmin.confirmAvailable(w.id, status);
      if (as === 'price') {
        // :38152 — confirm, then open the work so the new price goes in
        say('Confirmed · update the price');
        navigate(`/admin/artworks/${w.id}`);
        return;
      }
      say(
        status
          ? `Confirmed · status set to ${statuses.find((c) => c.value === status)?.label ?? status}`
          : 'Confirmed available as of today',
      );
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not record the confirmation.');
    } finally {
      setBusyId(null);
    }
  };

  return { busyId, confirm: (w: ArtworkAdmin) => run(w), confirmAs: run };
}
