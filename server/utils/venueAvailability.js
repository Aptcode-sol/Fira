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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Longest span a single personal booking may cover; guards the day loop below. */
const MAX_BOOKING_DAYS = 31;

/**
 * Every 'YYYY-MM-DD' key a booking covers, start to end inclusive.
 *
 * Booking is day-rate, so a 21st-22nd booking takes BOTH days. Only the start
 * day used to be checked and blocked, which let a second guest book the 22nd
 * (or book 21st-22nd over an existing 22nd). Keys are UTC, matching `dayKey`
 * and the 'YYYY-MM-DD' strings the client sends.
 *
 * @param {Date | string} startDate
 * @param {Date | string | null | undefined} endDate  absent ⇒ single day
 * @returns {string[]}
 */
function bookingDayKeys(startDate, endDate) {
    const startKey = dayKey(startDate);
    const endKey = endDate ? dayKey(endDate) : startKey;
    const keys = [];
    let t = Date.parse(`${startKey}T00:00:00Z`);
    const last = Date.parse(`${endKey}T00:00:00Z`);
    while (t <= last && keys.length < MAX_BOOKING_DAYS) {
        keys.push(new Date(t).toISOString().split('T')[0]);
        t += MS_PER_DAY;
    }
    return keys;
}

/**
 * True if the day carries ANY block - an owner 'busy' or a system 'booked' slot.
 * Booking is day-rate, so a partial block still takes the whole day.
 */
function isDayTaken(blockedDates, date) {
    const key = typeof date === 'string' ? date : dayKey(date);
    const entry = (blockedDates || []).find(d => d.date === key);
    return !!entry && Array.isArray(entry.slots) && entry.slots.length > 0;
}

/**
 * Mongo filter for active (pending/accepted) bookings on `venueId` whose day
 * range overlaps [startKey, endKey]. Legacy bookings without `endDate` are
 * single-day bookings on `bookingDate`.
 *
 * @param {*} venueId
 * @param {string} startKey 'YYYY-MM-DD'
 * @param {string} endKey   'YYYY-MM-DD'
 * @param {*} [excludeId]   a booking to ignore (e.g. the one being confirmed)
 */
function overlappingBookingFilter(venueId, startKey, endKey, excludeId) {
    const rangeStart = new Date(`${startKey}T00:00:00Z`);
    const rangeEndExclusive = new Date(Date.parse(`${endKey}T00:00:00Z`) + MS_PER_DAY);
    const filter = {
        venue: venueId,
        status: { $in: ['pending', 'accepted'] },
        bookingDate: { $lt: rangeEndExclusive },
        $or: [
            { endDate: { $gte: rangeStart } },
            { endDate: null, bookingDate: { $gte: rangeStart } },
        ],
    };
    if (excludeId) filter._id = { $ne: excludeId };
    return filter;
}

/**
 * Mark every day of `booking` as 'booked' on the venue doc (mutates, caller
 * saves). Idempotent: a day already holding this booking's slot is skipped, so
 * accept-then-pay (or a retried verify) never stacks duplicate slots.
 */
function blockBookingDays(venue, booking) {
    if (!Array.isArray(venue.blockedDates)) venue.blockedDates = [];
    const bookingId = String(booking._id);
    for (const key of bookingDayKeys(booking.bookingDate, booking.endDate)) {
        let entry = venue.blockedDates.find(d => d.date === key);
        if (!entry) {
            venue.blockedDates.push({ date: key, slots: [] });
            entry = venue.blockedDates[venue.blockedDates.length - 1];
        }
        if (entry.slots.some(s => s.booking && String(s.booking) === bookingId)) continue;
        entry.slots.push({
            startTime: booking.startTime,
            endTime: booking.endTime,
            type: 'booked',
            booking: booking._id,
        });
    }
}

/**
 * Remove `booking`'s 'booked' slots from every day it covered (mutates, caller
 * saves), dropping date entries left empty. Slots written before they carried a
 * booking id are matched the old way, by start/end time on a 'booked' slot.
 */
function releaseBookingDays(venue, booking) {
    if (!Array.isArray(venue.blockedDates)) return;
    const bookingId = String(booking._id);
    const keys = new Set(bookingDayKeys(booking.bookingDate, booking.endDate));
    for (const entry of venue.blockedDates) {
        if (!keys.has(entry.date) || !Array.isArray(entry.slots)) continue;
        entry.slots = entry.slots.filter(s => {
            if (s.booking) return String(s.booking) !== bookingId;
            return !(s.type === 'booked' && s.startTime === booking.startTime && s.endTime === booking.endTime);
        });
    }
    venue.blockedDates = venue.blockedDates.filter(d => !keys.has(d.date) || (d.slots && d.slots.length > 0));
}

module.exports = {
    dayKey,
    isDayBlockedByOwner,
    isDayTaken,
    bookingDayKeys,
    overlappingBookingFilter,
    blockBookingDays,
    releaseBookingDays,
    MAX_BOOKING_DAYS,
};
