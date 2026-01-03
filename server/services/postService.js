const Post = require('../models/Post');
const BrandProfile = require('../models/BrandProfile');
const Event = require('../models/Event');

const postService = {
    // =================== BRAND POSTS ===================

    // Create a new brand post
    async createPost(brandId, data) {
        const brand = await BrandProfile.findById(brandId);
        if (!brand) throw new Error('Brand not found');

        const post = await Post.create({
            brand: brandId,
            author: brand.user,
            content: data.content,
            images: data.images || []
        });

        return post;
    },

    // Get posts for a brand
    async getBrandPosts(brandId, page = 1, limit = 10) {
        const posts = await Post.find({ brand: brandId })
            .sort({ createdAt: -1 })
            .populate('brand', 'name profilePhoto')
            .populate('author', 'name avatar')
            .populate('comments.user', 'name avatar')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Post.countDocuments({ brand: brandId });

        return {
            posts,
            hasMore: total > page * limit
        };
    },

    // Update a brand post
    async updatePost(postId, brandId, userId, data) {
        const brand = await BrandProfile.findById(brandId);
        if (!brand) throw new Error('Brand not found');

        if (brand.user.toString() !== userId) {
            throw new Error('Not authorized to update this post');
        }

        const post = await Post.findOne({ _id: postId, brand: brandId });
        if (!post) throw new Error('Post not found');

        if (data.content) post.content = data.content;
        if (data.images) post.images = data.images;
        post.isEdited = true;

        await post.save();
        return post;
    },

    // Delete a brand post
    async deletePost(postId, brandId, userId) {
        const brand = await BrandProfile.findById(brandId);
        if (!brand) throw new Error('Brand not found');

        if (brand.user.toString() !== userId) {
            throw new Error('Not authorized to delete this post');
        }

        const post = await Post.findOneAndDelete({ _id: postId, brand: brandId });
        if (!post) throw new Error('Post not found');

        return { success: true, message: 'Post deleted successfully' };
    },

    // =================== EVENT POSTS ===================

    // Create a new event post
    async createEventPost(eventId, userId, data) {
        const event = await Event.findById(eventId);
        if (!event) throw new Error('Event not found');

        // Get organizer ID (handles both populated and unpopulated cases)
        const organizerId = event.organizer._id ? event.organizer._id.toString() : event.organizer.toString();

        // Verify user is the event organizer
        if (organizerId !== userId) {
            console.log('Auth check failed:', { organizerId, userId });
            throw new Error('Not authorized to post on this event');
        }

        const post = await Post.create({
            event: eventId,
            author: userId,
            content: data.content,
            images: data.images || []
        });

        return post;
    },

    // Get posts for an event
    async getEventPosts(eventId, page = 1, limit = 10) {
        const posts = await Post.find({ event: eventId })
            .sort({ createdAt: -1 })
            .populate('event', 'name images')
            .populate('author', 'name avatar')
            .populate('comments.user', 'name avatar')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Post.countDocuments({ event: eventId });

        return {
            posts,
            hasMore: total > page * limit
        };
    },

    // Update an event post
    async updateEventPost(postId, eventId, userId, data) {
        const event = await Event.findById(eventId);
        if (!event) throw new Error('Event not found');

        const organizerId = event.organizer._id ? event.organizer._id.toString() : event.organizer.toString();
        if (organizerId !== userId) {
            throw new Error('Not authorized to update this post');
        }

        const post = await Post.findOne({ _id: postId, event: eventId });
        if (!post) throw new Error('Post not found');

        if (data.content) post.content = data.content;
        if (data.images) post.images = data.images;
        post.isEdited = true;

        await post.save();
        return post;
    },

    // Delete an event post
    async deleteEventPost(postId, eventId, userId) {
        const event = await Event.findById(eventId);
        if (!event) throw new Error('Event not found');

        const organizerId = event.organizer._id ? event.organizer._id.toString() : event.organizer.toString();
        if (organizerId !== userId) {
            throw new Error('Not authorized to delete this post');
        }

        const post = await Post.findOneAndDelete({ _id: postId, event: eventId });
        if (!post) throw new Error('Post not found');

        return { success: true, message: 'Post deleted successfully' };
    },

    // =================== SHARED FUNCTIONS ===================

    // Get single post by ID
    async getPostById(postId) {
        const post = await Post.findById(postId)
            .populate('brand', 'name profilePhoto user')
            .populate('event', 'name images organizer')
            .populate('author', 'name avatar')
            .populate('likes', 'name avatar')
            .populate('comments.user', 'name avatar');

        if (!post) throw new Error('Post not found');
        return post;
    },

    // Like/Unlike a post
    async toggleLike(postId, userId) {
        const post = await Post.findById(postId);
        if (!post) throw new Error('Post not found');

        const isLiked = post.likes.includes(userId);

        if (isLiked) {
            post.likes.pull(userId);
        } else {
            post.likes.push(userId);
        }

        await post.save();
        return { liked: !isLiked, likesCount: post.likes.length };
    },

    // Add comment to a post
    async addComment(postId, userId, content) {
        const post = await Post.findById(postId);
        if (!post) throw new Error('Post not found');

        post.comments.push({
            user: userId,
            content: content,
            createdAt: new Date()
        });

        await post.save();

        // Populate and return the updated post
        const updatedPost = await Post.findById(postId)
            .populate('comments.user', 'name avatar');

        return updatedPost.comments;
    },

    // Delete comment from a post
    async deleteComment(postId, commentId, userId) {
        const post = await Post.findById(postId);
        if (!post) throw new Error('Post not found');

        const comment = post.comments.id(commentId);
        if (!comment) throw new Error('Comment not found');

        // Only comment author or post author can delete
        if (comment.user.toString() !== userId && post.author.toString() !== userId) {
            throw new Error('Not authorized to delete this comment');
        }

        post.comments.pull(commentId);
        await post.save();

        return { success: true, message: 'Comment deleted successfully' };
    }
};

module.exports = postService;
