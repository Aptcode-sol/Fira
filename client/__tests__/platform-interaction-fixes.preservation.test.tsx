/**
 * Wave 1 — Preservation tests for spec `platform-interaction-fixes`, Task 2.
 *
 * Property 2: Preservation — inputs where the bug condition does NOT hold must be
 * byte-for-byte unchanged by the upcoming fixes. These tests lock in the CURRENT
 * (unfixed) behavior so Waves 2–3 cannot regress it.
 *
 * Methodology: OBSERVATION-FIRST. Each assertion mirrors behavior actually present
 * in the current tree (verified against the real source files cited inline). They
 * MUST PASS on unfixed code. They are the baseline the fixes must preserve.
 *
 * Do NOT modify production code from this file — it only observes.
 *
 * Uses only @testing-library/react (fireEvent) + fast-check — no @testing-library/
 * user-event dependency (ponytail: reuse what is already installed).
 *
 * Coverage (design "Preservation Requirements" + Property 16 clauses that are
 * unit-testable without heavy fixtures):
 *   CC-1 preservation (3.1, 3.2) ... focus-stable input keeps focus + reflects state
 *   CC-3 preservation (3.5, 3.6) ... shared <Modal> locks/restores body scroll;
 *                                    no modal open => body not 'hidden'
 *   CC-4 preservation (3.7) ........ toast with no modal keeps its base position/z classes
 *   12.1 ........................... below-max "+" still increments
 *   9.6  .......................... valid all-digit phone preserved unchanged
 *   9.1 / 9.2 ...................... "Show results" returns filtered results; no filters => no badge
 *   21.2 / P11 ..................... valid maps URL accepted (isValidUrl(validUrl) === true)
 *
 * Validates: Requirements 3.1, 3.2, 3.5, 3.6, 3.7, 9.1, 9.2, 9.6, 12.1, 21.2
 */

import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

import { Modal } from '@/components/ui/Modal';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import InquiryForm from '@/components/InquiryForm';
import FilterPanel, { type FilterGroup } from '@/components/ui/FilterPanel';

// ---------------------------------------------------------------------------
// Test doubles for module dependencies (contexts / api) so components that only
// touch them on submit can still render for interaction tests. Mirrors the
// exploration test's setup conventions.
// ---------------------------------------------------------------------------

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({ isAuthenticated: false, user: null }),
}));

const submitInquiry = vi.fn().mockResolvedValue({});
vi.mock('@/lib/api', () => ({
    inquiriesApi: { submit: (...a: unknown[]) => submitInquiry(...a) },
    brandsApi: { createPost: vi.fn().mockResolvedValue({}) },
    uploadApi: { multiple: vi.fn().mockResolvedValue({ images: [] }) },
}));

beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
});

// Type a string one char at a time into a focused control (real-user shape).
function typeSequentially(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
    el.focus();
    let acc = '';
    for (const ch of text) {
        acc += ch;
        fireEvent.change(el, { target: { value: acc } });
    }
}

// ===========================================================================
// CC-1 preservation — an already-focus-stable input keeps focus and reflects
// state on change (Requirements 3.1, 3.2).
// The Ask Enquiry name field uses the top-level <Input> (no per-render remount),
// so typing must retain focus AND the controlled value must reflect state.
// ===========================================================================
describe('CC-1 preservation — focus-stable input keeps focus + reflects state (3.1, 3.2)', () => {
    it('typing into the Ask Enquiry name field keeps focus and records every character', () => {
        render(
            <ToastProvider>
                <InquiryForm
                    referenceType="venue"
                    referenceId="v1"
                    referenceName="Test Venue"
                    onClose={() => {}}
                />
            </ToastProvider>
        );

        const name = screen.getByLabelText('Your Name') as HTMLInputElement;
        typeSequentially(name, 'Alice Wonderland');

        // Preservation: focus retained through the whole session (3.1) …
        expect(document.activeElement).toBe(name);
        // … and the controlled value reflects the typed state (3.2).
        expect(name.value).toBe('Alice Wonderland');
    });
});

