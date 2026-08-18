const Inquiry = require('../models/Inquiry');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const notificationService = require('./notificationService');
const emailService = require('./emailService');

const VALID_EVENT_STATUSES = ['upcoming', 'approved', 'ongoing'];
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

const inquiryService = {
    /**
     * Submit a new inquiry for an event or venue.
     *
     * 1. Validates reference exists and has valid status
     * 2. Enforces rate limit (5 per email+reference per 24h)
     * 3. Creates Inquiry document
     * 4. Notifies owner (in-app + email, best-effort)
     * 5. Returns created inquiry
     */
    async submitInquiry({ referenceType, referenceId, senderName, senderEmail, senderPhone, message, userId }) {
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

        // 2. Rate limit: max 5 inquiries per senderEmail + referenceId in 24h
        const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
        const recentCount = await Inquiry.countDocuments({
            senderEmail,
            referenceId,
            createdAt: { $gte: windowStart }
        });

        if (recentCount >= RATE_LIMIT_MAX) {
            const err = new Error('Rate limit exceeded. Maximum 5 inquiries per 24 hours');
            err.status = 429;
            throw err;
        }

        // 3. Create the Inquiry document
        const inquiryData = {
            referenceType,
            referenceId,
            senderName,
            senderEmail,
            senderPhone: senderPhone || null,
            message
        };
        if (userId) inquiryData.user = userId;

        const inquiry = await Inquiry.create(inquiryData);

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
    }
};

module.exports = inquiryService;
