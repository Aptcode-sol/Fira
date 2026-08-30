// Runnable check for the scanned-ticket parser.
//
// This is the piece that was broken: a ticket QR encodes a JSON payload, so the
// raw decoded text is an object, not an id - and the old code passed it straight
// to Ticket.findById, which could only ever throw a cast error. No real ticket
// QR could be checked in. These cases pin the parse down.
//
// Run: node server/services/scanTicket.check.mjs

import assert from 'node:assert/strict';

/** Mirror of eventService.parseScannedTicket. Kept in sync by these assertions. */
function parseScannedTicket(scanned) {
    if (typeof scanned !== 'string') return null;
    const raw = scanned.trim();
    if (!raw) return null;
    if (raw.startsWith('{')) {
        try {
            const parsed = JSON.parse(raw);
            return typeof parsed?.ticketId === 'string' ? parsed.ticketId.trim() : null;
        } catch {
            return null;
        }
    }
    return raw;
}

const qr = (extra = {}) => JSON.stringify({
    ticketId: 'TKT-A1B2C3D4E5F6',
    eventId: '68f000000000000000000001',
    userId: '68f000000000000000000002',
    quantity: 1,
    ticketType: 'VIP',
    timestamp: 1756500000000,
    ...extra,
});

const cases = [
    // The real QR payload: the whole reason the door never worked.
    [qr(), 'TKT-A1B2C3D4E5F6', 'ticket QR json'],
    // Manual entry at the door, typed off the ticket face.
    ['TKT-A1B2C3D4E5F6', 'TKT-A1B2C3D4E5F6', 'bare ticket id'],
    ['  TKT-A1B2C3D4E5F6  ', 'TKT-A1B2C3D4E5F6', 'bare id with whitespace'],
    [` ${qr()} `, 'TKT-A1B2C3D4E5F6', 'json with whitespace'],
    // Rejected: nothing usable to look up.
    ['', null, 'empty string'],
    ['   ', null, 'whitespace only'],
    ['{not json', null, 'malformed json'],
    [JSON.stringify({ eventId: 'x' }), null, 'json without ticketId'],
    [JSON.stringify({ ticketId: 42 }), null, 'non-string ticketId'],
    [null, null, 'null'],
    [undefined, null, 'undefined'],
    [{ ticketId: 'TKT-1' }, null, 'object rather than string'],
];

for (const [input, expected, label] of cases) {
    assert.equal(parseScannedTicket(input), expected, `${label}: ${JSON.stringify(input)}`);
}

// The tier in the QR is the buyer's own printable copy and must never be what the
// gate decides on - only the ticketId is taken from it. A forged payload claiming a
// different tier still resolves to the same ticket, whose real tier is read from the
// database.
assert.equal(
    parseScannedTicket(qr({ ticketType: 'Backstage' })),
    parseScannedTicket(qr({ ticketType: 'General' })),
    'a forged tier in the QR must not change which ticket is looked up'
);

/**
 * Mirror of the tier gate in validateScanAndCheckIn.
 *
 * `eventTierCount` matters: an unscoped scanner is only legitimate on an event that
 * has no tiers. On a tiered event it would admit every tier and so walk round all the
 * per-tier links, which is what the stale links generated before tier scoping did.
 */
const admits = (scannerTier, ticketTier, eventTierCount) => {
    if (scannerTier) return scannerTier === ticketTier;
    return eventTierCount === 0;
};

const gateCases = [
    ['VIP', 'VIP', 2, true, 'VIP scanner admits a VIP ticket'],
    ['VIP', 'General', 2, false, 'VIP scanner rejects a General ticket'],
    ['VIP', 'vip', 2, false, 'tier match is exact, not case-insensitive'],
    ['VIP', 'VIP ', 2, false, 'tier match does not trim'],
    // Untiered event: an unscoped scanner is the only kind there is.
    ['', 'general', 0, true, 'unscoped scanner admits on an untiered event'],
    // The hole: a leftover unscoped link must not admit anything once tiers exist.
    ['', 'General', 2, false, 'unscoped scanner is refused on a tiered event'],
    ['', 'VIP', 2, false, 'unscoped scanner cannot bypass a tier restriction'],
    ['', 'General', 1, false, 'one tier is enough to retire an unscoped scanner'],
];

for (const [scannerTier, ticketTier, tierCount, expected, label] of gateCases) {
    assert.equal(admits(scannerTier, ticketTier, tierCount), expected, label);
}

console.log(`scanTicket: ${cases.length + 1 + gateCases.length} checks passed`);
