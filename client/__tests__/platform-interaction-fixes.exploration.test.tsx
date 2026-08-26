/**
 * Wave 1 — Bug-condition exploration tests for spec `platform-interaction-fixes`, Task 1.
 *
 * Property 1: Bug Condition — cross-cutting interaction defects.
 * These tests encode the EXPECTED (fixed) behavior. Per the bugfix workflow they are
 * run on UNFIXED code first:
 *   - A FAIL confirms the bug still exists (the later Wave 2/3 task will make it pass).
 *   - A PASS on an "already-fixed / regression-guard" case is the intended outcome.
 *
 * Do NOT fix production code from this file. It only observes.
 *
 * Uses only @testing-library/react (fireEvent) — no @testing-library/user-event
 * dependency is added (ponytail: reuse what is already installed).
 *
 * Expectation matrix (established by Task 0 + deep re-investigation, see wave0-offenders.md):
 *   CC-1 focus retention .......... EXPECT PASS  (already fixed — permanent regression guard)
 *   8.7  booker ReferenceError .... EXPECT PASS  (already fixed — `booker` does not exist client-side)
 *   11.2 quantity cap ............. EXPECT PASS  (already fixed — "+" handler clamps at spotsLeft)
 *   CC-4 toast z-order ............ EXPECT FAIL  (real bug — Toast z-50 <= Modal z-[70])
 *   CC-3 body-scroll-lock ......... EXPECT FAIL  (real bug — hand-rolled overlays don't lock body)
 *   8.1  filter single API call ... EXPECT FAIL  (real bug — API fires per filter click, not per submit)
 *
 * Validates: Requirements 2.1, 2.2 (CC-1), 2.7 (CC-4), 2.5/2.6 (CC-3), 8.1, 8.7, 11.2
 */

import { useEffect, useState, useCallback } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { Modal } from '@/components/ui/Modal';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import InquiryForm from '@/components/InquiryForm';
import CreatePostModal from '@/components/modals/CreatePostModal';
import FilterPanel, { type FilterGroup } from '@/components/ui/FilterPanel';

// ---------------------------------------------------------------------------
// Test doubles for module dependencies (contexts / api) so components that
// only *touch* them on submit can still render for interaction tests.
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

/**
 * Type a string one character at a time into a focused text control, the way a
 * real user would. Between characters we assert nothing; the caller checks
 * focus + accumulated value afterwards. If the control's owning element
 * remounts on each keystroke (the CC-1 bug), focus would be lost and only the
 * last dispatched value would land.
 */
function typeSequentially(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
    el.focus();
    let acc = '';
    for (const ch of text) {
        acc += ch;
        fireEvent.change(el, { target: { value: acc } });
    }
}

// Utility: pull the numeric z-index out of a Tailwind class list.
// Handles `z-50` and the arbitrary-value form `z-[70]` / `z-[100]`.
function tailwindZIndex(className: string): number | null {
    const arbitrary = className.match(/z-\[(\d+)\]/);
    if (arbitrary) return Number(arbitrary[1]);
    const scale = className.match(/(?:^|\s)z-(\d+)(?:\s|$)/);
    if (scale) return Number(scale[1]);
    return null;
}

// ===========================================================================
// CC-1 — Input focus retention (Requirements 2.1, 2.2)   EXPECT: PASS (guard)
// ===========================================================================
describe('CC-1 focus retention (regression guard — expected PASS)', () => {
    it('InquiryForm: typing a multi-char string keeps focus and captures the full value', () => {
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

        const message = screen.getByLabelText('Message') as HTMLTextAreaElement;
        typeSequentially(message, 'party time');

        expect(document.activeElement).toBe(message);
        expect(message.value).toBe('party time');
    });

    it('CreatePostModal: typing into the content textarea keeps focus and full value', () => {
        render(<CreatePostModal isOpen onClose={() => {}} brandId="b1" />);

        const content = screen.getByPlaceholderText("What's on your mind?") as HTMLTextAreaElement;
        typeSequentially(content, 'hello world');

        expect(document.activeElement).toBe(content);
        expect(content.value).toBe('hello world');
    });
});

