/**
 * Sticky bar that appears when rows are selected, offering bulk actions.
 *
 * Shown only when count > 0, so it never occupies space in the resting state.
 * Each action is { label, onClick, variant } - variant 'danger' tints it red for
 * destructive operations (delete/block). The caller owns the confirm dialog and
 * the API calls; this is purely the presentation of "N selected + these buttons".
 */
export default function BulkActionBar({ count, actions = [], onClear, busy = false }) {
    if (count === 0) return null;

    return (
        <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-violet-500/10 border border-violet-500/30 backdrop-blur-md">
            <span className="text-sm text-white font-medium">
                {count} selected
            </span>
            <div className="flex-1" />
            {actions.map((action) => (
                <button
                    key={action.label}
                    onClick={action.onClick}
                    disabled={busy}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        action.variant === 'danger'
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                >
                    {action.label}
                </button>
            ))}
            <button
                onClick={onClear}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
                Clear
            </button>
        </div>
    );
}
