// One headline figure card. Moved out of `pages/Payouts.jsx` so the settlement
// panel's headline figures (Requirement 1.4) render exactly like the earnings
// figures on the Payouts page instead of a near-copy of them.
//
// `value` is pre-formatted by the caller (via `formatInr`), so this stays a
// presentation component with no money knowledge.
const ACCENTS = {
    violet: 'text-violet-400 bg-violet-500/10',
    green: 'text-green-400 bg-green-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
    pink: 'text-pink-400 bg-pink-500/10',
    red: 'text-red-400 bg-red-500/10',
};

/**
 * @param {{ label: string, value: string, accent?: keyof typeof ACCENTS }} props
 */
export function FigureCard({ label, value, accent = 'violet' }) {
    return (
        <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-5">
            <div className={`text-xs font-medium px-2 py-1 rounded-md inline-block mb-3 ${ACCENTS[accent] || ACCENTS.violet}`}>
                {label}
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
        </div>
    );
}