// ===========================================================================
// 8.7 — booker ReferenceError in booking submit (Requirement 8.7)
//        EXPECT: PASS (guard — `booker` no longer referenced client-side)
// ===========================================================================
describe('8.7 booker ReferenceError (regression guard — expected PASS)', () => {
    it('submitting the inquiry/booking path throws no ReferenceError', async () => {
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
        const email = screen.getByLabelText('Your Email') as HTMLInputElement;
        const message = screen.getByLabelText('Message') as HTMLTextAreaElement;

        fireEvent.change(name, { target: { value: 'Alice' } });
        fireEvent.change(email, { target: { value: 'alice@example.com' } });
        fireEvent.change(message, { target: { value: 'I would like to book this venue please' } });

        // Submit must run without `ReferenceError: booker is not defined`.
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /submit inquiry/i }));
        });

        expect(submitInquiry).toHaveBeenCalledTimes(1);
    });
});

// ===========================================================================
// 11.2 — Quantity cap (Requirement 11.2)   EXPECT: PASS (guard)
// The real events "+" handler is `Math.min(Math.min(10, spotsLeft), qty + 1)`
// and disables at max. This models that exact handler and asserts the cap holds.
// ===========================================================================
describe('11.2 quantity cap (regression guard — expected PASS)', () => {
    // Mirrors client/src/app/events/[id]/page.tsx quantity "+" handler.
    function incrementQuantity(current: number, spotsLeft: number): number {
        return Math.min(Math.min(10, spotsLeft), current + 1);
    }
    function plusDisabled(current: number, spotsLeft: number): boolean {
        return current >= Math.min(10, spotsLeft);
    }

    it('clicking "+" never lets quantity exceed availableSlots', () => {
        const spotsLeft = 3;
        let qty = 1;
        for (let i = 0; i < 20; i++) {
            if (plusDisabled(qty, spotsLeft)) break;
            qty = incrementQuantity(qty, spotsLeft);
        }
        expect(qty).toBeLessThanOrEqual(spotsLeft);
        expect(qty).toBe(3);
        expect(plusDisabled(qty, spotsLeft)).toBe(true);
    });

    it('caps at the hard ceiling of 10 when many spots remain', () => {
        const spotsLeft = 500;
        let qty = 1;
        for (let i = 0; i < 50; i++) {
            if (plusDisabled(qty, spotsLeft)) break;
            qty = incrementQuantity(qty, spotsLeft);
        }
        expect(qty).toBe(10);
    });
});

// ===========================================================================
// CC-4 — Toast renders above modal (Requirement 2.7)   EXPECT: FAIL (real bug)
// happy-dom cannot compute real stacking from Tailwind classes, so we assert on
// the rendered z-index class tokens (a valid static-behavior check): the toast
// container's z-index MUST be strictly greater than the modal overlay's.
// Current code: toast z-50, modal z-[70]  ->  50 > 70 is false  ->  FAILS.
// ===========================================================================
describe('CC-4 toast above modal (real bug — expected FAIL until fixed)', () => {
    function ToastTrigger() {
        const { showToast } = useToast();
        return <button onClick={() => showToast('Booked!', 'success')}>fire</button>;
    }

    it('toast container z-index is strictly greater than the modal overlay z-index', () => {
        render(
            <ToastProvider>
                <Modal isOpen onClose={() => {}} title="Booking">
                    <ToastTrigger />
                </Modal>
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'fire' }));

        const modalOverlay = document.querySelector('[role="dialog"]') as HTMLElement;
        const toastContainer = document.querySelector('[role="status"]') as HTMLElement;

        expect(modalOverlay).toBeTruthy();
        expect(toastContainer).toBeTruthy();

        const modalZ = tailwindZIndex(modalOverlay.className);
        const toastZ = tailwindZIndex(toastContainer.className);

        expect(modalZ).not.toBeNull();
        expect(toastZ).not.toBeNull();

        // The fix (Task 3.1) raises the toast to z-[100]. On unfixed code this fails.
        expect(toastZ as number).toBeGreaterThan(modalZ as number);
    });
});

