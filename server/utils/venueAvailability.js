/**
 * Venue availability helpers around `Venue.blockedDates`.
 *
 * A blockedDates entry is `{ date: 'YYYY-MM-DD', slots: [{ type: 'busy' | 'booked' }] }`.
 * - 'booked' = a FIRA booking/event reserved the day (written by the system).
 * - 'busy'   = the OWNER blocked the day for an offline/external booking (phone,
 *   walk-in, another site) via their calendar.
 *
 * Both mean the day is taken. This is the single source of truth for that rule,
 * so the booking and event create paths can't drift apart on what "unavailable"
 * means.
 */

/** The 'YYYY-MM-DD' key blockedDates uses, for a Date or date-ish value. */
function dayKey(date) {
    return new Date(date).toISOString().split('T')[0];
}

/**
 * True if the venue has an owner-set 'busy' block on the given day.
 * `blockedDates` may be undefined on older venue docs - treated as "no blocks".
 */
function isDayBlockedByOwner(blockedDates, date) {
    const key = dayKey(date);
    const entry = (blockedDates || []).find(d => d.date === key);
    return !!entry && Array.isArray(entry.slots) && entry.slots.some(s => s.type === 'busy');
}

module.exports = { dayKey, isDayBlockedByOwner };
