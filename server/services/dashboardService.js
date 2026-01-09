const Event = require('../models/Event');
const Venue = require('../models/Venue');
const Ticket = require('../models/Ticket');
const Booking = require('../models/Booking');
const BrandProfile = require('../models/BrandProfile');
const Notification = require('../models/Notification');

const dashboardService = {
    /**
     * Get comprehensive dashboard overview stats for a user
     * @param {string} userId - The user ID
     * @returns {Promise<Object>} Dashboard statistics
     */
    async getOverviewStats(userId) {
        const now = new Date();

        // Run all queries in parallel for better performance
        const [
            // Events organized by this user
            eventsOrganized,
            upcomingEventsOrganized,

            // Venues owned by this user
            venuesOwned,

            // Tickets purchased by this user
            userTickets,

            // Bookings made by this user
            userBookings,

            // Brand profile
            brandProfile,

            // Recent notifications
            recentNotifications,

            // Event statistics for organizer
            eventStats,
        ] = await Promise.all([
            // Total events organized
            Event.countDocuments({ organizer: userId, isDeleted: { $ne: true } }),

            // Upcoming events organized (not cancelled, date >= now)
            Event.countDocuments({
                organizer: userId,
                date: { $gte: now },
                status: { $ne: 'cancelled' },
                isDeleted: { $ne: true }
            }),

            // Venues owned
            Venue.countDocuments({ owner: userId, isDeleted: { $ne: true } }),

            // User's tickets
            Ticket.find({ user: userId })
                .populate({
                    path: 'event',
                    select: 'name date startTime endTime images status',
                    populate: { path: 'venue', select: 'name address' }
                })
                .sort({ createdAt: -1 })
                .lean(),

            // User's bookings
            Booking.find({ user: userId })
                .populate('venue', 'name images')
                .sort({ createdAt: -1 })
                .lean(),

            // Brand profile
            BrandProfile.findOne({ user: userId }).lean(),

            // Recent notifications (last 5)
            Notification.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),

            // Aggregate stats for events organized by user
            Event.aggregate([
                { $match: { organizer: userId, isDeleted: { $ne: true } } },
                {
                    $group: {
                        _id: null,
                        totalAttendees: { $sum: '$currentAttendees' },
                        totalCapacity: { $sum: '$maxAttendees' },
                        totalRevenue: {
                            $sum: {
                                $multiply: ['$ticketPrice', '$currentAttendees']
                            }
                        }
                    }
                }
            ])
        ]);

        // Process tickets
        const activeTickets = userTickets.filter(t => t.status === 'active');
        const upcomingTickets = activeTickets.filter(t =>
            t.event && new Date(t.event.date) >= now
        );

        // Process bookings
        const activeBookings = userBookings.filter(b =>
            ['pending', 'confirmed'].includes(b.status)
        );

        // Get upcoming events user is attending (from tickets)
        const upcomingEventsAttending = upcomingTickets.slice(0, 5).map(ticket => ({
            _id: ticket._id,
            ticketId: ticket._id,
            event: ticket.event,
            status: ticket.status,
            quantity: ticket.quantity,
            purchasedAt: ticket.createdAt
        }));

        // Get user's organized events (upcoming)
        const organizedEvents = await Event.find({
            organizer: userId,
            date: { $gte: now },
            status: { $ne: 'cancelled' },
            isDeleted: { $ne: true }
        })
            .populate('venue', 'name address images')
            .sort({ date: 1 })
            .limit(5)
            .lean();

        // Get user's venues
        const venues = await Venue.find({ owner: userId, isDeleted: { $ne: true } })
            .select('name images address status capacity pricing rating')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        // Calculate event statistics
        const eventStatistics = eventStats[0] || {
            totalAttendees: 0,
            totalCapacity: 0,
            totalRevenue: 0
        };

        return {
            // Overview stats
            stats: {
                eventsOrganizing: eventsOrganized,
                upcomingEventsOrganizing: upcomingEventsOrganized,
                eventsAttending: upcomingTickets.length,
                activeTickets: activeTickets.length,
                venuesOwned: venuesOwned,
                activeBookings: activeBookings.length,
                totalBookings: userBookings.length,
                totalAttendees: eventStatistics.totalAttendees,
                totalRevenue: eventStatistics.totalRevenue,
                hasBrandProfile: !!brandProfile
            },

            // Recent data
            recentActivity: recentNotifications.map(n => ({
                _id: n._id,
                title: n.title,
                message: n.message,
                category: n.category,
                isRead: n.isRead,
                createdAt: n.createdAt
            })),

            // Upcoming events attending
            upcomingEventsAttending,

            // Events user is organizing
            organizedEvents: organizedEvents.map(e => ({
                _id: e._id,
                name: e.name,
                date: e.date,
                startTime: e.startTime,
                endTime: e.endTime,
                images: e.images,
                venue: e.venue,
                currentAttendees: e.currentAttendees,
                maxAttendees: e.maxAttendees,
                ticketPrice: e.ticketPrice,
                status: e.status,
                isFeatured: e.isFeatured
            })),

            // User's venues
            venues,

            // Brand profile summary
            brandProfile: brandProfile ? {
                _id: brandProfile._id,
                name: brandProfile.name,
                type: brandProfile.type,
                profilePhoto: brandProfile.profilePhoto,
                followers: brandProfile.stats?.followers || 0,
                events: brandProfile.stats?.events || 0
            } : null
        };
    },

    /**
     * Get quick stats only (lighter endpoint)
     */
    async getQuickStats(userId) {
        const now = new Date();

        const [
            eventsOrganizing,
            activeTickets,
            venuesOwned,
            activeBookings
        ] = await Promise.all([
            Event.countDocuments({
                organizer: userId,
                date: { $gte: now },
                status: { $ne: 'cancelled' }
            }),
            Ticket.countDocuments({
                user: userId,
                status: 'active',
            }),
            Venue.countDocuments({ owner: userId }),
            Booking.countDocuments({
                user: userId,
                status: { $in: ['pending', 'confirmed'] }
            })
        ]);

        return {
            eventsOrganizing,
            activeTickets,
            venuesOwned,
            activeBookings
        };
    }
};

module.exports = dashboardService;