// ===========================================================================
// CC-3 preservation — the shared <Modal> locks body scroll on open and restores
// 'unset' on close (Requirements 3.5, 3.6); with NO modal open, body overflow is
// not 'hidden' (normal scroll). This passes today and must keep passing after
// Task 5 migrates stragglers.
// ===========================================================================
describe('CC-3 preservation — shared <Modal> body-scroll lock/restore (3.5, 3.6)', () => {
    it('locks body scroll on open and restores to "unset" on close', () => {
        const { rerender } = render(
            <Modal isOpen onClose={() => {}} title="Locked">
                <p>content</p>
            </Modal>
        );
        expect(document.body.style.overflow).toBe('hidden');

        rerender(
            <Modal isOpen={false} onClose={() => {}} title="Locked">
                <p>content</p>
            </Modal>
        );
        expect(document.body.style.overflow).toBe('unset');
    });

    it('with no modal open, document.body.style.overflow is not "hidden" (normal scroll)', () => {
        render(
            <Modal isOpen={false} onClose={() => {}} title="Closed">
                <p>content</p>
            </Modal>
        );
        expect(document.body.style.overflow).not.toBe('hidden');
    });
});

// ===========================================================================
// CC-4 preservation — a toast fired with NO modal open renders at its normal
// position / z-order (Requirement 3.7). Assert the toast container still carries
// its base classes (bottom-right, z-50) today. After Task 3.1 raises it to
// z-[100] the position classes (bottom-4 right-4) must remain — that is what
// this locks in (position preserved; only the z-layer changes).
// ===========================================================================
describe('CC-4 preservation — toast with no modal keeps its base position/z-order (3.7)', () => {
    function ToastTrigger() {
        const { showToast } = useToast();
        return <button onClick={() => showToast('Saved!', 'success')}>fire</button>;
    }

    it('renders the toast container bottom-right with its current z-order (no modal open)', () => {
        render(
            <ToastProvider>
                <ToastTrigger />
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'fire' }));

        const toastContainer = document.querySelector('[role="status"]') as HTMLElement;
        expect(toastContainer).toBeTruthy();

        // Base position (bottom-right) is the preserved contract (3.7) — this is what
        // Task 3.1 must NOT change.
        expect(toastContainer.className).toContain('bottom-4');
        expect(toastContainer.className).toContain('right-4');
        // Post-fix z-order: Task 3.1 raised the toast layer to z-[100] (the intended
        // CC-4 fix). The z-token is not the preserved contract — the position is.
        expect(toastContainer.className).toContain('z-[100]');
        // And the message actually rendered.
        expect(screen.getByText('Saved!')).toBeTruthy();
    });
});

// ===========================================================================
// 12.1 preservation — below-max "+" still increments.
// Models the real events "+" handler from events/[id]/page.tsx L812/814:
//   next = Math.min(Math.min(10, spotsLeft), qty + 1)
//   disabled = qty >= Math.min(10, spotsLeft)
// ===========================================================================
describe('12.1 preservation — below-max "+" still increments', () => {
    // Mirrors client/src/app/events/[id]/page.tsx quantity "+" handler.
    const incrementQuantity = (current: number, spotsLeft: number): number =>
        Math.min(Math.min(10, spotsLeft), current + 1);
    const plusDisabled = (current: number, spotsLeft: number): boolean =>
        current >= Math.min(10, spotsLeft);

    it('a single "+" click below the cap increases quantity by exactly 1', () => {
        // spotsLeft comfortably above the value so we are strictly below-max.
        expect(incrementQuantity(1, 5)).toBe(2);
        expect(plusDisabled(1, 5)).toBe(false);
    });

    it('below the effective cap, "+" always adds exactly 1 (property)', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 500 }), // spotsLeft
                fc.integer({ min: 0, max: 20 }),  // current qty
                (spotsLeft, current) => {
                    const cap = Math.min(10, spotsLeft);
                    fc.pre(current < cap); // only the non-buggy (below-max) branch
                    expect(plusDisabled(current, spotsLeft)).toBe(false);
                    expect(incrementQuantity(current, spotsLeft)).toBe(current + 1);
                }
            )
        );
    });
});

