'use client';

import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface StepperStep {
    /** Short label shown under the step dot (optional, e.g. "Basics"). */
    label?: string;
    /** The step's body content. */
    content: React.ReactNode;
}

interface StepperModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    /** Ordered steps. The modal renders `steps[step].content`. */
    steps: StepperStep[];
    /** Zero-based current step index (parent-owned so validation can jump). */
    step: number;
    onStepChange: (next: number) => void;
    /** Called when the user finishes the last step. */
    onFinish: () => void;
    /** Label for the finish button on the last step. */
    finishLabel?: string;
    /** Loading state for the finish button. */
    isFinishing?: boolean;
    /**
     * Optional guard run before advancing/finishing. Return false to block
     * navigation (the parent typically shows its own validation toast/error).
     */
    canAdvance?: (fromStep: number) => boolean;
    /**
     * Discard everything entered and return to step 1. Optional: a flow with no
     * meaningful draft (nothing to lose) should not offer it.
     *
     * Needed because these forms now keep their draft across an accidental close,
     * so without an explicit discard there was no way to start over short of a page
     * reload.
     */
    onReset?: () => void;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

/**
 * Reusable multi-step (stepper) modal built on the shared <Modal>.
 * Reused for event creation, event edit, and venue creation so the same
 * responsive, scroll-locked, focus-trapped container serves every create/edit
 * flow (bugfix 11.12 / 11.13). Because it sits on <Modal>, its content is
 * responsive by construction — no fixed widths — which also delivers the
 * event-create mobile no-overflow fix (35.1).
 *
 * ponytail: the parent owns step state + per-step validation; this component
 * only owns the dots + Back/Next/Finish chrome. Ceiling: linear steps only
 * (no branching wizard) — add a step-graph prop if a non-linear flow appears.
 */
export function StepperModal({
    isOpen,
    onClose,
    title,
    steps,
    step,
    onStepChange,
    onFinish,
    finishLabel = 'Finish',
    isFinishing = false,
    canAdvance,
    onReset,
    size = 'lg',
}: StepperModalProps) {
    const total = steps.length;
    const isFirst = step <= 0;
    const isLast = step >= total - 1;
    const current = steps[Math.min(Math.max(step, 0), total - 1)];

    const handleNext = () => {
        if (canAdvance && !canAdvance(step)) return;
        if (isLast) {
            onFinish();
        } else {
            onStepChange(step + 1);
        }
    };

    const handleBack = () => {
        if (!isFirst) onStepChange(step - 1);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
            {/* Progress: a count, not a row of dots.
                The dots-and-connectors version was a fixed 8px circle plus a
                32-48px line per step, so its width grew with the step count and
                overflowed the panel - at five steps the first and last dots were
                clipped off both edges of a phone screen. A count reads the same at
                any number of steps and cannot overflow. */}
            <div className="flex items-baseline justify-between gap-3 mb-4">
                {current?.label && (
                    <h3 className="text-lg font-semibold text-white truncate">{current.label}</h3>
                )}
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0" aria-live="polite">
                    Step {Math.min(step + 1, total)} of {total}
                </span>
            </div>

            {/* Only the active step's content renders; the parent keeps all
                fields mounted in state so nothing is lost between steps. */}
            <div className="space-y-6">{current?.content}</div>

            {/* Footer: Back, then Clear all, then Next/Finish.
                Next stays at the far right - it is the action taken on every step, so it
                belongs at the end of the row where the thumb already is. Clear all sits
                inside the row rather than past the primary action, and stays a quiet text
                button: it destroys the whole draft, so it must not read as a peer of
                Next. */}
            {/* flex-wrap plus ml-auto on the action group, rather than a rigid
                justify-between row.
                Every button here is whitespace-nowrap (a wrapped label turns a
                rounded-full pill into a blob), so the row's minimum width is the sum of
                its labels. With a long finishLabel like "Save changes" plus a loading
                spinner that total exceeded a phone's width and the primary action was
                clipped off the panel edge - it fit on iOS and overflowed on Android
                only because Roboto is wider than San Francisco. Wrapping moves the
                group to its own right-aligned line instead of clipping it, at any font
                or label length.

                `hidden` rather than `invisible` on Back: ml-auto keeps the primary
                action right-aligned either way, so there is no reason to reserve the
                space on step one. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-6 mt-2 border-t border-white/5">
                <Button
                    variant="secondary"
                    onClick={handleBack}
                    disabled={isFinishing}
                    className={isFirst ? 'hidden' : ''}
                >
                    Back
                </Button>
                <div className="flex items-center gap-3 ml-auto min-w-0">
                    {onReset && (
                        <button
                            type="button"
                            onClick={onReset}
                            disabled={isFinishing}
                            className="text-xs text-gray-400 hover:text-red-400 disabled:text-gray-600 px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
                        >
                            Clear all
                        </button>
                    )}
                    <Button onClick={handleNext} isLoading={isLast && isFinishing} className="flex-shrink-0">
                        {isLast ? finishLabel : 'Next'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
