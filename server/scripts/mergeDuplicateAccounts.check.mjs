// ponytail self-check for mergeDuplicateAccounts (Flow 7 migration).
// No test framework, no fixtures — spins up mongodb-memory-server (a dev dep),
// seeds a duplicate normal+owner pair sharing an email, runs the merge TWICE,
// and asserts: one surviving account, roles union present, venues/events
// repointed, no data loss, and the second run is a no-op (idempotent).
//
// Run directly:      node server/scripts/mergeDuplicateAccounts.check.mjs
// Or via the script: node server/scripts/mergeDuplicateAccounts.js --self-check
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

const require = createRequire(import.meta.url);
const User = require('../models/User');
const Venue = require('../models/Venue');
const Event = require('../models/Event');
const { mergeDuplicateAccounts } = require('./mergeDuplicateAccounts.js');

async function main() {
    // The live schema has a unique index on email — which is WHY exact
    // duplicates can't be created today. The historical duplicates this
    // migration cleans up predate that constraint, so skip auto-indexing in this
    // in-memory DB to seed the dirty state the script must repair.
    mongoose.set('autoIndex', false);

    const mem = await MongoMemoryServer.create();
    await mongoose.connect(mem.getUri());

    try {
        // --- seed a duplicate pair for the same person -----------------------
        const email = 'Person@Example.com'; // mixed case → email-keyed match is case-insensitive
        const normal = await User.create({
            email, password: 'x', name: 'Person (user)', role: 'user', roles: ['user'],
        });
        const owner = await User.create({
            // same email but stored lowercased by schema; still the same key
            email, password: 'x', name: 'Person (owner)', role: 'venue_owner', roles: ['venue_owner'],
            bankDetails: { accountName: 'Person', accountNumber: '123456789', ifscCode: 'HDFC0001234', bankName: 'HDFC' },
        });

        // owner's venue + event that must survive and be repointed onto the survivor
        const venue = await Venue.create({
            owner: owner._id, name: 'V', description: 'd',
            capacity: { max: 10 }, pricing: { basePrice: 100 },
            location: { coordinates: [77, 12] },
            address: { street: 's', city: 'c', state: 'st', pincode: '000000' },
        });
        const event = await Event.create({
            organizer: owner._id, name: 'E', description: 'd',
            startDateTime: new Date(Date.now() + 86400000),
            endDateTime: new Date(Date.now() + 90000000),
            maxAttendees: 10,
        });

        // --- run 1: apply the merge -----------------------------------------
        const report1 = await mergeDuplicateAccounts({ User, Venue, Event, apply: true });
        assert.equal(report1.length, 1, 'exactly one duplicate group merged on first run');

        const afterUsers = await User.find({ email: email.toLowerCase() }).lean();
        assert.equal(afterUsers.length, 1, 'exactly one surviving account for the email');

        const survivor = afterUsers[0];
        // survivor is the owner account (owner beats user per design ceiling)
        assert.equal(String(survivor._id), String(owner._id), 'owner account survives');
        // roles union carries BOTH roles
        assert.deepEqual([...survivor.roles].sort(), ['user', 'venue_owner'], 'roles union present');
        // owner-critical data preserved (no data loss)
        assert.equal(survivor.bankDetails.accountNumber, '123456789', 'bankDetails preserved on survivor');

        // venue/event repointed onto the survivor, and still exist (no data loss)
        const v = await Venue.findById(venue._id).lean();
        const e = await Event.findById(event._id).lean();
        assert.ok(v && e, 'venue and event still exist');
        assert.equal(String(v.owner), String(survivor._id), 'venue owner repointed to survivor');
        assert.equal(String(e.organizer), String(survivor._id), 'event organizer repointed to survivor');

        // the merged-away normal account is gone
        const gone = await User.findById(normal._id).lean();
        assert.equal(gone, null, 'merged-away account deleted');

        // --- run 2: idempotent — must be a no-op ----------------------------
        const report2 = await mergeDuplicateAccounts({ User, Venue, Event, apply: true });
        assert.equal(report2.length, 0, 'second run merges nothing (idempotent)');

        const afterUsers2 = await User.find({ email: email.toLowerCase() }).lean();
        assert.equal(afterUsers2.length, 1, 'still exactly one account after re-run');
        assert.deepEqual([...afterUsers2[0].roles].sort(), ['user', 'venue_owner'], 'roles unchanged on re-run');
        const v2 = await Venue.findById(venue._id).lean();
        const e2 = await Event.findById(event._id).lean();
        assert.equal(String(v2.owner), String(survivor._id), 'venue still repointed after re-run');
        assert.equal(String(e2.organizer), String(survivor._id), 'event still repointed after re-run');

        console.log('mergeDuplicateAccounts self-check: all assertions passed');
    } finally {
        await mongoose.disconnect();
        await mem.stop();
    }
}

main().catch(err => {
    console.error('mergeDuplicateAccounts self-check FAILED:', err);
    process.exit(1);
});
