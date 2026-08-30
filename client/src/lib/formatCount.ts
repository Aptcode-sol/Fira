/**
 * Instagram-style compact count: 999, 1K, 55.5K, 345M.
 *
 * Rules, in order:
 *  - under 1,000 stays exact (the difference between 3 and 8 followers matters)
 *  - a trailing ".0" is dropped, so 1000 renders "1K" rather than "1.0K"
 *  - truncates rather than rounds, so 1,999 is "1.9K" and never the misleading
 *    "2K" for a number that has not actually reached 2,000
 *  - caps at B, past any realistic value here but it keeps the width bounded
 *  - non-finite and negative inputs collapse to "0" instead of rendering "NaN"
 *
 * Widest output is 6 characters ("999.9K"), which is what callers size for.
 */
export function formatCount(value: number): string {
    const count = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    if (count < 1000) return String(count);

    const units: Array<[number, string]> = [
        [1_000_000_000, 'B'],
        [1_000_000, 'M'],
        [1_000, 'K'],
    ];

    for (const [size, suffix] of units) {
        if (count >= size) {
            // One decimal place, floored so the number never reads higher than it is.
            const tenths = Math.floor((count / size) * 10) / 10;
            const text = tenths % 1 === 0 ? tenths.toFixed(0) : tenths.toFixed(1);
            return text + suffix;
        }
    }

    return String(count);
}