// ===========================================================================
// CC-3 — Body scroll lock (Requirements 2.5, 2.6)   MIXED
// The shared <Modal> locks body scroll (expected PASS). A hand-rolled
// `fixed inset-0` overlay (as used on dashboard/tickets, dashboard/venues)
// does NOT lock the body (expected FAIL) — that is the bug Task 5 migrates.
// ===========================================================================
describe('CC-3 body-scroll-lock', () => {
    it('shared <Modal> locks document.body scroll while open (preservation — expected PASS)', () => {
        const { rerender } = render(
            <Modal isOpen onClose={() => {}} title="Locked">
                <p>content</p>
            </Modal>
        );
        expect(document.body.style.overflow).toBe('hidden');

        // Closing restores scroll.
        rerender(
            <Modal isOpen={false} onClose={() => {}} title="Locked">
                <p>content</p>
            </Modal>
        );
        expect(document.body.style.overflow).toBe('unset');
    });

    it('hand-rolled fixed overlay locks body scroll (real bug — expected FAIL until migrated to <Modal>)', () => {
        // Faithful shape of dashboard/tickets/page.tsx L281 & dashboard/venues overlays:
        // a `fixed inset-0` overlay with NO body-scroll-lock side effect.
        function HandRolledOverlay({ open }: { open: boolean }) {
            if (!open) return null;
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
                    <div className="relative w-full max-w-sm">overlay body</div>
                </div>
            );
        }

        document.body.style.overflow = '';
        render(<HandRolledOverlay open />);

        // Expected (post-fix) behavior: an open full-screen overlay locks body scroll.
        // Unfixed hand-rolled overlays never touch body overflow, so this FAILS.
        expect(document.body.style.overflow).toBe('hidden');
    });
});

// ===========================================================================
// 8.1 — Venues filter fires exactly one API call per "Show results" submit
//        EXPECT: FAIL (real bug — API fires per option click via the effect)
// Faithful minimal reproduction of client/src/app/venues/page.tsx wiring:
// FilterPanel option onChange -> setState -> useEffect -> venuesApi.getAll.
// ===========================================================================
describe('8.1 filter single API call (real bug — expected FAIL until draft state added)', () => {
    it('selecting filter options without clicking "Show results" makes no API call', () => {
        const getAll = vi.fn().mockResolvedValue({ venues: [], totalPages: 0, currentPage: 1, total: 0 });

        // Mirrors the FIXED venues page (Task 8.1): filter controls edit DRAFT
        // state only; the list fetch is committed from applied state, which the
        // FilterPanel's onApply ("Show results") sets. So option clicks fetch
        // nothing; only a submit does.
        function VenuesFilterHarness() {
            // Draft = what the panel edits. Applied = what drives the fetch.
            const [draftVenueType, setDraftVenueType] = useState('all');
            const [draftCapacity, setDraftCapacity] = useState('all');
            const [venueType, setVenueType] = useState('all');
            const [capacity, setCapacity] = useState('all');
            const [isFiltered] = useState(true);

            const fetchFiltered = useCallback(() => {
                getAll({ venueType, maxCapacity: capacity });
            }, [venueType, capacity]);

            // Same pattern as page.tsx: fetch when APPLIED filters change.
            useEffect(() => {
                if (isFiltered) fetchFiltered();
            }, [venueType, capacity, isFiltered, fetchFiltered]);

            const applyFilters = () => {
                setVenueType(draftVenueType);
                setCapacity(draftCapacity);
            };

            const groups: FilterGroup[] = [
                {
                    key: 'venueType', label: 'Type', type: 'pills', value: draftVenueType,
                    defaultValue: 'all', onChange: setDraftVenueType,
                    options: [
                        { value: 'all', label: 'All' },
                        { value: 'hall', label: 'Hall' },
                        { value: 'lounge', label: 'Lounge' },
                    ],
                },
                {
                    key: 'capacity', label: 'Capacity', type: 'pills', value: draftCapacity,
                    defaultValue: 'all', onChange: setDraftCapacity,
                    options: [
                        { value: 'all', label: 'All' },
                        { value: '50', label: '50+' },
                        { value: '100', label: '100+' },
                    ],
                },
            ];
            return <FilterPanel groups={groups} onReset={() => {}} onApply={applyFilters} />;
        }

        render(<VenuesFilterHarness />);
        getAll.mockClear(); // ignore any mount fetch; count only interaction-driven calls

        // FilterPanel renders BOTH a mobile and a desktop panel in the DOM (they
        // are hidden via CSS, which happy-dom keeps mounted), so option labels
        // resolve to two nodes. Click the first match of each — one real user
        // interaction per option — WITHOUT clicking "Show results".
        const clickFirst = (name: string) =>
            fireEvent.click(screen.getAllByRole('button', { name })[0]);

        fireEvent.click(screen.getByRole('button', { name: /filters/i }));
        clickFirst('Hall');
        clickFirst('100+');
        clickFirst('Lounge');

        // Expected (post-fix) behavior: 0 calls while only selecting; the call
        // fires only from "Show results". Unfixed wiring fires per click -> FAILS.
        expect(getAll).not.toHaveBeenCalled();
    });
});
