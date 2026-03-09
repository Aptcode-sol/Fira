const express = require('express');
const router = express.Router();
const { Conversation, Message, User, BrandProfile } = require('../models');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/messages/conversations - Get all conversations for current user
router.get('/conversations', async (req, res) => {
    try {
        const userId = req.user._id;

        const conversations = await Conversation.find({
            participants: userId,
            isActive: true
        })
        .populate('participants', 'name avatar email')
        .populate('brand', 'name profilePhoto type user')
        .sort({ updatedAt: -1 });

        // Add unread count for current user
        const conversationsWithUnread = conversations.map(conv => {
            const convObj = conv.toObject();
            convObj.unreadCount = conv.unreadCount?.get(userId.toString()) || 0;
            return convObj;
        });

        res.json({ 
            success: true, 
            conversations: conversationsWithUnread 
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
        const { page = 1, limit = 50 } = req.query;
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

        // Get messages with pagination
        const messages = await Message.find({
            conversation: conversationId,
            isDeleted: false
        })
        .populate('sender', 'name avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

        // Mark messages as read
        await Message.updateMany(
            {
                conversation: conversationId,
                sender: { $ne: userId },
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        // Reset unread count for this user
        conversation.unreadCount.set(userId.toString(), 0);
        await conversation.save();

        res.json({
            success: true,
            conversation,
            messages: messages.reverse(), // Oldest first for chat display
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// POST /api/messages/send - Send a message
router.post('/send', async (req, res) => {
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

        // Update conversation last message and unread counts
        conversation.lastMessage = {
            content: content.trim().substring(0, 100),
            sender: senderId,
            timestamp: new Date()
        };

        // Increment unread count for other participants
        conversation.participants.forEach(participantId => {
            if (participantId.toString() !== senderId.toString()) {
                const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
                conversation.unreadCount.set(participantId.toString(), currentCount + 1);
            }
        });

        await conversation.save();

        // Populate sender info
        await message.populate('sender', 'name avatar');

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

            conversation.lastMessage = {
                content: message.trim().substring(0, 100),
                sender: userId,
                timestamp: new Date()
            };

            const currentCount = conversation.unreadCount.get(brandOwnerId.toString()) || 0;
            conversation.unreadCount.set(brandOwnerId.toString(), currentCount + 1);
            await conversation.save();
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
