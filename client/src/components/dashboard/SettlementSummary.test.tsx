import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettlementSummary from './SettlementSummary';
import { settlementApi, type OwnerSettlementDTO } from '@/lib/api';

// The owner view reads one listing's settlement over settlementApi. That module
// is mocked so each example drives the component from a known server payload.
// settlementApi exposes only two getters by design (Requirement 9.6) — there is
// no write method to mock.
vi.mock('@/lib/api', () => ({
    settlementApi: {
        getEventSettlement: vi.fn(),
        getVenueSettlement: vi.fn(),
    },
}));

const getEventSettlement = vi.mocked(settlementApi.getEventSettlement);

function ownerDto(overrides: Partial<OwnerSettlementDTO> = {}): OwnerSettlementDTO {
    return {
        listing: { kind: 'event', id: 'e1', name: 'Test Event' },
        money: {
            ownerGross: 10000,
            platformCommission: 1000,
            netPayable: 9000,
            settledToDate: 5000,
            outstandingAmount: 4000,
            refundedTotal: 0,
        },
        activity: {
            successfulPayments: 12,
            unitsSold: 12,
            confirmed: 12,
            cancelled: 0,
            refundedPayments: 0,
            lastPaymentAt: '2024-12-30T14:00:00.000Z',
        },
        state: 'partially_settled',
        entries: [
            { settledAmount: 5000, settlementReference: 'TXN-1', settledAt: '2024-12-28T10:00:00.000Z', reversed: false },
        ],
        ...overrides,
    };
}

beforeEach(() => {
    getEventSettlement.mockReset();
});

describe('SettlementSummary — owner view (Requirement 9)', () => {
    it('shows the three labeled headline figures (9.4)', async () => {
        getEventSettlement.mockResolvedValue(ownerDto());
        const { container } = render(<SettlementSummary kind="event" listingId="e1" />);

        // Scope to the headline grid so the "Net payable" that also appears in the
        // earnings breakdown below isn't mistaken for a headline figure.
        await screen.findByText('Settled to date');
        const headline = container.querySelector('.grid') as HTMLElement;
        expect(headline).not.toBeNull();

        expect(within(headline).getByText('Net payable')).toBeInTheDocument();
        expect(within(headline).getByText('Settled to date')).toBeInTheDocument();
        expect(within(headline).getByText('Outstanding')).toBeInTheDocument();

        // The figures are the server's, rendered through the shared formatInr.
        expect(within(headline).getByText('₹9,000.00')).toBeInTheDocument(); // net payable
        expect(within(headline).getByText('₹5,000.00')).toBeInTheDocument(); // settled to date
        expect(within(headline).getByText('₹4,000.00')).toBeInTheDocument(); // outstanding
    });

    it('marks a reversed row and keeps its amount out of the settled-to-date total (9.5)', async () => {
        // Two entries: one live ₹5,000, one reversed ₹3,000. The server has already
        // netted the reversed pair out, so settledToDate is 5,000 — the component
        // renders that figure and never adds the reversed row back in.
        getEventSettlement.mockResolvedValue(
            ownerDto({
                money: { ...ownerDto().money, settledToDate: 5000 },
                entries: [
                    { settledAmount: 5000, settlementReference: 'TXN-1', settledAt: '2024-12-28T10:00:00.000Z', reversed: false },
                    { settledAmount: 3000, settlementReference: 'TXN-2', settledAt: '2024-12-27T10:00:00.000Z', reversed: true },
                ],
            }),
        );
        const { container } = render(<SettlementSummary kind="event" listingId="e1" />);

        // The reversed row is listed and flagged, not hidden.
        expect(await screen.findByText('Reversed')).toBeInTheDocument();
        expect(screen.getByText('₹3,000.00')).toBeInTheDocument();

        // The exclusion is stated in words.
        expect(
            screen.getByText(/reversed settlement is excluded from your settled-to-date total/i),
        ).toBeInTheDocument();

        // The displayed total is the server's 5,000, i.e. the reversed 3,000 was
        // not folded into it by the view (5,000 + 3,000 = 8,000 must not appear).
        const headline = container.querySelector('.grid') as HTMLElement;
        expect(within(headline).getByText('₹5,000.00')).toBeInTheDocument();
        expect(within(headline).queryByText('₹8,000.00')).toBeNull();
    });

    it('states both boundary indications when nothing has happened yet (9.7, 9.8)', async () => {
        getEventSettlement.mockResolvedValue(
            ownerDto({
                money: { ownerGross: 0, platformCommission: 0, netPayable: 0, settledToDate: 0, outstandingAmount: 0, refundedTotal: 0 },
                activity: { successfulPayments: 0, unitsSold: 0, confirmed: 0, cancelled: 0, refundedPayments: 0, lastPaymentAt: null },
                state: 'not_settled',
                entries: [],
            }),
        );
        render(<SettlementSummary kind="event" listingId="e1" />);

        const message = await screen.findByText(/has no payments yet/i);
        // One text carries both boundary facts: no payout is yet due, and no
        // settlement has been made yet.
        expect(message).toHaveTextContent(/no payout is yet due/i);
        expect(message).toHaveTextContent(/no settlement has been made yet/i);
    });

    it('states the two boundaries distinctly in the ready view when there are payments but no payout and no entries (9.7, 9.8)', async () => {
        // Payments exist (so this is `ready`, not the combined empty state), yet
        // netPayable is 0 and the ledger is empty — the two boundaries then show
        // as separate indications.
        getEventSettlement.mockResolvedValue(
            ownerDto({
                money: { ...ownerDto().money, netPayable: 0, settledToDate: 0, outstandingAmount: 0 },
                activity: { ...ownerDto().activity, successfulPayments: 4, refundedPayments: 0 },
                state: 'not_settled',
                entries: [],
            }),
        );
        render(<SettlementSummary kind="event" listingId="e1" />);

        expect(await screen.findByText(/no payout is yet due for this event/i)).toBeInTheDocument();
        expect(screen.getByText(/no settlement has been made yet/i)).toBeInTheDocument();
    });

    it('has no write control anywhere in the tree in the ready view (9.6)', async () => {
        getEventSettlement.mockResolvedValue(ownerDto());
        render(<SettlementSummary kind="event" listingId="e1" />);
        await screen.findByText('Settled to date');

        // No button, and nothing that writes: no text input, number input, select,
        // checkbox or textbox. The owner view creates, edits, reverses and disputes
        // nothing.
        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
        expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
        expect(screen.queryAllByRole('combobox')).toHaveLength(0);
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });

    it('the only control anywhere is the error-state retry, which re-reads (9.6, 13.4)', async () => {
        getEventSettlement.mockRejectedValue(new Error('network down'));
        render(<SettlementSummary kind="event" listingId="e1" />);

        await screen.findByText(/couldn.t load settlement/i);
        const buttons = screen.queryAllByRole('button');
        expect(buttons).toHaveLength(1);
        expect(buttons[0]).toHaveTextContent(/try again/i);
    });
});
