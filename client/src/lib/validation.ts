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
