const express = require('express');
const router = express.Router();
const { Conversation, Message, User, BrandProfile, Inquiry, Event, Venue } = require('../models');
const authMiddleware = require('../middleware/auth');
const sse = require('../lib/sse');
const pushService = require('../services/pushService');
const { messageLimiter } = require('../middleware/rateLimiters');

// All routes require authentication
router.use(authMiddleware);

/**
 * Persist a message's conversation-level side effects, then deliver it.
 *
 * All three send paths (direct send, brand enquiry, event/venue enquiry) used to
 * hand-roll this: mutate the unreadCount Map in memory, then conversation.save().
 * That is a read-modify-write, so two messages arriving at once both started from
 * the same count and the second save overwrote the first, dropping an unread.
 * $inc is evaluated server-side against current state, so concurrent sends both
 * land. One copy here rather than three also means live delivery and push could
 * be added once instead of being forgotten on two of the three paths.
 *
 * Order matters: persist, then fan out. SSE and push are delivery optimisations,
 * never the system of record - a recipient with no open tab and no push
 * subscription must still find the message on next load.
 */
async function fanOutMessage({ conversation, message, content, senderId }) {
    const preview = content.trim().substring(0, 100);
    const recipients = conversation.participants
        .map(p => (p._id || p).toString())
        .filter(id => id !== senderId.toString());

    const update = {
        $set: {
            lastMessage: { content: preview, sender: senderId, timestamp: new Date() }
        }
    };
    if (recipients.length > 0) {
        update.$inc = {};
        for (const id of recipients) update.$inc[`unreadCount.${id}`] = 1;
    }
    await Conversation.updateOne({ _id: conversation._id }, update);

    if (recipients.length === 0) return;

    // Name the listing alongside the sender so a push is actionable from the lock
    // screen - "Asha · Rooftop Loft" beats a bare "Asha".
    const senderName = message.sender?.name || 'New message';
    const reference = conversation.inquiryContext?.referenceName;
    const title = reference ? `${senderName} · ${reference}` : senderName;

    sse.sendToMany(recipients, {
        type: 'message:new',
        conversationId: conversation._id.toString(),
        message,
        title
    });

    // Chat deliberately creates no Notification row: one row per message would
    // bury every booking and payment alert in the feed. Unread badge + push is
    // the standard treatment for chat.
    pushService
        .sendToUsers(recipients, {
            title,
            body: content.trim().substring(0, 140),
            url: `/messages?conversation=${conversation._id}`,
            data: { conversationId: conversation._id.toString() }
        })
        .catch(err => console.error('Message push failed:', err.message));
}

