'use client';

import React, { useState } from 'react';
import { Heart, MessageCircle, Send, MoreHorizontal } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { brandsApi, eventsApi } from '@/lib/api';

interface PostProps {
    post: {
        _id: string;
        content: string;
        images?: string[];
        createdAt: string;
        likes: string[];
        comments: {
            _id: string;
            user: { _id: string; name: string; avatar?: string };
            content: string;
            createdAt: string;
        }[];
        brand?: {
            _id: string;
            name: string;
            profilePhoto: string;
        };
        event?: {
            _id: string;
            name: string;
            images?: string[];
        };
        author?: {
            _id: string;
            name: string;
            avatar?: string;
        };
        isEdited?: boolean;
    };
    type?: 'brand' | 'event';
    parentId?: string; // brandId or eventId for API calls
}

export default function PostCard({ post, type = 'brand', parentId }: PostProps) {
    const { user } = useAuth();
    const [likes, setLikes] = useState(post.likes || []);
    const [comments, setComments] = useState(post.comments || []);
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [isLiking, setIsLiking] = useState(false);
    const [isCommenting, setIsCommenting] = useState(false);

    const isLiked = user?._id ? likes.includes(user._id) : false;

    const handleLike = async () => {
        if (!user?._id || !parentId) return;

        setIsLiking(true);
        try {
            const api = type === 'event' ? eventsApi : brandsApi;
            const result = await api.toggleLike(parentId, post._id, user._id) as { liked: boolean; likesCount: number };

            if (result.liked) {
                setLikes([...likes, user._id]);
            } else {
                setLikes(likes.filter(id => id !== user._id));
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        } finally {
            setIsLiking(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?._id || !parentId || !newComment.trim()) return;

        setIsCommenting(true);
        try {
            const api = type === 'event' ? eventsApi : brandsApi;
            const result = await api.addComment(parentId, post._id, user._id, newComment) as { comments: any[] };
            setComments(result.comments);
            setNewComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
        } finally {
            setIsCommenting(false);
        }
    };

    // Format relative time (e.g., "4 mins ago", "1 day ago")
    const getRelativeTime = (dateString: string) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min${Math.floor(diffInSeconds / 60) > 1 ? 's' : ''} ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''} ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''} ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} week${Math.floor(diffInSeconds / 604800) > 1 ? 's' : ''} ago`;
        return new Date(dateString).toLocaleDateString();
    };

    const displayName = post.brand?.name || post.event?.name || post.author?.name || 'Unknown';
    const displayPhoto = post.brand?.profilePhoto || post.event?.images?.[0] || post.author?.avatar || '/default-avatar.png';

    return (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden relative bg-zinc-800">
                        <Image
                            src={displayPhoto}
                            alt={displayName}
                            fill
                            className="object-cover"
                        />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">{displayName}</h3>
                        <p className="text-gray-400 text-xs">
                            {getRelativeTime(post.createdAt)}
                            {post.isEdited && <span className="ml-2">(edited)</span>}
                        </p>
                    </div>
                </div>
                <button className="text-gray-400 hover:text-white">
                    <MoreHorizontal size={20} />
                </button>
            </div>

            <p className="text-gray-200 mb-4 whitespace-pre-wrap">{post.content}</p>

            {post.images && post.images.length > 0 && (
                <div className={`grid gap-2 mb-4 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {post.images.map((img, idx) => (
                        <div key={idx} className="relative w-full h-64 rounded-lg overflow-hidden">
                            <Image src={img} alt="Post content" fill className="object-cover" />
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-6 pt-4 border-t border-white/5 text-gray-400">
                <button
                    onClick={handleLike}
                    disabled={isLiking || !user}
                    className={`flex items-center gap-2 transition-colors ${isLiked ? 'text-pink-500' : 'hover:text-pink-500'}`}
                >
                    <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
                    <span>{likes.length}</span>
                </button>
                <button
                    onClick={() => setShowComments(!showComments)}
                    className="flex items-center gap-2 hover:text-blue-400 transition-colors"
                >
                    <MessageCircle size={20} />
                    <span>{comments.length}</span>
                </button>
                {/* Share button commented out
                <button className="flex items-center gap-2 hover:text-green-400 transition-colors ml-auto">
                    <Share2 size={20} />
                    <span>Share</span>
                </button>
                */}
            </div>

            {/* Comments Section */}
            {showComments && (
                <div className="mt-4 pt-4 border-t border-white/5">
                    {/* Comment Input */}
                    {user && (
                        <form onSubmit={handleAddComment} className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Write a comment..."
                                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                            />
                            <button
                                type="submit"
                                disabled={isCommenting || !newComment.trim()}
                                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    )}

                    {/* Comments List */}
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {comments.length === 0 ? (
                            <p className="text-gray-500 text-sm">No comments yet. Be the first to comment!</p>
                        ) : (
                            comments.map((comment: any) => (
                                <div key={comment._id} className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full overflow-hidden relative bg-zinc-800 flex-shrink-0">
                                        {comment.user?.avatar ? (
                                            <Image
                                                src={comment.user.avatar}
                                                alt={comment.user?.name || 'User'}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                                {comment.user?.name?.[0] || '?'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="bg-white/5 rounded-lg px-3 py-2">
                                            <p className="text-sm font-medium text-white">{comment.user?.name || 'Unknown'}</p>
                                            <p className="text-sm text-gray-300">{comment.content}</p>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {getRelativeTime(comment.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
