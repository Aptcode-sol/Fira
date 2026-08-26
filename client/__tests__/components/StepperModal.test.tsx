import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { StepperModal, type StepperStep } from '@/components/ui';

const steps: StepperStep[] = [
    { label: 'One', content: <div>step-one-body</div> },
    { label: 'Two', content: <div>step-two-body</div> },
    { label: 'Three', content: <div>step-three-body</div> },
];

// Small harness so step state is real (StepperModal is parent-controlled).
function Harness({
    onFinish,
    canAdvance,
}: {
    onFinish: () => void;
    canAdvance?: (from: number) => boolean;
}) {
    const [step, setStep] = useState(0);
    return (
        <StepperModal
            isOpen
            onClose={() => {}}
            title="Wizard"
            steps={steps}
            step={step}
            onStepChange={setStep}
            onFinish={onFinish}
            canAdvance={canAdvance}
            finishLabel="Done"
        />
    );
}

describe('StepperModal', () => {
    it('shows only the current step and advances / goes back through steps', () => {
        render(<Harness onFinish={vi.fn()} />);

        // Step 1 visible, others not.
        expect(screen.getByText('step-one-body')).toBeInTheDocument();
        expect(screen.queryByText('step-two-body')).not.toBeInTheDocument();

        // Next -> step 2.
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(screen.getByText('step-two-body')).toBeInTheDocument();
        expect(screen.queryByText('step-one-body')).not.toBeInTheDocument();

        // Back -> step 1.
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(screen.getByText('step-one-body')).toBeInTheDocument();
    });

    it('shows Finish on the last step and calls onFinish', () => {
        const onFinish = vi.fn();
        render(<Harness onFinish={onFinish} />);

        fireEvent.click(screen.getByRole('button', { name: 'Next' })); // -> 2
        fireEvent.click(screen.getByRole('button', { name: 'Next' })); // -> 3 (last)

        const finish = screen.getByRole('button', { name: 'Done' });
        expect(finish).toBeInTheDocument();
        fireEvent.click(finish);
        expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it('blocks advancing when canAdvance returns false', () => {
        render(<Harness onFinish={vi.fn()} canAdvance={() => false} />);

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        // Still on step 1 because the guard blocked navigation.
        expect(screen.getByText('step-one-body')).toBeInTheDocument();
        expect(screen.queryByText('step-two-body')).not.toBeInTheDocument();
    });
});
