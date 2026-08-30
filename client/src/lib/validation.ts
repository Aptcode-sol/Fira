// Client-side validators that MUST mirror the server. Keeping them here (one
// place) avoids drift between the two forms that submit a venue.

// Mirrors the server rule in `server/routes/venue.js` (Req 20.2): a location/maps
// link is valid when it is empty (clearing the link) OR a well-formed URL. The
// server uses zod's `z.string().url()`; the browser's native `URL` constructor
// applies the same WHATWG parse, so we reuse it rather than a regex.
// ponytail: native `URL` is the platform's own URL parser — no dependency, one line.
export function isValidLocationLink(value: string): boolean {
    const trimmed = value.trim();
    if (trimmed === '') return true;
    try {
        // eslint-disable-next-line no-new
        new URL(trimmed);
        return true;
    } catch {
        return false;
    }
}

/**
 * Indian PIN code: exactly six digits, and the first digit is 1-9 (no PIN starts
 * with 0). Anchored so "560001x" and " 560001" are rejected rather than partially
 * matched.
 */
export function isValidPincode(value: string): boolean {
    return /^[1-9][0-9]{5}$/.test(value.trim());
}

/** A required text field, trimmed - whitespace is not an answer. */
export function isFilled(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate a whole step and return a field -> message map.
 *
 * Returning a map rather than the first failure is deliberate: a toast can only
 * say one thing at a time, so a form with three empty fields took three attempts
 * to get past. Marking every offending field at once is one pass.
 */
export type FieldErrors = Record<string, string>;

/** True when the map has no entries, i.e. the step is valid. */
export function isClean(errors: FieldErrors): boolean {
    return Object.keys(errors).length === 0;
}
