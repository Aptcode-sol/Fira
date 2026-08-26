/**
 * Task 12 (20.2) — venue owner maps/location link client-side validation.
 *
 * Mirrors the server rule in server/routes/venue.js: a locationLink is valid
 * when empty (clearing it) OR a well-formed URL. The client uses the same
 * decision so an invalid link is rejected inline BEFORE submit.
 *
 * Property 11: for any string, accepted iff valid URL (client matches server).
 * Validates: Requirements 20.2 (preservation: 21.2 valid links still persist).
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { isValidLocationLink } from '@/lib/validation';

// Independent oracle of the server's z.string().url(): the WHATWG URL parser.
// (The implementation happens to use this too, so the fuzz test guards against
// the empty-string special case and future divergence rather than the parser.)
const parses = (v: string): boolean => {
    try {
        // eslint-disable-next-line no-new
        new URL(v);
        return true;
    } catch {
        return false;
    }
};

describe('20.2 maps/location link validation (bug condition — invalid rejected)', () => {
    it('rejects a non-URL string', () => {
        expect(isValidLocationLink('not a url')).toBe(false);
    });

    it('rejects a bare hostname with no scheme', () => {
        expect(isValidLocationLink('maps.google.com/place/x')).toBe(false);
    });
});

describe('21.2 preservation — valid + empty links accepted', () => {
    it('accepts a real maps URL', () => {
        expect(isValidLocationLink('https://maps.google.com/?q=venue')).toBe(true);
    });

    it('accepts an empty string (clearing the link)', () => {
        expect(isValidLocationLink('')).toBe(true);
        expect(isValidLocationLink('   ')).toBe(true);
    });
});

describe('Property 11 — client validator matches the WHATWG URL parser', () => {
    it('accepts iff empty-after-trim OR a parseable URL, for any string', () => {
        fc.assert(
            fc.property(fc.string(), (s) => {
                const trimmed = s.trim();
                const expected = trimmed === '' || parses(trimmed);
                expect(isValidLocationLink(s)).toBe(expected);
            })
        );
    });

    it('accepts any well-formed http(s) URL from the web-url arbitrary', () => {
        fc.assert(
            fc.property(fc.webUrl(), (url) => {
                expect(isValidLocationLink(url)).toBe(true);
            })
        );
    });
});
