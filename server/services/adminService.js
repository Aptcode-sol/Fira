const User = require('../models/User');
const Venue = require('../models/Venue');
const Event = require('../models/Event');
const BrandProfile = require('../models/BrandProfile');
const Ticket = require('../models/Ticket');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const { escapeRegex } = require('../utils/escapeRegex');

/** Case-insensitive "contains" match on a user-supplied search term. */
const searchRegex = (value) => new RegExp(escapeRegex(value), 'i');

const adminService = {
    // ================== DASHBOARD STATS ==================
    async getStats() {
        const [
            totalUsers,
            totalVenues,
            totalEvents,
            totalBrands,
            pendingVenues,
            pendingEvents,
            pendingBrands,
            blockedUsers,
            totalTickets,
            ticketRevenue,
            bookingRevenue
        ] = await Promise.all([
            User.countDocuments(),
            // Deleted listings are excluded here so the headline counts agree
            // with what the Venues/Events tables actually show.
            Venue.countDocuments({ isDeleted: { $ne: true } }),
            Event.countDocuments({ isDeleted: { $ne: true } }),
            BrandProfile.countDocuments(),
            Venue.countDocuments({ status: 'pending', isDeleted: { $ne: true } }),
            // Exclude venue-less events from the pending count (8.1). A genuinely
            // pending event that HAS a venue still counts (preservation 3.11).
            Event.countDocuments({ status: 'pending', venue: { $exists: true, $ne: null }, isDeleted: { $ne: true } }),
            BrandProfile.countDocuments({ status: 'pending' }),
            User.countDocuments({ isBlocked: true }),
            Ticket.countDocuments(),
            Ticket.aggregate([
                { $group: { _id: null, total: { $sum: '$price' } } }
            ]),
            // Venue booking revenue was missing from the dashboard headline:
            // totalRevenue only summed ticket prices, so venue bookings (which go
            // through Razorpay and record a Booking.totalAmount) were invisible.
            Booking.aggregate([
                { $match: { status: { $in: ['accepted', 'completed'] } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ])
        ]);

        const ticketRev = ticketRevenue[0]?.total || 0;
        const bookingRev = bookingRevenue[0]?.total || 0;

        return {
            totalUsers,
            totalVenues,
            totalEvents,
            totalBrands,
            pendingVenues,
            pendingEvents,
            pendingBrands,
            blockedUsers,
            totalTickets,
            totalRevenue: ticketRev + bookingRev,
            ticketRevenue: ticketRev,
            venueRevenue: bookingRev,
        };
    },

    // ================== USERS ==================
    async getAllUsers(query = {}) {
        const { page = 1, limit = 20, search, role, status } = query;
        const filter = {};

        if (search) {
            filter.$or = [
                { name: searchRegex(search) },
                { email: searchRegex(search) }
            ];
        }
        // `roles` is the source of truth (a user can be both user and venue_owner);
        // `role` is the legacy single field. Matching only `role` missed every
        // account whose second role is the one being filtered for.
        if (role && role !== 'all') {
            filter.$and = [...(filter.$and || []), { $or: [{ roles: role }, { role }] }];
        }
        if (status === 'blocked') filter.isBlocked = true;
        if (status === 'active') filter.isBlocked = { $ne: true };

        const users = await User.find(filter)
            .select('-password')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(filter);

        return {
            users,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total
        };
    },

    async getUserById(id) {
        const user = await User.findById(id).select('-password');
        if (!user) throw new Error('User not found');

        const tickets = await Ticket.find({ user: id }).populate('event', 'name date venue');
        const bookings = await Booking.find({ user: id }).populate('venue', 'name address');

        return {
            ...user.toObject(),
            tickets,
            bookings,
            stats: {
                totalTickets: tickets.length,
                totalBookings: bookings.length,
                totalSpent: tickets.reduce((sum, t) => sum + (t.price || 0), 0) + bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0)
            }
        };
    },

    // ================== AUDIT WRITER ==================

    /**
     * Map a new status value onto an audit action.
     *
     * Pure, so it is checkable without a database. 'update' is the honest answer for
     * a status the action enum has no word for (back to 'pending', an event moved to
     * 'cancelled'): the specific values live in metadata either way.
     */
    actionForStatus(status) {
        return ({
            approved: 'approve',
            rejected: 'reject',
            blocked: 'block',
            unblocked: 'unblock',
            active: 'unblock',
        })[String(status || '').toLowerCase()] || 'update';
    },

    /**
     * The single place an admin action is recorded.
     *
     * Every mutating operation on this service used to decide for itself whether to
     * write an AuditLog, and only four of nine did - deleteUser, deleteVenue,
     * deleteEvent and toggleFeatured. So approving an event, rejecting a venue,
     * approving a creator and blocking a user, the decisions the trail exists for,
     * left no record at all. Routing them all through one writer is what stops the
     * next operation added here from being invisible too.
     *
     * A failed audit write is logged, not thrown: the change it describes has already
     * been committed by the time we get here, so raising would report failure for an
     * action that actually took effect and invite a double-apply on retry.
     */
    async recordAdminAction({ adminUser, action, entityType, entityId, metadata = {} }) {
        if (!adminUser) {
            // Not fatal, but it means a route forgot to pass req.user._id and the
            // entry would be unattributable - which is the one thing an audit trail
            // cannot be missing.
            console.error(`AuditLog: no adminUser for ${action} on ${entityType} ${entityId}`);
            return null;
        }
        try {
            return await AuditLog.create({ adminUser, action, entityType, entityId, metadata });
        } catch (error) {
            console.error('AuditLog write failed:', error.message);
            return null;
        }
    },

    async blockUser(userId, adminUserId) {
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { isBlocked: true } },
            { new: true }
        ).select('-password');
        if (!user) throw new Error('User not found');

        await adminService.recordAdminAction({
            adminUser: adminUserId,
            action: 'block',
            entityType: 'user',
            entityId: userId,
            // The name and email are copied in rather than left to a join: the account
            // can later be deleted, and a trail of bare ids is not reviewable.
            metadata: { name: user.name, email: user.email, field: 'isBlocked', from: false, to: true },
        });
        return user;
    },

    async unblockUser(userId, adminUserId) {
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { isBlocked: false } },
            { new: true }
        ).select('-password');
        if (!user) throw new Error('User not found');

        await adminService.recordAdminAction({
            adminUser: adminUserId,
            action: 'unblock',
            entityType: 'user',
            entityId: userId,
            metadata: { name: user.name, email: user.email, field: 'isBlocked', from: true, to: false },
        });
        return user;
    },

    // Hard-delete a user account and everything they own. Reuses
    // userService.deleteAccount so the admin path and the self-service path
    // cascade over exactly the same collections — one cascade to maintain.
    // Two guards, both to prevent an irreversible loss of access: an admin
    // cannot delete themselves, and no admin account can be deleted from the
    // dashboard at all (remove the admin role first, then delete).
    // Pure guard, exported so it can be checked without a database.
    // Returns null when the delete is allowed, else { status, message }.
    userDeleteBlockReason(target, userId, adminUserId) {
        if (String(userId) === String(adminUserId)) {
            return { status: 400, message: 'You cannot delete your own account' };
        }
        const targetIsAdmin = target.role === 'admin'
            || (Array.isArray(target.roles) && target.roles.includes('admin'));
        if (targetIsAdmin) {
            return { status: 403, message: 'Admin accounts cannot be deleted. Remove the admin role first.' };
        }
        return null;
    },

    async deleteUser(userId, adminUserId) {
        const target = await User.findById(userId).select('role roles');
        if (!target) throw new Error('User not found');

        const blocked = this.userDeleteBlockReason(target, userId, adminUserId);
        if (blocked) throw Object.assign(new Error(blocked.message), { status: blocked.status });

        // Name/email captured before the cascade - after it there is no account left
        // to join against, so an id-only entry would be permanently unreadable.
        const named = await User.findById(userId).select('name email').lean();
        const result = await require('./userService').deleteAccount(userId);
        await adminService.recordAdminAction({
            adminUser: adminUserId,
            action: 'delete',
            entityType: 'user',
            entityId: userId,
            metadata: { name: named?.name, email: named?.email },
        });
        return result;
    },

    // ================== VENUES ==================
    async getVenues(query = {}) {
        const { page = 1, limit = 20, search, status } = query;
        // Soft-deleted venues are gone as far as the dashboard is concerned;
        // the audit trail is the record that they existed.
        const filter = { isDeleted: { $ne: true } };

        if (search) {
            filter.$or = [
                { name: searchRegex(search) },
                { 'address.city': searchRegex(search) }
            ];
        }
        if (status && status !== 'all') filter.status = status;

        const venues = await Venue.find(filter)
            .populate('owner', 'name email')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Venue.countDocuments(filter);

        return {
            venues,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total
        };
    },

    // Venue owners with their venues + bank details (admin-only read — this
    // router is gated behind adminAuth, so surfacing bankDetails here is safe).
    // Flow 8.6: list venue owners, expandable to their venues, with the owner's
    // stored payout bank details visible to admins.
    async getVenueOwners(query = {}) {
        const { search } = query;

        // Group venues by owner so we don't fan out one query per owner.
        const venues = await Venue.find({ isDeleted: { $ne: true } })
            .select('name status address capacity owner createdAt')
            .sort({ createdAt: -1 });

        const ownerIds = [...new Set(venues.map((v) => String(v.owner)).filter(Boolean))];
        if (ownerIds.length === 0) return { owners: [] };

        const ownerFilter = { _id: { $in: ownerIds } };
        if (search) {
            ownerFilter.$or = [
                { name: searchRegex(search) },
                { email: searchRegex(search) }
            ];
        }

        // bankDetails is intentionally selected — admin-only read (Flow 8.6).
        const owners = await User.find(ownerFilter)
            .select('name email phone role roles adminRole bankDetails');

        const venuesByOwner = venues.reduce((acc, v) => {
            const key = String(v.owner);
            (acc[key] = acc[key] || []).push(v);
            return acc;
        }, {});

        return {
            owners: owners.map((o) => ({
                ...o.toObject(),
                venues: venuesByOwner[String(o._id)] || []
            }))
        };
    },

    async getVenueById(id) {
        const venue = await Venue.findById(id).populate('owner', 'name email phone bankDetails');
        if (!venue) throw new Error('Venue not found');

        // Get booking stats
        const bookings = await Booking.find({ venue: id });
        const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

        return {
            ...venue.toObject(),
            stats: {
                totalBookings: bookings.length,
                totalRevenue,
                completedBookings: bookings.filter(b => b.status === 'completed').length
            }
        };
    },

    async updateVenueStatus(venueId, status, adminUserId) {
        // Read the old status first so the trail can show what changed, not just what
        // it ended up as. "approved" on its own does not tell a reviewer whether this
        // was a first approval or a reversal of a rejection.
        const before = await Venue.findById(venueId).select('status name').lean();
        if (!before) throw new Error('Venue not found');

        const venue = await Venue.findByIdAndUpdate(
            venueId,
            { $set: { status } },
            { new: true }
        );
        if (!venue) throw new Error('Venue not found');

        await adminService.recordAdminAction({
            adminUser: adminUserId,
            action: adminService.actionForStatus(status),
            entityType: 'venue',
            entityId: venueId,
            metadata: { name: before.name, field: 'status', from: before.status, to: status },
        });
        return venue;
    },

    // Delist a venue. Reuses the owner-facing soft delete (isDeleted +
    // isActive:false) so bookings, payouts and reconciliation figures stay
    // queryable — a hard delete here would silently break earnings totals.
    async deleteVenue(venueId, adminUserId) {
        const named = await Venue.findById(venueId).select('name').lean();
        const result = await require('./venueService').deleteVenue(venueId);
        await adminService.recordAdminAction({
            adminUser: adminUserId,
            action: 'delete',
            entityType: 'venue',
            entityId: venueId,
            metadata: { name: named?.name },
        });
        return result;
    },

    // ================== EVENTS ==================
    async getEvents(query = {}) {
        const { page = 1, limit = 20, search, status, eventType } = query;
        // Same rule as getVenues: deleted listings drop out of the dashboard.
        const filter = { isDeleted: { $ne: true } };

        if (search) {
            const matchingVenues = await Venue.find({
                $or: [
                    { name: searchRegex(search) },
                    { 'address.city': searchRegex(search) }
                ]
            }).select('_id');

            filter.$or = [
                { name: searchRegex(search) },
                { 'customVenue.city': searchRegex(search) },
                { 'customVenue.name': searchRegex(search) },
                { venue: { $in: matchingVenues.map(v => v._id) } }
            ];
        }
        if (status && status !== 'all') filter.status = status;
        if (eventType && (eventType === 'public' || eventType === 'private')) {
            filter.eventType = eventType;
        }

        const events = await Event.find(filter)
            .populate('organizer', 'name email')
            .populate('venue', 'name address')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Event.countDocuments(filter);

        return {
            events,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total
        };
    },

    async getEventById(id) {
        // organizer bankDetails is an admin-only read (Flow 8.6) — this service
        // is only reachable through the adminAuth-gated router.
        const event = await Event.findById(id)
            .populate('organizer', 'name email phone bankDetails')
            .populate('venue', 'name address');
        if (!event) throw new Error('Event not found');

        // Get ticket stats
        const tickets = await Ticket.find({ event: id }).populate('user', 'name email phone');
        const totalRevenue = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
        const ticketsSold = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);

        return {
            ...event.toObject(),
            tickets,
            stats: {
                ticketsSold,
                totalRevenue,
                totalBookings: tickets.length
            }
        };
    },

    async updateEventStatus(eventId, status, adminUserId) {
        const before = await Event.findById(eventId).select('status name').lean();
        if (!before) throw new Error('Event not found');

        const event = await Event.findByIdAndUpdate(
            eventId,
            { $set: { status } },
            { new: true }
        );
        if (!event) throw new Error('Event not found');

        await adminService.recordAdminAction({
            adminUser: adminUserId,
            action: adminService.actionForStatus(status),
            entityType: 'event',
            entityId: eventId,
            metadata: { name: before.name, field: 'status', from: before.status, to: status },
        });
        return event;
    },

    // Delist an event. Same reasoning as deleteVenue: soft delete via the
    // existing organizer-facing path keeps tickets and revenue queryable.
    // Refunds are NOT triggered here — use the cancel flow for that.
    async deleteEvent(eventId, adminUserId) {
        const named = await Event.findById(eventId).select('name').lean();
        const result = await require('./eventService').deleteEvent(eventId);
        await adminService.recordAdminAction({
            adminUser: adminUserId,
            action: 'delete',
            entityType: 'event',
            entityId: eventId,
            metadata: { name: named?.name },
        });
        return result;
    },

    async toggleFeatured(eventId, isFeatured, adminUserId) {
        const event = await Event.findById(eventId);
        if (!event) throw new Error('Event not found');

        if (!['approved', 'upcoming'].includes(event.status)) {
            throw new Error('Event must be in approved or upcoming status to be featured');
        }

        const was = Boolean(event.isFeatured);
        event.isFeatured = isFeatured;
        await event.save();

        await adminService.recordAdminAction({
            adminUser: adminUserId,
            action: isFeatured ? 'feature' : 'unfeature',
            entityType: 'event',
            entityId: eventId,
            metadata: { name: event.name, field: 'isFeatured', from: was, to: Boolean(isFeatured) },
        });

        return event;
    },

    // ================== BRANDS ==================
    async getBrands(query = {}) {
        const { page = 1, limit = 20, search, status } = query;
        const filter = {};

        if (search) {
            filter.name = searchRegex(search);
        }
        if (status && status !== 'all') filter.status = status;

        const brands = await BrandProfile.find(filter)
            .populate('user', 'name email')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort({ createdAt: -1 })
            .lean();

        const total = await BrandProfile.countDocuments(filter);

        // Live events count per brand, batched into ONE aggregation keyed by
        // organiser rather than a count per row. stats.events on the document is
        // never maintained (approving an event does not bump it), so the admin
        // list read 0 for everyone; this reflects the real number.
        const ownerIds = brands.map(b => b.user?._id).filter(Boolean);
        const counts = ownerIds.length
            ? await Event.aggregate([
                {
                    $match: {
                        organizer: { $in: ownerIds },
                        isDeleted: { $ne: true },
                        status: { $in: ['approved', 'upcoming', 'ongoing', 'completed'] },
                    },
                },
                { $group: { _id: '$organizer', count: { $sum: 1 } } },
            ])
            : [];
        const countByOwner = new Map(counts.map(c => [String(c._id), c.count]));

        const shaped = brands.map(b => ({
            ...b,
            // Flattened aliases the admin table reads directly, so the column does
            // not have to reach through `.user`/`.stats` (and previously read the
            // wrong field names, showing N/A and 0).
            owner: b.user,
            followersCount: b.stats?.followers || 0,
            eventsCount: countByOwner.get(String(b.user?._id)) || 0,
        }));

        return {
            brands: shaped,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total
        };
    },

    async getBrandById(id) {
        const brand = await BrandProfile.findById(id).populate('user', 'name email phone');
        if (!brand) throw new Error('Brand not found');

        // Get events hosted by this brand's user
        const events = await Event.find({ organizer: brand.user._id })
            .populate('venue', 'name')
            // startDateTime, not `date`: no such path on the schema, so this sort did
            // nothing and "latest events" was arbitrary.
            .sort({ startDateTime: -1 })
            .limit(10);

        // Get revenue from events
        const eventIds = events.map(e => e._id);
        const ticketRevenue = await Ticket.aggregate([
            { $match: { event: { $in: eventIds } } },
            { $group: { _id: null, total: { $sum: '$price' } } }
        ]);

        return {
            ...brand.toObject(),
            events,
            stats: {
                eventsHosted: events.length,
                totalRevenue: ticketRevenue[0]?.total || 0
            }
        };
    },

    /**
     * Approve, reject or block a creator profile - and move the account's badge with it.
     *
     * This only wrote BrandProfile.status before, while brandService granted
     * `verificationBadge` at profile-creation time. So the badge every creator feature
     * reads was handed out on application and this decision changed nothing about it:
     * approving was a no-op and rejecting left the applicant still badged as verified.
     *
     * Granting on approval and clearing on anything else makes this the single place
     * creator verification is decided.
     */
    async updateBrandStatus(brandId, status, adminUserId) {
        const before = await BrandProfile.findById(brandId).select('status name').lean();
        if (!before) throw new Error('Brand not found');

        const brand = await BrandProfile.findByIdAndUpdate(
            brandId,
            { $set: { status } },
            { new: true }
        );
        if (!brand) throw new Error('Brand not found');

        // Mirrors brandService's mapping: a profile has ten types, the badge
        // distinguishes three, and anything not a band or organiser is a 'brand'.
        const badgeForBrandType = (type) =>
            ({ band: 'band', organizer: 'organizer' })[String(type || '').toLowerCase()] || 'brand';

        if (brand.user) {
            await User.findByIdAndUpdate(brand.user, {
                $set:
                    status === 'approved'
                        ? { verificationBadge: badgeForBrandType(brand.type), isVerified: true }
                        // Rejected, blocked or back to pending: the account is not a
                        // verified creator, so the badge must go with it.
                        : { verificationBadge: 'none', isVerified: false },
            });
        }

        await adminService.recordAdminAction({
            adminUser: adminUserId,
            action: adminService.actionForStatus(status),
            entityType: 'creator',
            entityId: brandId,
            // badgeChanged records the side effect, which is the part an account holder
            // will ask about: this decision also grants or removes their verified tick.
            metadata: {
                name: before.name,
                field: 'status',
                from: before.status,
                to: status,
                badgeChanged: (before.status === 'approved') !== (status === 'approved'),
            },
        });

        return brand;
    },

    /**
     * Hard-delete a creator profile so its owner can apply fresh.
     *
     * This is the escape hatch for "reset this account's creator identity", so it
     * has to undo everything applying created, or the user lands back in the dead
     * end the /create/creator guard describes: a profile they can no longer see but
     * that still blocks a new application.
     *
     *   - The BrandProfile document itself.
     *   - The owner's badge and verified flag. updateBrandStatus grants these on
     *     approval; nothing else clears them, so a delete that skipped this would
     *     leave a verified account with no profile behind the tick.
     *   - The brand's posts. Post.brand is a hard ref; orphaned posts would 500 any
     *     feed that populates it.
     *   - The brand from every follower's followingBrands array, so no user carries
     *     a dangling follow to a profile that no longer exists.
     *
     * Events the owner organised are deliberately left alone: they belong to the
     * user account, not the brand profile, and deleting a brand should not cancel
     * live events and refund ticket holders as a side effect.
     */
    async deleteBrand(brandId, adminUserId) {
        // Read before deleting: after the cascade there is no document left to name
        // in the audit entry, and the owner id is needed to reset the account.
        const brand = await BrandProfile.findById(brandId).select('name type user').lean();
        if (!brand) throw new Error('Brand not found');

        const Post = require('../models/Post');

        await Promise.all([
            BrandProfile.findByIdAndDelete(brandId),
            Post.deleteMany({ brand: brandId }),
            User.updateMany(
                { followingBrands: brandId },
                { $pull: { followingBrands: brandId } }
            ),
            brand.user
                ? User.findByIdAndUpdate(brand.user, {
                    $set: { verificationBadge: 'none', isVerified: false },
                })
                : Promise.resolve(),
        ]);

        await adminService.recordAdminAction({
            adminUser: adminUserId,
            action: 'delete',
            entityType: 'creator',
            entityId: brandId,
            metadata: { name: brand.name, type: brand.type },
        });

        return { success: true };
    },

    // ================== AUDIT TRAIL ==================

    /** Largest page the audit endpoint will serve, whatever the caller asks for. */
    AUDIT_MAX_LIMIT: 100,

    /**
     * Clamp paging input. Pure, so it is checkable without a database.
     *
     * `limit` was passed straight to .limit() from the query string, so
     * `?limit=1000000` returned the entire audit table in one populated query - a table
     * that only ever grows, and now grows on every admin action rather than only on
     * deletes. `page` was equally unguarded: `?page=0` produced skip -20 and
     * `?page=abc` produced NaN, either of which Mongo rejects or silently mishandles.
     */
    auditPaging({ page = 1, limit = 20 } = {}) {
        const safePage = Math.max(1, Math.floor(Number(page)) || 1);
        const requested = Math.floor(Number(limit)) || 20;
        const safeLimit = Math.min(Math.max(1, requested), adminService.AUDIT_MAX_LIMIT);
        return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
    },

    async getAuditTrail({ page = 1, limit = 20, entityType, action } = {}) {
        const filter = {};
        if (entityType) filter.entityType = entityType;
        if (action) filter.action = action;

        const paging = adminService.auditPaging({ page, limit });
        const skip = paging.skip;
        const parsedLimit = paging.limit;

        const [entries, total] = await Promise.all([
            AuditLog.find(filter)
                .populate('adminUser', 'name email')
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(parsedLimit),
            AuditLog.countDocuments(filter)
        ]);

        return {
            entries,
            total,
            page: paging.page,
            // At least 1. An empty result used to report `pages: 0`, which the admin page
            // only survived because it reads `data.pages || data.totalPages || 1` and 0
            // is falsy - a coincidence, not a contract.
            pages: Math.max(1, Math.ceil(total / parsedLimit)),
        };
    },

    /**
     * Delete audit entries.
     *
     * With an id, drops that one entry. With no id, clears the whole trail. This is
     * housekeeping for a table that only grows - it is not itself audited, because
     * an audit OF deleting the audit log, written to the same log, is the first
     * thing a bad actor would delete next. Gated to super_admin/admin at the route.
     */
    async deleteAuditLog(id) {
        const res = await AuditLog.findByIdAndDelete(id);
        if (!res) throw new Error('Audit entry not found');
        return { success: true };
    },

    async clearAuditTrail() {
        const { deletedCount } = await AuditLog.deleteMany({});
        return { success: true, deleted: deletedCount };
    }
};

module.exports = adminService;
