import { describe, it, expect } from 'vitest';
import { venueName, venueCity, venueLabel } from './venueDisplay';

/**
 * The bug: custom-venue events rendered "TBA" because callers only read
 * `venue.name`. These lock in that the custom name wins when there is no linked
 * venue, and that an unpopulated venue id never masks the custom name.
 */
describe('venueDisplay', () => {
    it('uses the linked venue name and city when present', () => {
        const e = { venue: { name: 'Skyline Club', address: { city: 'Mumbai' } } };
        expect(venueName(e)).toBe('Skyline Club');
        expect(venueCity(e)).toBe('Mumbai');
        expect(venueLabel(e)).toBe('Skyline Club, Mumbai');
    });

    it('falls back to the custom venue name instead of TBA', () => {
        const e = { customVenue: { isCustom: true, name: 'My Rooftop', city: 'Pune' } };
        expect(venueName(e)).toBe('My Rooftop');
        expect(venueLabel(e)).toBe('My Rooftop, Pune');
    });

    it('reads the custom name even when venue is an unpopulated id string', () => {
        const e = { venue: '652f...id', customVenue: { name: 'Garden Lawn' } };
        expect(venueName(e)).toBe('Garden Lawn');
    });

    it('returns the fallback only when nothing names a venue', () => {
        expect(venueName({})).toBe('TBA');
        expect(venueLabel({ venue: null, customVenue: null })).toBe('TBA');
        expect(venueCity({})).toBe('');
    });

    it('omits the city separator when no city is known', () => {
        expect(venueLabel({ customVenue: { name: 'Home' } })).toBe('Home');
    });
});