// GET /api/messages/conversations - Get all conversations for current user
router.get('/conversations', async (req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 20 } = req.query;

        // Page-based, not cursor-based: the inbox shows a "page X of Y" control, and
        // that needs a total. Offsets are safe here because only a new message
        // reorders this list - reading no longer touches updatedAt - so pages do not
        // shuffle under the user the way they would on a live feed.
        // This also used to return every conversation ever, unbounded.
        const pageSize = Math.min(parseInt(limit) || 20, 50);
        const pageNum = Math.max(parseInt(page) || 1, 1);

        // Hide threads that never got a message. New ones can no longer be created
        // (start-brand-enquiry now requires one), but rows already in the database
        // would otherwise linger in the list forever showing "No messages yet".
        // Filtering rather than deleting keeps it reversible and needs no migration.
        const filter = {
            participants: userId,
            isActive: true,
            'lastMessage.content': { $nin: [null, ''] }
        };

        const [total, found] = await Promise.all([
            Conversation.countDocuments(filter),
            Conversation.find(filter)
                .populate('participants', 'name avatar email')
                .populate('brand', 'name profilePhoto type user')
                .sort({ updatedAt: -1 })
                .skip((pageNum - 1) * pageSize)
                .limit(pageSize)
        ]);

        // Add unread count for current user
        const conversationsWithUnread = found.map(conv => {
            const convObj = conv.toObject();
            convObj.unreadCount = conv.unreadCount?.get(userId.toString()) || 0;
            return convObj;
        });

        res.json({
            success: true,
            conversations: conversationsWithUnread,
            pagination: {
                page: pageNum,
                limit: pageSize,
                total,
                // At least 1 so an empty inbox still reads "1 of 1" rather than "of 0".
                totalPages: Math.max(Math.ceil(total / pageSize), 1)
            }
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// GET /api/messages/conversations/:conversationId - Get messages for a conversation
router.get('/conversations/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { before, limit = 30 } = req.query;
        const userId = req.user._id;

        // Verify user is participant
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        }).populate('participants', 'name avatar email')
          .populate('brand', 'name profilePhoto type user');

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Cursor pagination, newest-first then reversed for display.
        //
        // `before` is the createdAt of the oldest message the client already has,
        // so "load older" walks backwards from a fixed point. Offset/skip drifts
        // on a live thread: every message that arrives mid-scroll shifts the
        // window, so page 2 repeats or skips rows. A cursor is stable under
        // concurrent writes.
        const pageSize = Math.min(parseInt(limit) || 30, 100);
        const query = { conversation: conversationId, isDeleted: false };
        if (before) {
            const cursor = new Date(before);
            if (!isNaN(cursor.getTime())) query.createdAt = { $lt: cursor };
        }

        // Fetch one extra to learn whether older messages exist without a count().
        const found = await Message.find(query)
            .populate('sender', 'name avatar')
            .sort({ createdAt: -1 })
            .limit(pageSize + 1);

        const hasMore = found.length > pageSize;
        const messages = (hasMore ? found.slice(0, pageSize) : found).reverse();

        // Mark the other side's messages as read, and tell them so their ticks
        // update live. Only bother when something actually changed.
        const readResult = await Message.updateMany(
            {
                conversation: conversationId,
                sender: { $ne: userId },
                isRead: false
            },
            {
                $set: { isRead: true, readAt: new Date() }
            }
        );

        // $set the map path directly instead of mutating the doc and saving it:
        // a full save() would write back a unreadCount map read before the other
        // participant's concurrent increment, silently resetting their count.
        //
        // timestamps: false is what stops the inbox reshuffling. The list is sorted
        // by updatedAt, and Mongoose bumps updatedAt on every update by default -
        // so simply opening a thread moved it to the top of the list. Reading is
        // not activity; only a new message should reorder the inbox.
        await Conversation.updateOne(
            { _id: conversationId },
            { $set: { [`unreadCount.${userId.toString()}`]: 0 } },
            { timestamps: false }
        );

        if (readResult.modifiedCount > 0) {
            const others = conversation.participants
                .map(p => (p._id || p).toString())
                .filter(id => id !== userId.toString());
            sse.sendToMany(others, {
                type: 'message:read',
                conversationId,
                readBy: userId.toString(),
                readAt: new Date().toISOString()
            });
        }

        res.json({
            success: true,
            conversation,
            messages, // oldest first for chat display
            pagination: {
                limit: pageSize,
                hasMore,
                // Cursor for the next "load older" call.
                nextBefore: messages.length > 0 ? messages[0].createdAt : null
            }
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// POST /api/messages/send - Send a message
// Rate limited: an authenticated write that fans out a push to another person is
// a spam vector, and nothing else here bounded it.
router.post('/send', messageLimiter, async (req, res) => {
    try {
        const { conversationId, receiverId, brandId, content, messageType = 'text', imageUrl } = req.body;
        const senderId = req.user._id;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Message content is required' });
        }

        let conversation;

        if (conversationId) {
            // Existing conversation
            conversation = await Conversation.findOne({
                _id: conversationId,
                participants: senderId
            });

            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }
        } else if (receiverId) {
            // Find or create conversation with receiver
            conversation = await Conversation.findOne({
                participants: { $all: [senderId, receiverId] },
                brand: brandId || null
            });

            if (!conversation) {
                // Create new conversation
                conversation = await Conversation.create({
                    participants: [senderId, receiverId],
                    brand: brandId || null,
                    unreadCount: new Map()
                });
            }
        } else {
            return res.status(400).json({ error: 'Either conversationId or receiverId is required' });
        }

        // Create message
        const message = await Message.create({
            conversation: conversation._id,
            sender: senderId,
            content: content.trim(),
            messageType,
            imageUrl
        });

        // Populate sender info before fan-out so the pushed payload and the push
        // title both carry the sender's name.
        await message.populate('sender', 'name avatar');

        await fanOutMessage({ conversation, message, content, senderId });

        res.status(201).json({
            success: true,
            message,
            conversationId: conversation._id
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// POST /api/messages/start-brand-enquiry - Start a conversation with a brand
router.post('/start-brand-enquiry', async (req, res) => {
    try {
        const { brandId, message } = req.body;
        const userId = req.user._id;

        if (!brandId) {
            return res.status(400).json({ error: 'Brand ID is required' });
        }

        // A message is mandatory. This endpoint used to create the conversation
        // whether or not one was supplied, and the creator page called it from a
        // bare "Send Enquiry" button - so pressing it produced an empty thread that
        // then sat in both users' inboxes permanently reading "No messages yet".
        // Enforced here rather than only in the form, so no caller can reintroduce
        // empty threads.
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'A message is required to start a conversation' });
        }

        // Get brand and its owner
        const brand = await BrandProfile.findById(brandId);
        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        const brandOwnerId = brand.user;

        // Check if conversation already exists
        let conversation = await Conversation.findOne({
            participants: { $all: [userId, brandOwnerId] },
            brand: brandId
        });

        if (!conversation) {
            // Create new conversation
            conversation = await Conversation.create({
                participants: [userId, brandOwnerId],
                brand: brandId,
                unreadCount: new Map()
            });
        }

        // Send initial message if provided
        if (message && message.trim()) {
            const newMessage = await Message.create({
                conversation: conversation._id,
                sender: userId,
                content: message.trim(),
                messageType: 'text'
            });
            await newMessage.populate('sender', 'name avatar');
            await fanOutMessage({
                conversation,
                message: newMessage,
                content: message,
                senderId: userId
            });
        }

        await conversation.populate('participants', 'name avatar email');
        await conversation.populate('brand', 'name profilePhoto type user');

        res.status(201).json({
            success: true,
            conversation
        });
    } catch (error) {
        console.error('Start brand enquiry error:', error);
        res.status(500).json({ error: 'Failed to start conversation' });
    }
});

// POST /api/messages/start-inquiry-conversation - Start (or reuse) a conversation
// between the inquiry sender and the reference (event/venue) owner, bound to the inquiry.
// Mirrors the find-or-create pattern in /start-brand-enquiry.
router.post('/start-inquiry-conversation', async (req, res) => {
    try {
        const { inquiryId, message } = req.body;
        const userId = req.user._id;

        if (!inquiryId) {
            return res.status(400).json({ error: 'Inquiry ID is required' });
        }

        const inquiry = await Inquiry.findById(inquiryId);
        if (!inquiry) {
            return res.status(404).json({ error: 'Inquiry not found' });
        }

        // Only the sender may open the thread for their own enquiry. Without this
        // any authenticated caller could pass someone else's inquiry id and get a
        // conversation with that owner, using another person's enquiry as the
        // pretext. Guest enquiries have no `user`, so they have no sender to match
        // and cannot be turned into a thread by whoever guesses the id.
        if (!inquiry.user || inquiry.user.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'Not allowed to open a conversation for this inquiry' });
        }

        // Resolve the reference owner: event -> organizer, venue -> owner.
        // The name comes along so the thread can say what it is about - without it
        // the owner just sees a message from a stranger with no idea which of their
        // listings prompted it.
        let ownerId;
        let referenceName;
        let referenceImage;
        if (inquiry.referenceType === 'event') {
            const event = await Event.findById(inquiry.referenceId).select('organizer name images');
            ownerId = event?.organizer;
            referenceName = event?.name;
            referenceImage = event?.images?.[0] || null;
        } else if (inquiry.referenceType === 'venue') {
            const venue = await Venue.findById(inquiry.referenceId).select('owner name images');
            ownerId = venue?.owner;
            referenceName = venue?.name;
            referenceImage = venue?.images?.[0] || null;
        }

        if (!ownerId) {
            return res.status(404).json({ error: 'Inquiry reference owner not found' });
        }

        if (ownerId.toString() === userId.toString()) {
            return res.status(400).json({ error: 'Cannot start a conversation with yourself' });
        }

        // One thread per (sender, listing) - not per enquiry.
        //
        // This used to key on `inquiry: inquiryId`. Every submit creates a fresh
        // Inquiry, so asking the same venue a second question opened a second
        // thread, and the rate limit allows five per listing per day: up to five
        // near-identical threads with the same person about the same venue. Keying
        // on the listing means a follow-up question continues the existing
        // conversation, which is what both sides expect.
        let conversation = await Conversation.findOne({
            participants: { $all: [userId, ownerId] },
            'inquiryContext.referenceType': inquiry.referenceType,
            'inquiryContext.referenceId': inquiry.referenceId
        });

        // Threads created before inquiryContext existed are keyed the old way.
        // Adopt one if present and backfill its context so it matches the lookup
        // above from now on.
        if (!conversation) {
            conversation = await Conversation.findOne({
                participants: { $all: [userId, ownerId] },
                inquiry: inquiryId
            });
            if (conversation && !conversation.inquiryContext?.referenceId) {
                const sender = await User.findById(userId).select('name email phone');
                conversation.inquiryContext = {
                    referenceType: inquiry.referenceType,
                    referenceId: inquiry.referenceId,
                    referenceName: referenceName || null,
                    referenceImage: referenceImage || null,
                    senderName: inquiry.senderName || sender?.name || null,
                    senderEmail: inquiry.senderEmail || sender?.email || null,
                    senderPhone: sender?.phone || null
                };
                // Backfilling stored context is bookkeeping, not activity - it must
                // not bump this thread up the inbox.
                await conversation.save({ timestamps: false });
            }
        }

        if (!conversation) {
            // Phone is not on the Inquiry (submitInquiry never stored it), so it
            // comes off the sender's account - the owner asked for a way to call
            // back, and the account number is the one the user already maintains
            // rather than a field re-typed per enquiry. Null when they have none.
            const sender = await User.findById(userId).select('name email phone');

            conversation = await Conversation.create({
                participants: [userId, ownerId],
                inquiry: inquiryId,
                unreadCount: new Map(),
                inquiryContext: {
                    referenceType: inquiry.referenceType,
                    referenceId: inquiry.referenceId,
                    referenceName: referenceName || null,
                    referenceImage: referenceImage || null,
                    senderName: inquiry.senderName || sender?.name || null,
                    senderEmail: inquiry.senderEmail || sender?.email || null,
                    senderPhone: sender?.phone || null
                }
            });

            // One system line at the head of a new thread names the listing this
            // enquiry is about, so the thread reads correctly even somewhere that
            // does not render the context header.
            if (referenceName) {
                await Message.create({
                    conversation: conversation._id,
                    sender: userId,
                    content: `Enquiry about ${inquiry.referenceType}: ${referenceName}`,
                    messageType: 'system'
                });
            }
        }

        // Send initial message if provided
        if (message && message.trim()) {
            const newMessage = await Message.create({
                conversation: conversation._id,
                sender: userId,
                content: message.trim(),
                messageType: 'text'
            });
            await newMessage.populate('sender', 'name avatar');
            await fanOutMessage({
                conversation,
                message: newMessage,
                content: message,
                senderId: userId
            });
        }

        await conversation.populate('participants', 'name avatar email');

        res.status(201).json({
            success: true,
            conversation
        });
    } catch (error) {
        console.error('Start inquiry conversation error:', error);
        res.status(500).json({ error: 'Failed to start conversation' });
    }
});

// GET /api/messages/unread-count - Get total unread message count
router.get('/unread-count', async (req, res) => {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            participants: userId,
            isActive: true
        });

        let totalUnread = 0;
        conversations.forEach(conv => {
            totalUnread += conv.unreadCount?.get(userId.toString()) || 0;
        });

        res.json({
            success: true,
            unreadCount: totalUnread
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

// DELETE /api/messages/conversations/:conversationId - Archive a conversation
router.delete('/conversations/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        const conversation = await Conversation.findOneAndUpdate(
            {
                _id: conversationId,
                participants: userId
            },
            { isActive: false },
            { new: true }
        );

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        res.json({
            success: true,
            message: 'Conversation archived'
        });
    } catch (error) {
        console.error('Archive conversation error:', error);
        res.status(500).json({ error: 'Failed to archive conversation' });
    }
});

module.exports = router;
