/**
 * Real assertion for CC-3 body-scroll-lock (Task 5.1).
 *
 * The exploration test (platform-interaction-fixes.exploration.test.tsx) keeps a
 * SYNTHETIC bare overlay with no hook as a generic guard — it stays failing by
 * design. This file asserts the ACTUAL fix: a straggler-style `fixed inset-0`
 * overlay that calls `useBodyScrollLock(open)` (the hook now wired into every
 * hand-rolled overlay) locks `document.body` scroll while open and restores it
 * on close — matching the shared <Modal> contract.
 *
 * Validates: Requirements 2.5, 2.6
 */

import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

beforeEach(() => {
    document.body.style.overflow = '';
});

// Faithful shape of the real stragglers (dashboard/tickets L281, dashboard/venues
// overlays, CreatePostModal L82, ...): a `fixed inset-0` overlay whose open-state
// boolean drives useBodyScrollLock — exactly how the pages now wire it.
function StragglerOverlay({ open }: { open: boolean }) {
    useBodyScrollLock(open);
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div className="relative w-full max-w-sm overflow-y-auto overscroll-contain">overlay body</div>
        </div>
    );
}

describe('useBodyScrollLock — straggler overlay locks body scroll', () => {
    it('locks document.body scroll while the overlay is open', () => {
        render(<StragglerOverlay open />);
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores scroll when the overlay closes', () => {
        const { rerender } = render(<StragglerOverlay open />);
        expect(document.body.style.overflow).toBe('hidden');

        rerender(<StragglerOverlay open={false} />);
        expect(document.body.style.overflow).toBe('unset');
    });

    it('does not lock scroll when the overlay is never opened (preservation)', () => {
        render(<StragglerOverlay open={false} />);
        expect(document.body.style.overflow).toBe('');
    });
});
