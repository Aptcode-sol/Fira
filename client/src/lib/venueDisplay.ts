/**
 * The venue label to show for an event.
 *
 * An event either links a real Venue (`venue`) or carries a `customVenue` the
 * organiser typed. Callers were reading `event.venue?.name` alone and falling
 * back to "TBA", so every custom-venue event rendered "TBA" even though the name
 * was sitting on `customVenue.name`. One resolver, used at every venue-label
 * site, fixes it once instead of per caller.
 *
 * `venue` may be an unpopulated id (a string), in which case there is no name to
 * read - the custom venue and then the fallback cover that.
 */

type VenueLike = { name?: string; address?: { city?: string } } | string | null | undefined;
type CustomVenueLike = { name?: string; city?: string; address?: string } | null | undefined;
type EventLike = { venue?: VenueLike; customVenue?: CustomVenueLike };

const linkedVenue = (v: VenueLike) => (v && typeof v === 'object' ? v : undefined);

/** Venue name, or `fallback` when neither a linked nor a custom venue names one. */
export function venueName(event: EventLike, fallback = 'TBA'): string {
    return (
        linkedVenue(event.venue)?.name ||
        event.customVenue?.name ||
        fallback
    );
}

/** Venue city, or '' when unknown (custom venues store the city as a plain string). */
export function venueCity(event: EventLike): string {
    return linkedVenue(event.venue)?.address?.city || event.customVenue?.city || '';
}

/** "Name, City" when a city is known, otherwise just the name (or `fallback`). */
export function venueLabel(event: EventLike, fallback = 'TBA'): string {
    const name = venueName(event, fallback);
    const city = venueCity(event);
    return city ? `${name}, ${city}` : name;
}
