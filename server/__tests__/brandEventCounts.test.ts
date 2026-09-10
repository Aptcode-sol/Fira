/**
 * Regression check — creator/organizer cards must show a live events count.
 *
 * `getBrands` (Top Organizers, /brands, /creators list/section reads) used to
 * return the raw `stats.events` straight off the BrandProfile document. Nothing
 * ever increments that field - approving an event does not touch it - so every
 * card fed by a list endpoint read "0 Events" regardless of how many approved
 * events the creator actually had. `getBrandById` already computed this live;
 * the fix applies the same live count to `getBrands`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import './setup';

const brandService = require('../services/brandService');
const BrandProfile = require('../models/BrandProfile');
const Event = require('../models/Event');
require('../models/User'); // registers the 'User' model for .populate('user', ...)

async function makeUser(name: string) {
    const _id = new mongoose.Types.ObjectId();
    await mongoose.connection.db!.collection('users').insertOne({ _id, name, email: `${_id}@x.test` });
    return _id;
}

async function makeBrand(userId: mongoose.Types.ObjectId, over: Record<string, any> = {}) {
    return BrandProfile.create({
        user: userId,
        name: 'Chords Culture',
        type: 'organizer',
        bio: 'We throw parties',
        status: 'approved',
        isActive: true,
        stats: { followers: 3, events: 0, views: 0 }, // stale 0, as real data looks
        ...over,
    });
}

async function makeEvent(organizer: mongoose.Types.ObjectId, over: Record<string, any> = {}) {
    return Event.create({
        organizer,
        name: 'Test Night',
        description: 'desc',
        startDateTime: new Date('2020-01-01T18:00:00.000Z'), // past — must still count
        endDateTime: new Date('2020-01-01T22:00:00.000Z'),
        maxAttendees: 100,
        status: 'completed',
        ...over,
    });
}

describe('getBrands — live events count', () => {
    it('reports the real count instead of the stale stored 0, including past events', async () => {
        const owner = await makeUser('Chords Culture Owner');
        await makeBrand(owner);
        await makeEvent(owner); // completed/past
        await makeEvent(owner, { status: 'upcoming', startDateTime: new Date('2030-01-01'), endDateTime: new Date('2030-01-02') });

        const result = await brandService.getBrands({ sort: 'top', limit: '10' });
        const card = result.brands.find((b: any) => String(b.user?._id) === String(owner));

        expect(card.stats.events).toBe(2);
    });

    it('excludes rejected, pending and deleted events from the count', async () => {
        const owner = await makeUser('Another Owner');
        await makeBrand(owner, { name: 'Another Brand' });
        await makeEvent(owner, { status: 'rejected' });
        await makeEvent(owner, { status: 'pending' });
        await makeEvent(owner, { status: 'approved', isDeleted: true });
        await makeEvent(owner, { status: 'approved' }); // the one that should count

        const result = await brandService.getBrands({ sort: 'newest', limit: '10' });
        const card = result.brands.find((b: any) => String(b.user?._id) === String(owner));

        expect(card.stats.events).toBe(1);
    });

    it('reports 0, not a crash, for a brand whose owner has no events', async () => {
        const owner = await makeUser('Quiet Owner');
        await makeBrand(owner, { name: 'Quiet Brand' });

        const result = await brandService.getBrands({ sort: 'newest', limit: '10' });
        const card = result.brands.find((b: any) => String(b.user?._id) === String(owner));

        expect(card.stats.events).toBe(0);
    });

    it('getBrandById also returns the live count for a single profile', async () => {
        const owner = await makeUser('Solo Owner');
        const brand = await makeBrand(owner, { name: 'Solo Brand' });
        await makeEvent(owner, { status: 'ongoing', startDateTime: new Date(), endDateTime: new Date(Date.now() + 3600_000) });

        const result = await brandService.getBrandById(String(brand._id));
        expect(result.stats.events).toBe(1);
    });
});
