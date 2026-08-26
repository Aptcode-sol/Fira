import { useEffect } from 'react';

/**
 * Locks `document.body` scroll while `active` is true, restoring it on cleanup.
 *
 * Mirrors the body-scroll-lock in `client/src/components/ui/Modal.tsx`
 * (`overflow: 'hidden'` on open, `'unset'` on cleanup) so hand-rolled
 * `fixed inset-0` overlays that don't use the shared <Modal> get the same
 * background-scroll lock (Requirements 2.5, 2.6).
 *
 * ponytail: single global `document.body.style.overflow` toggle is the ceiling —
 * it matches <Modal> exactly. If two overlays are open at once the last to
 * unmount restores scroll (same limitation <Modal> already has); the upgrade
 * path is a shared lock counter, not needed while overlays open one at a time.
 */
export function useBodyScrollLock(active: boolean): void {
    useEffect(() => {
        if (!active) return;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [active]);
}
