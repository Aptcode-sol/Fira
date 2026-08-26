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
            {/* Progress dots — same visual language as the ticket-tier steps. */}
            <div className="flex items-center justify-center gap-2 mb-6">
                {steps.map((s, i) => (
                    <div key={i} className="flex items-center">
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                                step >= i ? 'bg-violet-500 text-white' : 'bg-white/10 text-gray-300'
                            }`}
                        >
                            {i + 1}
                        </div>
                        {i < total - 1 && (
                            <div className={`w-8 sm:w-12 h-0.5 mx-1 sm:mx-2 ${step > i ? 'bg-violet-500' : 'bg-white/10'}`} />
                        )}
                    </div>
                ))}
            </div>

            {current?.label && (
                <h3 className="text-lg font-semibold text-white mb-4">{current.label}</h3>
            )}

            {/* Only the active step's content renders; the parent keeps all
                fields mounted in state so nothing is lost between steps. */}
            <div className="space-y-6">{current?.content}</div>

            {/* Footer: Back / Next|Finish */}
            <div className="flex justify-between gap-3 pt-6 mt-2 border-t border-white/5">
                <Button
                    variant="secondary"
                    onClick={handleBack}
                    disabled={isFirst || isFinishing}
                    className={isFirst ? 'invisible' : ''}
                >
                    Back
                </Button>
                <Button onClick={handleNext} isLoading={isLast && isFinishing}>
                    {isLast ? finishLabel : 'Next'}
                </Button>
            </div>
        </Modal>
    );
}
