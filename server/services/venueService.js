const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const VenueReview = require('../models/VenueReview');
const { citySlug } = require('../utils/citySlug');
const { escapeRegex } = require('../utils/escapeRegex');

const DEFAULT_CANCELLATION_POLICY = {
    freeCancellationHours: 48,
    partialRefundPercentage: 50,
    noCancellationHours: 24
};

const venueService = {
    // Get all venues
    async getAllVenues(query = {}) {
        const { page = 1, limit = 10, status, city, sort, search, owner, venueType, minCapacity, maxCapacity, minPrice, maxPrice } = query;
        const filter = { isDeleted: { $ne: true } }; // Always exclude deleted venues

        // If querying by owner (dashboard), allow all statuses but exclude deleted
        // Otherwise, only show approved and active venues (public listing)
        if (owner) {
            filter.owner = owner;
            if (status) filter.status = status;
        } else {
            // Public listing - only approved and active venues
            filter.status = status || 'approved';
            filter.isActive = true;
        }

        // Matched on the canonical slug, not the display name. This used to be an
        // unanchored RegExp(city, 'i'), which had two faults: "Goa" also matched
        // "North Goa" (and "Kota" matched "Kotagiri"), and the caller's string went
        // into a regex unescaped, so a crafted city was a ReDoS lever on a public
        // endpoint. An indexed equality match has neither problem, and it survives
        // the geocoder spelling a city differently next month.
        if (city && city !== 'All') filter['address.citySlug'] = citySlug(city);


        // Venue type filter
        if (venueType && venueType !== 'all') {
            filter.venueType = venueType;
        }

        // Capacity range filter
        if (minCapacity || maxCapacity) {
            filter['capacity.max'] = {};
            if (minCapacity) filter['capacity.max'].$gte = parseInt(minCapacity);
            if (maxCapacity) filter['capacity.max'].$lte = parseInt(maxCapacity);
        }

        // Price range filter
        if (minPrice || maxPrice) {
            filter['pricing.basePrice'] = {};
            if (minPrice) filter['pricing.basePrice'].$gte = parseInt(minPrice);
            if (maxPrice) filter['pricing.basePrice'].$lte = parseInt(maxPrice);
        }

        if (search) {
            const term = new RegExp(escapeRegex(search), 'i');
            filter.$or = [
                { name: term },
                { description: term }
            ];
        }

        // Sorting options
        let sortOption = { createdAt: -1 }; // default: latest
        if (sort === 'topRated') sortOption = { 'rating.average': -1 };
        else if (sort === 'inDemand') sortOption = { 'rating.count': -1 };
        else if (sort === 'latest') sortOption = { createdAt: -1 };
        else if (sort === 'priceAsc') sortOption = { 'pricing.basePrice': 1 };
        else if (sort === 'priceDesc') sortOption = { 'pricing.basePrice': -1 };

        const venues = await Venue.find(filter)
            .populate('owner', 'name email')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort(sortOption)
            .lean();

        const total = await Venue.countDocuments(filter);

        return {
            venues,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total
        };
    },

    // Get venues by owner (for venue owner dashboard)
    async getVenuesByOwner(ownerId) {
        const venues = await Venue.find({ 
            owner: ownerId, 
            isDeleted: { $ne: true } 
        }).sort({ createdAt: -1 }).lean();
        return venues;
    },

    // Get nearby venues
    async getNearbyVenues(lat, lng, radius = 10000) {
        const venues = await Venue.find({
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: parseInt(radius)
                }
            },
            status: 'approved',
            isActive: true,
            isDeleted: { $ne: true }
        }).populate('owner', 'name email').lean();

        return venues;
    },

    // Get venue by ID
    async getVenueById(id) {
        const venue = await Venue.findById(id).populate('owner', 'name email avatar').lean();
        if (!venue) {
            throw new Error('Venue not found');
        }
        return venue;
    },

    // Create venue
    async createVenue(data) {
        // Trust boundary: payoutAccount comes from the client through a
        // .passthrough() body schema, so verify it is one of this owner's own saved
        // accounts before storing it. Anything else becomes null = use my default.
        const { sanitizePayoutAccount } = require('../utils/payoutAccount');
        const venue = await Venue.create({
            ...data,
            payoutAccount: await sanitizePayoutAccount(data.owner, data.payoutAccount),
        });
        return venue;
    },

    // Fields an owner must never set through a normal venue update. Stripping
    // them here - in the single shared update path, not per-route - closes a
    // mass-assignment hole: without it a venue owner could PUT { status:
    // 'approved' } to self-approve (bypassing admin review), forge
    // rating/isVerified, or reassign `owner` to steal/dump a venue. Status is
    // changed only via adminService; soft-delete only via deleteVenue.
    PROTECTED_VENUE_FIELDS: ['status', 'isVerified', 'isDeleted', 'deletedAt', 'owner', 'rating', '_id', 'createdAt', 'updatedAt'],

    // Pure: return a copy of an update payload with owner-protected fields
    // removed. Kept separate so it is unit-testable without a DB round-trip.
    stripProtectedFields(updateData = {}) {
        const safe = { ...updateData };
        for (const field of venueService.PROTECTED_VENUE_FIELDS) delete safe[field];
        return safe;
    },

    // Update venue
    async updateVenue(id, updateData) {
        const safe = venueService.stripProtectedFields(updateData);

        // Same trust boundary as createVenue. payoutAccount is deliberately not in
        // PROTECTED_VENUE_FIELDS - an owner may move their own earnings to another of
        // their own accounts - but the id still arrives through a .passthrough()
        // schema, so it has to be checked against their saved accounts here too.
        // The edit form sends this field on every save, so create-only checking left
        // the update path able to store a foreign id.
        if ('payoutAccount' in safe) {
            const { sanitizePayoutAccount } = require('../utils/payoutAccount');
            const existing = await Venue.findById(id).select('owner').lean();
            if (!existing) throw new Error('Venue not found');
            safe.payoutAccount = await sanitizePayoutAccount(existing.owner, safe.payoutAccount);
        }

        const venue = await Venue.findByIdAndUpdate(
            id,
            { $set: safe },
            { new: true }
        );
        if (!venue) {
            throw new Error('Venue not found');
        }
        return venue;
    },

    // Delete venue (soft delete)
    async deleteVenue(id) {
        const venue = await Venue.findByIdAndUpdate(
            id,
            {
                $set: {
                    isDeleted: true,
                    deletedAt: new Date(),
                    isActive: false
                }
            },
            { new: true }
        );
        if (!venue) {
            throw new Error('Venue not found');
        }
        return { message: 'Venue deleted successfully', venue };
    },

    // Update availability
    async updateAvailability(id, availability) {
        const venue = await Venue.findByIdAndUpdate(
            id,
            { $set: { availability } },
            { new: true }
        );
        if (!venue) {
            throw new Error('Venue not found');
        }
        return venue;
    },

    // Submit a venue review (Req 14.1, 14.2, 14.4, 14.5)
    async submitReview(userId, venueId, rating, comment) {
        // 1. Check that user has a completed booking at this venue
        const completedBooking = await Booking.findOne({
            user: userId,
            venue: venueId,
            status: 'completed'
        });
        if (!completedBooking) {
            const err = new Error('You must complete a booking before reviewing');
            err.status = 403;
            throw err;
        }

        // 2. Create review — unique index { user, venue } rejects duplicates
        let review;
        try {
            review = await VenueReview.create({ user: userId, venue: venueId, rating, comment });
        } catch (err) {
            if (err.code === 11000) {
                const dupErr = new Error('A review has already been submitted for this venue');
                dupErr.status = 409;
                throw dupErr;
            }
            throw err;
        }

        // 3. Recalculate venue rating
        const venue = await Venue.findById(venueId);
        const currentAverage = (venue.rating && venue.rating.average) || 0;
        const currentCount = (venue.rating && venue.rating.count) || 0;
        const newAverage = (currentAverage * currentCount + rating) / (currentCount + 1);
        const newCount = currentCount + 1;

        await Venue.findByIdAndUpdate(venueId, {
            $set: { 'rating.average': newAverage, 'rating.count': newCount }
        });

        return review;
    },

    // Validate cancellation policy constraints
    validateCancellationPolicy(policy) {
        const { freeCancellationHours, noCancellationHours } = policy;
        if (noCancellationHours >= freeCancellationHours) {
            throw new Error('noCancellationHours must be less than freeCancellationHours');
        }
    },

    // Process a booking cancellation according to venue cancellation policy
    async processCancellation(bookingId, userId) {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Booking not found');
        }

        const venue = await Venue.findById(booking.venue);
        if (!venue) {
            throw new Error('Venue not found');
        }

        // Use venue's cancellationPolicy or defaults
        const policy = venue.cancellationPolicy && venue.cancellationPolicy.freeCancellationHours
            ? venue.cancellationPolicy
            : DEFAULT_CANCELLATION_POLICY;

        const { freeCancellationHours, partialRefundPercentage, noCancellationHours } = policy;

        // Calculate hours remaining until booking start
        const bookingDate = new Date(booking.bookingDate);
        const [hours, minutes] = booking.startTime.split(':').map(Number);
        bookingDate.setHours(hours, minutes, 0, 0);

        const now = new Date();
        const hoursRemaining = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        // Apply policy tiers
        if (hoursRemaining <= noCancellationHours) {
            throw new Error('Cancellation window has passed');
        }

        let result;
        if (hoursRemaining > freeCancellationHours) {
            result = { refundType: 'full', refundPercentage: 100 };
        } else {
            // noCancellationHours < hoursRemaining <= freeCancellationHours
            result = { refundType: 'partial', refundPercentage: partialRefundPercentage };
        }

        // Update booking status to cancelled
        await Booking.findByIdAndUpdate(bookingId, { $set: { status: 'cancelled' } });

        return result;
    }
};

module.exports = venueService;
