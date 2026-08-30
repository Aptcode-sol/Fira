const Inquiry = require('../models/Inquiry');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const notificationService = require('./notificationService');
const emailService = require('./emailService');

const VALID_EVENT_STATUSES = ['upcoming', 'approved', 'ongoing'];
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;
const REPLY_MIN = 1;
const REPLY_MAX = 2000;

/**
 * Present an inquiry's status consistently for read paths.
 *
 * The reply content field is authoritative (Requirement 10.2): whenever an
 * enquiry has no reply (`replyText == null`), it is presented as `pending`,
 * auto-correcting any inconsistent stored `responded`/`closed`. Pure — no DB
 * write — so it can be applied on every read.
 *
 * Returns a shallow-cloned plain object with the corrected `status`; the input
 * is left untouched. Accepts a Mongoose document or a plain object.
 */
function normalizeStatus(inquiry) {
    if (!inquiry) return inquiry;
    const obj = typeof inquiry.toObject === 'function' ? inquiry.toObject() : { ...inquiry };
    if (obj.replyText == null) obj.status = 'pending';
    return obj;
}

/**
 * Resolve the owner of the listing an inquiry references: event -> organizer,
 * venue -> owner. Returns the owner ObjectId (or null if the reference/owner is
 * gone). Shared by every owner-only action (reply, close) so ownership is
 * resolved one way in one place (Req 5.3, 8.3, 12.3).
 */
async function resolveOwnerId(inquiry) {
    if (inquiry.referenceType === 'event') {
        const event = await Event.findById(inquiry.referenceId).select('organizer');
        return event?.organizer || null;
    }
    if (inquiry.referenceType === 'venue') {
        const venue = await Venue.findById(inquiry.referenceId).select('owner');
        return venue?.owner || null;
    }
    return null;
}

/**
 * Assert `requester` is the resolved listing owner, else throw a 403. Returns
 * the normalized requester id string. Enforced server-side regardless of client
 * input; never a silent empty result (Req 5.3, 8.3, 12.3).
 */
function assertRequesterIsOwner(ownerId, requester) {
    if (!ownerId) {
        const err = new Error('Inquiry reference owner not found');
        err.status = 404;
        throw err;
    }
    const requesterId = requester && requester._id ? requester._id : requester;
    if (!requesterId || ownerId.toString() !== requesterId.toString()) {
        const err = new Error('Only the listing owner may perform this action');
        err.status = 403;
        throw err;
    }
    return requesterId;
}

