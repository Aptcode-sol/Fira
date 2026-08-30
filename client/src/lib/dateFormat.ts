/**
 * Conversions between the ISO date a form stores and the dd/mm/yyyy a user reads.
 *
 * A native `<input type="date">` renders its text in the *browser's* locale, so on an
 * en-US browser it shows mm/dd/yyyy and there is no attribute, CSS property or `lang`
 * value that changes it. The only way to guarantee dd/mm/yyyy is to draw the text
 * ourselves, which is what <DateField> does with these helpers.
 *
 * ISO (yyyy-mm-dd) stays the stored form throughout: it is what the API and the native
 * picker both expect, and it sorts and compares as a plain string.
 */

/** dd/mm/yyyy for display. Returns '' for anything unusable. */
export function isoToDisplay(iso: string | null | undefined): string {
    if (!iso) return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!match) return '';
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
}

/**
 * dd/mm/yyyy back to ISO, or '' when the input is not a real date.
 *
 * Rejects impossible days rather than letting them roll over: Date accepts 31/02 and
 * silently reports 2 March, so a typo would be stored as a different date than the one
 * on screen. Round-tripping through UTC parts catches that.
 */
export function displayToIso(display: string): string {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(display.trim());
    if (!match) return '';
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';

    const asDate = new Date(Date.UTC(year, month - 1, day));
    if (
        asDate.getUTCFullYear() !== year ||
        asDate.getUTCMonth() !== month - 1 ||
        asDate.getUTCDate() !== day
    ) {
        return '';
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Progressively format what someone is typing as dd/mm/yyyy.
 *
 * Slashes are inserted as they pass each boundary and everything non-numeric is
 * dropped, so the field cannot hold a shape that displayToIso would reject on
 * punctuation alone. Deliberately does not validate the date - a partly typed "1" has
 * to be allowed to stand while the rest arrives.
 */
export function maskDateInput(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