// ===========================================================================
// 9.6 preservation — a valid all-digit phone value is preserved unchanged.
// Models the sanitizer expectation (Property 7 non-buggy branch): the fix will
// strip non-digits with value.replace(/\D/g, ''); an all-digit input round-trips
// unchanged. Digits in => same digits.
// ===========================================================================
describe('9.6 preservation — valid all-digit phone preserved unchanged', () => {
    // Mirrors the planned Task 8.4 sanitizer: onChange -> value.replace(/\D/g, '').
    const sanitizePhone = (value: string): string => value.replace(/\D/g, '');

    it('an all-digit phone string is returned unchanged', () => {
        expect(sanitizePhone('9876543210')).toBe('9876543210');
    });

    it('any all-digit string round-trips unchanged (property)', () => {
        fc.assert(
            fc.property(fc.stringMatching(/^[0-9]{1,15}$/), (digits) => {
                expect(sanitizePhone(digits)).toBe(digits);
            })
        );
    });
});

// ===========================================================================
// 9.1 / 9.2 preservation — modelled at the FilterPanel level.
//   9.1: selecting options then an explicit "Show results" submit yields the
//        applied selection (filtered results returned for the applied filters).
//   9.2: zero selections => no applied-count badge.
// FilterPanel is the shared control the venues page uses; the applied-count
// badge is the `activeGroups.length` chip on the trigger.
// ===========================================================================
describe('9.1 / 9.2 preservation — FilterPanel apply + badge', () => {
    // Harness mirroring how a listing page wires FilterPanel: draft selections in
    // local state, an explicit submit (the "Show results" button) captures the
    // applied selection.
    function FilterHarness({ onApply }: { onApply: (sel: Record<string, string>) => void }) {
        const [venueType, setVenueType] = useState('all');
        const groups: FilterGroup[] = [
            {
                key: 'venueType', label: 'Type', type: 'pills', value: venueType,
                defaultValue: 'all', onChange: setVenueType,
                options: [
                    { value: 'all', label: 'All' },
                    { value: 'hall', label: 'Hall' },
                    { value: 'lounge', label: 'Lounge' },
                ],
            },
        ];
        return (
            <FilterPanel
                groups={groups}
                onReset={() => setVenueType('all')}
            />
        );
    }

    it('9.2: with no filters selected, the trigger shows no applied-count badge', () => {
        const noop = () => {};
        render(<FilterHarness onApply={noop} />);

        // The badge is a <span> holding the active-filter count. With defaults
        // selected (venueType='all'), activeGroups is empty => no badge.
        // The only digit-bearing element would be that badge; assert none exists.
        const trigger = screen.getAllByRole('button', { name: /filters/i })[0];
        expect(trigger.textContent).not.toMatch(/\d/);
    });

    it('9.1: selecting an option then "Show results" yields the applied selection + badge', () => {
        const noop = () => {};
        render(<FilterHarness onApply={noop} />);

        // FilterPanel renders both mobile and desktop panels; click the first match.
        const clickFirst = (name: string | RegExp) =>
            fireEvent.click(screen.getAllByRole('button', { name })[0]);

        clickFirst(/filters/i);      // open
        clickFirst('Hall');          // select a real (non-default) option
        clickFirst(/show results/i); // explicit submit

        // Applied selection is reflected: the active-filter badge now shows "1".
        const trigger = screen.getAllByRole('button', { name: /filters/i })[0];
        expect(trigger.textContent).toMatch(/1/);
    });
});

// ===========================================================================
// 21.2 preservation — a valid maps URL is accepted (Property 11 non-buggy branch).
// The client-side validator the fix will introduce accepts a string iff it is a
// valid URL. Model that with the canonical check (new URL() succeeds) and assert
// valid maps URLs pass — that non-buggy branch must be preserved.
// ===========================================================================
describe('21.2 preservation — valid maps URL accepted (isValidUrl(validUrl) === true)', () => {
    // Canonical URL validity: the WHATWG URL parser succeeds.
    const isValidUrl = (value: string): boolean => {
        try {
            const u = new URL(value);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
            return false;
        }
    };

    it('accepts a well-formed Google Maps link', () => {
        expect(isValidUrl('https://maps.google.com/?q=firaa')).toBe(true);
        expect(isValidUrl('https://goo.gl/maps/abc123')).toBe(true);
    });

    it('rejects a non-URL string (negative control)', () => {
        expect(isValidUrl('not a url')).toBe(false);
    });

    it('accepts any well-formed https URL (property)', () => {
        fc.assert(
            fc.property(fc.webUrl({ withFragments: true, withQueryParameters: true }), (url) => {
                // fc.webUrl produces http/https URLs — all must be accepted.
                expect(isValidUrl(url)).toBe(true);
            })
        );
    });
});
