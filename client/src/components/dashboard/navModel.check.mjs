/**
 * Runnable check for sidebar nav composition.
 * Run: node src/components/dashboard/navModel.check.mjs
 *
 * The smallest thing that fails if the consolidation regresses. It imports the
 * real model rather than restating it, so re-adding a grouped section or a second
 * /dashboard/venues link fails here instead of in a browser.
 */
import assert from 'node:assert/strict';
import { userNavItems, venueNavItems, sidebarFooterItems } from './navModel.mjs';

const labels = (items) => items.map((i) => i.label);
const hrefs = (items) => items.map((i) => i.href);

// --- My Events is promoted, not sectioned ----------------------------------
const userLabels = labels(userNavItems);
assert.equal(
    userLabels.indexOf('My Events') - userLabels.indexOf('My Tickets'),
    1,
    'My Events must sit directly after My Tickets'
);
assert.equal(
    userNavItems.filter((i) => i.href === '/dashboard/events').length,
    1,
    'exactly one link to /dashboard/events - it was rendered twice before'
);

// --- the grouped sections are gone ----------------------------------------
for (const [name, items] of [['user', userNavItems], ['venue', venueNavItems]]) {
    for (const gone of ['Events Management', 'Venue Management']) {
        assert.ok(
            !labels(items).includes(gone),
            `${name} sidebar must not contain a "${gone}" section`
        );
    }
}

// --- venue destinations live only in the venue portal ----------------------
assert.ok(
    !hrefs(userNavItems).includes('/dashboard/venues'),
    'user sidebar must not link to /dashboard/venues'
);
assert.ok(
    !hrefs(userNavItems).includes('/dashboard/requests'),
    'user sidebar must not link to /dashboard/requests'
);

// --- both footers end Settings -> sign out --------------------------------
for (const portal of ['user', 'venue']) {
    const footer = sidebarFooterItems(/** @type {'user' | 'venue'} */(portal));
    assert.equal(footer.length, 2, `${portal} footer holds Settings and sign-out`);
    assert.equal(footer[0].label, 'Settings', `${portal} footer starts with Settings`);
    assert.equal(footer[1].action, 'sign-out', `${portal} footer ends with the sign-out control`);
}
assert.equal(sidebarFooterItems('user')[0].href, '/dashboard/settings');
assert.equal(sidebarFooterItems('venue')[0].href, '/venue-portal/settings');

// Both dashboards present the same footer. The settings destination is the only
// thing allowed to differ - labels drifting ("Logout" vs "Sign Out") is what made
// the two shells feel like separate products.
assert.deepEqual(
    labels(sidebarFooterItems('user')),
    labels(sidebarFooterItems('venue')),
    'footer wording must be identical in both portals'
);

// Settings is footer-only: leaving it in the scrolling zone too would scroll it
// away from the position both sidebars now pin it to.
for (const [name, items] of [['user', userNavItems], ['venue', venueNavItems]]) {
    assert.ok(
        !labels(items).includes('Settings'),
        `${name} scrolling zone must not repeat the pinned Settings item`
    );
}

// --- surviving destinations ------------------------------------------------
for (const required of ['Overview', 'My Bookings', 'My Tickets', 'Earnings', 'Policies']) {
    assert.ok(userLabels.includes(required), `user sidebar keeps ${required}`);
}
for (const required of ['Dashboard', 'My Venues', 'Bookings', 'Event Requests', 'Analytics', 'Earnings']) {
    assert.ok(labels(venueNavItems).includes(required), `venue sidebar keeps ${required}`);
}

// Every nav item is reachable and labelled.
for (const item of [...userNavItems, ...venueNavItems]) {
    assert.ok(item.href && item.href.startsWith('/'), `${item.label} needs an absolute href`);
    assert.ok(item.icon, `${item.label} needs an icon name`);
}

console.log('navModel.check.mjs: all assertions passed');
