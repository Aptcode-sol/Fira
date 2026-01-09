const Venue = require('../models/Venue');

const venueService = {
    // Get all venues
    async getAllVenues(query = {}) {
        const { page = 1, limit = 10, status, city, sort, search, owner } = query;
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

        if (city && city !== 'All') filter['address.city'] = new RegExp(city, 'i');
        if (search) {
            filter.$or = [
                { name: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
        }

        // Sorting options
        let sortOption = { createdAt: -1 }; // default: latest
        if (sort === 'topRated') sortOption = { 'rating.average': -1 };
        else if (sort === 'inDemand') sortOption = { 'rating.count': -1 };
        else if (sort === 'latest') sortOption = { createdAt: -1 };

        const venues = await Venue.find(filter)
            .populate('owner', 'name email')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort(sortOption);

        const total = await Venue.countDocuments(filter);

        return {
            venues,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total
        };
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
        }).populate('owner', 'name email');

        return venues;
    },

    // Get venue by ID
    async getVenueById(id) {
        const venue = await Venue.findById(id).populate('owner', 'name email avatar');
        if (!venue) {
            throw new Error('Venue not found');
        }
        return venue;
    },

    // Create venue
    async createVenue(data) {
        const venue = await Venue.create(data);
        return venue;
    },

    // Update venue
    async updateVenue(id, updateData) {
        const venue = await Venue.findByIdAndUpdate(
            id,
            { $set: updateData },
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

    // Update status (admin)
    async updateStatus(id, status) {
        const venue = await Venue.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true }
        );
        if (!venue) {
            throw new Error('Venue not found');
        }
        return venue;
    }
};

module.exports = venueService;
