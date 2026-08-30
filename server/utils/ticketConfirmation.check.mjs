// Runnable self-check for the ticket confirmation email template.
//   node server/utils/ticketConfirmation.check.mjs
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const emailTemplates = require('./emailTemplates.js');

const ticket = {
    ticketId: 'TKT-9A3F21C0B4D5',
    qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    ticketType: 'VIP',
    quantity: 2,
    price: 4000
};

// A real venue-backed event, venue populated as purchaseTicket now does.
const venueEvent = {
    _id: '65f1a2b3c4d5e6f701234567',
    name: 'Sunburn Arena',
    startDateTime: new Date('2026-03-14T19:30:00Z'),
    endDateTime: new Date('2026-03-14T23:30:00Z'),
    images: ['https://cdn.fira.test/events/sunburn.jpg'],
    venue: { name: 'Phoenix Marketcity', address: { city: 'Bengaluru' } }
};

const html = emailTemplates.ticketConfirmation('Varshitha', venueEvent, ticket);

assert.ok(html.includes(ticket.ticketId), 'ticket id must be on the ticket');
assert.ok(html.includes('VIP'), 'the tier the buyer selected must be named');
assert.ok(html.includes('>Tier<'), 'the tier must be labelled Tier, not Type');
assert.ok(html.includes(`src="${ticket.qrCode}"`), 'the QR code must be the img src');
assert.ok(html.includes('Phoenix Marketcity'), 'populated venue name must render');

// The date/time must come from startDateTime - the schema has no `date`/`startTime`.
assert.ok(!html.includes('Invalid Date'), 'date must not render as Invalid Date');
assert.ok(!html.includes('undefined'), 'no field may render as undefined');
const expectedDate = venueEvent.startDateTime.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});
assert.ok(html.includes(expectedDate), `formatted date ${expectedDate} must render`);
assert.ok(
    html.includes(venueEvent.startDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })),
    'start time must render from startDateTime'
);

// Only ONE definition may survive: a duplicate key in the object literal silently
// shadowed the complete template with a gutted stub.
assert.ok(html.includes('View in Dashboard'), 'the CTA button must survive');

// customVenue event: no `venue` at all. Must not throw, must say something sensible.
const customEvent = {
    _id: '65f1a2b3c4d5e6f707654321',
    name: 'Rooftop Sundowner',
    startDateTime: new Date('2026-04-02T17:00:00Z'),
    images: [],
    customVenue: { isCustom: true, name: "Ananya's Terrace", address: '4th Cross, Indiranagar', city: 'Bengaluru' }
};
const customHtml = emailTemplates.ticketConfirmation('Ravi', customEvent, ticket);
assert.ok(customHtml.includes("Ananya's Terrace"), 'customVenue name must render');
assert.ok(!customHtml.includes('undefined'), 'customVenue event must not render undefined');

// Worst case: unpopulated ObjectId venue and no customVenue - still must not throw.
const bareEvent = {
    name: 'Open Mic',
    startDateTime: new Date('2026-05-01T12:00:00Z'),
    venue: '65f1a2b3c4d5e6f700000001'
};
const bareHtml = emailTemplates.ticketConfirmation('Sam', bareEvent, ticket);
assert.ok(bareHtml.includes('Venue to be announced'), 'unnamed venue must degrade to a placeholder');
assert.ok(!bareHtml.includes('Invalid Date'));

console.log('ticketConfirmation.check.mjs: all assertions passed');
