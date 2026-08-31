// Payout lifecycle status pill. Moved out of `pages/Payouts.jsx` so the payout
// status shown beside a listing's settlement ledger (Requirement 1.5) looks
// identical to the same status on the Payouts page.

// Status → badge styling. 'unknown' covers absent/invalid stored status.
const STATUS_STYLES = {
    pending: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    processing: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    completed: 'text-green-400 bg-green-500/10 border-green-500/20',
    failed: 'text-red-400 bg-red-500/10 border-red-500/20',
    unknown: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
};

/**
 * @param {{ status?: string }} props
 */
export function StatusBadge({ status }) {
    const style = STATUS_STYLES[status] || STATUS_STYLES.unknown;
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${style}`}>
            {status || 'unknown'}
        </span>
    );
}