const inquiryService = {
    normalizeStatus,
    // Exposed so read paths (e.g. GET /inquiries/:id) can authorize the listing
    // owner using the same resolution the write paths use, rather than growing a
    // second copy of the event->organizer / venue->owner rule.
    resolveOwnerId,

    /**
     * Submit a new inquiry for an event or venue.
     *
     * Requires an authenticated `user`; sender identity (name/email) is derived
     * from the account and any body-supplied identity is ignored (Req 1.5, 10.4).
     *
     * 0. Requires authenticated user + validates message length at the boundary
     * 1. Validates reference exists and has valid status
     * 2. Enforces rate limit (5 per sender+reference per 24h)
     * 3. Creates Inquiry document (status 'pending', replyText null)
     * 4. Notifies owner (in-app + email, best-effort)
     * 5. Returns created inquiry
     */
    async submitInquiry({ referenceType, referenceId, message, user }) {
        // 0a. Require an authenticated user; derive identity from the account,
        //     ignoring any body-supplied name/email (Requirements 1.5, 10.4).
        if (!user || !user._id) {
            const err = new Error('Authentication required');
            err.status = 401;
            throw err;
        }
        const senderName = user.name;
        const senderEmail = user.email;

        // 0b. Validate message length at the trust boundary (Req 1.4, 12.4).
        const len = typeof message === 'string' ? message.trim().length : 0;
        if (len < MESSAGE_MIN || len > MESSAGE_MAX) {
            const err = new Error(`Message must be between ${MESSAGE_MIN} and ${MESSAGE_MAX} characters`);
            err.status = 400;
            err.field = 'message';
            throw err;
        }

        // 1. Validate reference exists and has valid status
        let reference;
        let ownerId;

        if (referenceType === 'event') {
            reference = await Event.findById(referenceId).populate('organizer', 'name email');
            if (!reference || !VALID_EVENT_STATUSES.includes(reference.status)) {
                const err = new Error('Reference is unavailable');
                err.status = 400;
                throw err;
            }
            ownerId = reference.organizer._id;
        } else if (referenceType === 'venue') {
            reference = await Venue.findById(referenceId).populate('owner', 'name email');
            if (!reference || reference.status !== 'approved') {
                const err = new Error('Reference is unavailable');
                err.status = 400;
                throw err;
            }
            ownerId = reference.owner._id;
        } else {
            const err = new Error('Invalid reference type');
            err.status = 400;
            throw err;
        }

        // 2. Rate limit: max 5 accepted enquiries per sender per listing within
        //    any rolling 24h window (Req 2.1-2.3). Counted from stored records
        //    (never client state); records outside the window do not count.
        //    Keyed on the authenticated account (user._id) — the stable sender
        //    identity from task 2.1 — so it can't be bypassed by changing email.
        const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
        const recentCount = await Inquiry.countDocuments({
            user: user._id,
            referenceId,
            createdAt: { $gte: windowStart }
        });

        if (recentCount >= RATE_LIMIT_MAX) {
            const err = new Error(`Rate limit exceeded. You can send at most ${RATE_LIMIT_MAX} enquiries per listing every 24 hours. Please try again later.`);
            err.status = 429;
            throw err;
        }

        // 3. Create exactly one Inquiry (status 'pending', replyText null via
        //    schema defaults) with account-derived identity (Req 1.3, 8.1, 10.4).
        const inquiry = await Inquiry.create({
            referenceType,
            referenceId,
            senderName,
            senderEmail,
            message: message.trim(),
            user: user._id
        });

        // 4. Notify the event organizer or venue owner (best-effort)
        const ownerInfo = referenceType === 'event' ? reference.organizer : reference.owner;
        const referenceName = reference.name;

        try {
            await notificationService.createNotification({
                userId: ownerId,
                type: 'system',
                title: `New inquiry for ${referenceName}`,
                message: `${senderName} sent an inquiry about your ${referenceType}: "${referenceName}"`,
                data: {
                    referenceId: inquiry._id,
                    referenceModel: 'Inquiry',
                    actionUrl: `/${referenceType}s/${referenceId}`
                },
                channel: 'all'
            });
        } catch (err) {
            console.error('Failed to create inquiry notification:', err.message);
        }

        try {
            await emailService.transporter.sendMail({
                from: `"${process.env.SMTP_FROM_NAME || 'Fira'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
                to: ownerInfo.email,
                subject: `New inquiry for ${referenceName}`,
                text: `Hi ${ownerInfo.name},\n\nYou have a new inquiry from ${senderName} (${senderEmail}) about your ${referenceType} "${referenceName}".\n\nMessage:\n${message}\n\n- FIRA Team`,
                html: `<p>Hi ${ownerInfo.name},</p><p>You have a new inquiry from <strong>${senderName}</strong> (${senderEmail}) about your ${referenceType} "<strong>${referenceName}</strong>".</p><p><em>${message}</em></p><p>- FIRA Team</p>`
            });
        } catch (err) {
            console.error('Failed to send inquiry email:', err.message);
        }

        // 5. Return created inquiry
        return inquiry;
    },

    /**
     * Owner replies once to a pending enquiry (Req 5.1-5.5, 8.2, 12.1-12.2).
     *
     * 1. Validates reply length 1..2000 at the boundary
     * 2. Resolves the listing owner (event -> organizer, venue -> owner) and
     *    asserts `responder === owner`, else 403
     * 3. Atomic `findOneAndUpdate` guarded on `status: 'pending'` writes the
     *    reply + status transition together, so a stored reply always implies
     *    `status != 'pending'` and two racing replies match at most once.
     *    On no match (already responded/closed) returns 409 with the existing reply.
     * 4. Best-effort sender notify + email after the write (never blocks persistence)
     */
    async replyToInquiry({ inquiryId, responder, replyText }) {
        // 1. Validate reply length at the trust boundary (Req 5.2, 12.4).
        const len = typeof replyText === 'string' ? replyText.trim().length : 0;
        if (len < REPLY_MIN || len > REPLY_MAX) {
            const err = new Error(`Reply must be between ${REPLY_MIN} and ${REPLY_MAX} characters`);
            err.status = 400;
            err.field = 'replyText';
            throw err;
        }

        const inquiry = await Inquiry.findById(inquiryId);
        if (!inquiry) {
            const err = new Error('Inquiry not found');
            err.status = 404;
            throw err;
        }

        // 2. Resolve the listing owner (event -> organizer, venue -> owner) and
        //    assert the responder is that owner (Req 5.3, 12.3). Enforced
        //    server-side regardless of client input; never a silent empty result.
        const ownerId = await resolveOwnerId(inquiry);
        const responderId = assertRequesterIsOwner(ownerId, responder);

        // 3. Atomic reply + status transition guarded on status:'pending'
        //    (Req 5.1, 5.5, 8.2, 12.1). Mirrors the conditional findOneAndUpdate
        //    concurrency pattern used elsewhere in this codebase.
        const trimmed = replyText.trim();
        const updated = await Inquiry.findOneAndUpdate(
            { _id: inquiryId, status: 'pending' },
            {
                replyText: trimmed,
                responder: responderId,
                repliedAt: new Date(),
                status: 'responded'
            },
            { new: true }
        );

        // No match: enquiry was already responded/closed. Single-reply model
        // (Req 5.4, 12.2) — reject with 409 and surface the existing reply.
        if (!updated) {
            const existing = await Inquiry.findById(inquiryId);
            const err = new Error('This enquiry has already been answered');
            err.status = 409;
            err.existingReply = existing ? existing.replyText : null;
            err.inquiry = existing;
            throw err;
        }

        // 4. Notify the sender (best-effort; never blocks persistence — Req 6.5, 12.1).
        //    Resolve the listing name for the notice/email.
        let listingName = inquiry.referenceType;
        if (inquiry.referenceType === 'event') {
            const ev = await Event.findById(inquiry.referenceId).select('name');
            listingName = ev?.name || 'your enquiry';
        } else {
            const vn = await Venue.findById(inquiry.referenceId).select('name');
            listingName = vn?.name || 'your enquiry';
        }

        if (updated.user) {
            try {
                await notificationService.createNotification({
                    userId: updated.user,
                    type: 'system',
                    title: `You got a reply to your enquiry about ${listingName}`,
                    message: `The ${inquiry.referenceType} owner replied: "${trimmed}"`,
                    data: {
                        referenceId: updated._id,
                        referenceModel: 'Inquiry',
                        actionUrl: '/dashboard/enquiries'
                    },
                    channel: 'all'
                });
            } catch (err) {
                console.error('Failed to create reply notification:', err.message);
            }
        }

        try {
            await emailService.transporter.sendMail({
                from: `"${process.env.SMTP_FROM_NAME || 'Fira'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
                to: updated.senderEmail,
                subject: `Reply to your enquiry about ${listingName}`,
                text: `Hi ${updated.senderName},\n\nYou received a reply to your enquiry about "${listingName}".\n\nReply:\n${trimmed}\n\n- FIRA Team`,
                html: `<p>Hi ${updated.senderName},</p><p>You received a reply to your enquiry about "<strong>${listingName}</strong>".</p><p><em>${trimmed}</em></p><p>- FIRA Team</p>`
            });
        } catch (err) {
            console.error('Failed to send reply email:', err.message);
        }

        return updated;
    },

    /**
     * Owner marks a `pending` or `responded` enquiry as `closed` (Req 8.3, 8.4, 12.3).
     *
     * 1. Resolves the listing owner (event -> organizer, venue -> owner) and
     *    asserts `requester === owner`, else 403.
     * 2. Atomic `findOneAndUpdate` guarded on `status in ['pending','responded']`
     *    transitions to `closed`. Any invalid transition — `closed -> *` or a
     *    sender-initiated change — matches nothing and is rejected with 409, so
     *    the valid graph is enforced at the write itself.
     */
    async closeInquiry({ inquiryId, requester }) {
        const inquiry = await Inquiry.findById(inquiryId);
        if (!inquiry) {
            const err = new Error('Inquiry not found');
            err.status = 404;
            throw err;
        }

        // 1. Resolve owner + assert requester is the owner (Req 8.3, 12.3).
        const ownerId = await resolveOwnerId(inquiry);
        assertRequesterIsOwner(ownerId, requester);

        // 2. Atomic transition to 'closed' guarded on the valid source states.
        //    closed -> * (and any other invalid transition) matches nothing (Req 8.4).
        const updated = await Inquiry.findOneAndUpdate(
            { _id: inquiryId, status: { $in: ['pending', 'responded'] } },
            { status: 'closed' },
            { new: true }
        );

        if (!updated) {
            const existing = await Inquiry.findById(inquiryId);
            const err = new Error('Invalid status transition');
            err.status = 409;
            err.inquiry = existing;
            throw err;
        }

        return updated;
    },

    /**
     * Owner lists enquiries for one listing they own (Req 4.2, 4.4, 8.5, 12.3).
     *
     * 1. Resolves the listing owner (event -> organizer, venue -> owner) and
     *    asserts `requester === owner`, else 403. Never returns [] in place of
     *    the authorization error (Req 4.4).
     * 2. Returns enquiries newest-first, each passed through `normalizeStatus`
     *    (Req 4.2), plus an authoritative `pending` count.
     * 3. Applies an optional status filter (`pending`/`responded`/`closed`/all —
     *    default all) against the normalized status (Req 8.5).
     *
     * The `pending` count is authoritative: it counts enquiries with no reply
     * (`replyText == null`), consistent with `normalizeStatus`, rather than the
     * possibly-inconsistent stored `status` value.
     */
    async getOwnerInquiries({ requester, referenceType, referenceId, statusFilter }) {
        // 1. Resolve owner from the listing directly. resolveOwnerId only reads
        //    referenceType/referenceId, so a listing-shaped object is enough —
        //    no separate inquiry lookup needed (Req 4.4, 12.3).
        const ownerId = await resolveOwnerId({ referenceType, referenceId });
        assertRequesterIsOwner(ownerId, requester);

        // 2. Newest-first, normalized on every read path (Req 4.2, 10.2).
        const docs = await Inquiry.find({ referenceType, referenceId }).sort({ createdAt: -1 });
        let inquiries = docs.map(normalizeStatus);

        // 3. Optional status filter against the normalized status (Req 8.5).
        //    Anything other than a concrete status (incl. undefined / 'all')
        //    means no filter.
        if (['pending', 'responded', 'closed'].includes(statusFilter)) {
            inquiries = inquiries.filter((i) => i.status === statusFilter);
        }

        // Authoritative pending count: replyText == null, consistent with
        // normalizeStatus. Counted over the full listing, not the filtered view.
        const pendingCount = await Inquiry.countDocuments({
            referenceType,
            referenceId,
            replyText: null
        });

        return { inquiries, pendingCount };
    },

    /**
     * Sender lists their own enquiries for the "My Enquiries" view (Req 7.1-7.3).
     *
     * Returns only enquiries whose `user` is the caller (Req 7.3), newest-first
     * (Req 7.1), each passed through `normalizeStatus` (Req 10.2). The reply
     * fields (`replyText`, `responder`, `repliedAt`) already live on the
     * documents, so the owner's reply carries through when present (Req 7.2).
     */
    async getSenderInquiries({ userId }) {
        const docs = await Inquiry.find({ user: userId }).sort({ createdAt: -1 });
        return docs.map(normalizeStatus);
    },

    /**
     * Sender marks their enquiry's reply as seen so the "you got a reply"
     * indicator clears (Req 7.4).
     *
     * 1. Loads the enquiry (404 if missing) and asserts `requester` is the
     *    sender (the enquiry's `user`), else 403 — enforced server-side.
     * 2. Sets `senderSeenReply = true`. This is naturally idempotent: setting a
     *    boolean to true leaves the state unchanged on repeat (Property 13).
     */
    async markReplySeen({ inquiryId, requester }) {
        const inquiry = await Inquiry.findById(inquiryId);
        if (!inquiry) {
            const err = new Error('Inquiry not found');
            err.status = 404;
            throw err;
        }

        const requesterId = requester && requester._id ? requester._id : requester;
        const senderId = inquiry.user;
        if (!requesterId || !senderId || senderId.toString() !== requesterId.toString()) {
            const err = new Error('Only the sender may mark this enquiry seen');
            err.status = 403;
            throw err;
        }

        // Idempotent: setting the flag to true again is a no-op on state.
        return Inquiry.findByIdAndUpdate(
            inquiryId,
            { senderSeenReply: true },
            { new: true }
        );
    }
};

module.exports = inquiryService;
