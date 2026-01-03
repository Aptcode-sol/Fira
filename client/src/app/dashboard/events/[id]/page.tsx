'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button, Modal } from '@/components/ui';
import { eventsApi, ticketsApi, uploadApi } from '@/lib/api';
import { Event, User, Venue } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

interface Ticket {
    _id: string;
    ticketId: string;
    user: {
        _id: string;
        name: string;
        email: string;
    };
    quantity: number;
    price: number;
    status: string;
    purchaseDate: string;
    isUsed: boolean;
}

export default function DashboardEventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading, user } = useAuth();
    const { showToast } = useToast();
    const [event, setEvent] = useState<Event | null>(null);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelling, setCancelling] = useState(false);

    // Edit mode state
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        category: '',
        date: '',
        endDate: '',
        startTime: '',
        endTime: '',
        eventType: 'public' as 'public' | 'private',
        ticketType: 'free' as 'free' | 'paid',
        ticketPrice: 0,
        maxAttendees: 100,
        termsAndConditions: '',
    });

    // Posts state
    const [posts, setPosts] = useState<any[]>([]);
    const [showPostModal, setShowPostModal] = useState(false);
    const [postContent, setPostContent] = useState('');
    const [postImages, setPostImages] = useState<File[]>([]);
    const [postImagePreviews, setPostImagePreviews] = useState<string[]>([]);
    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [editingPost, setEditingPost] = useState<any>(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (params.id && isAuthenticated) {
            fetchEvent(params.id as string);
            fetchTickets(params.id as string);
        }
    }, [params.id, isAuthenticated]);

    const fetchEvent = async (id: string) => {
        try {
            setIsLoading(true);
            const data = await eventsApi.getById(id);
            setEvent(data as Event);
        } catch (error) {
            console.error('Failed to fetch event:', error);
            showToast('Failed to load event', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTickets = async (eventId: string) => {
        try {
            const data = await ticketsApi.getEventTickets(eventId);
            setTickets(data as Ticket[]);
        } catch (error) {
            console.error('Failed to fetch tickets:', error);
        }
    };

    const copyToClipboard = (text: string, type: 'code' | 'link') => {
        navigator.clipboard.writeText(text);
        if (type === 'code') {
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        } else {
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        }
        showToast(`${type === 'code' ? 'Access code' : 'Event link'} copied!`, 'success');
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatPrice = (price: number) => {
        if (price === 0) return 'Free';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(price);
    };

    const handleCancelEvent = async () => {
        if (!event) return;
        setCancelling(true);
        try {
            const result = await eventsApi.cancel(event._id, cancelReason || 'Cancelled by organizer');
            const refundInfo = result.refundResults;
            if (refundInfo && refundInfo.refundsInitiated > 0) {
                showToast(`Event cancelled. ${refundInfo.refundsInitiated} refund(s) initiated totaling ₹${refundInfo.totalRefundAmount}`, 'success');
            } else {
                showToast('Event cancelled successfully', 'success');
            }
            setShowCancelModal(false);
            setCancelReason('');
            // Refresh event data
            fetchEvent(event._id);
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Failed to cancel event', 'error');
        } finally {
            setCancelling(false);
        }
    };

    // Initialize edit form with event data
    const initEditForm = (e: Event) => {
        const eventWithTerms = e as Event & { termsAndConditions?: string; endDate?: string };
        setEditForm({
            name: e.name || '',
            description: e.description || '',
            category: e.category || '',
            date: e.date ? new Date(e.date).toISOString().split('T')[0] : '',
            endDate: eventWithTerms.endDate ? new Date(eventWithTerms.endDate).toISOString().split('T')[0] : '',
            startTime: e.startTime || '',
            endTime: e.endTime || '',
            eventType: e.eventType || 'public',
            ticketType: e.ticketType || 'free',
            ticketPrice: e.ticketPrice || 0,
            maxAttendees: e.maxAttendees || 100,
            termsAndConditions: eventWithTerms.termsAndConditions || '',
        });
    };

    const handleEditClick = () => {
        if (event) {
            initEditForm(event);
            setIsEditMode(true);
        }
    };

    const handleSave = async () => {
        if (!event) return;
        setIsSaving(true);
        try {
            await eventsApi.update(event._id, {
                name: editForm.name,
                description: editForm.description,
                category: editForm.category,
                date: editForm.date,
                endDate: editForm.endDate || editForm.date,
                startTime: editForm.startTime,
                endTime: editForm.endTime,
                eventType: editForm.eventType,
                ticketType: editForm.ticketType,
                ticketPrice: editForm.ticketType === 'paid' ? editForm.ticketPrice : 0,
                maxAttendees: editForm.maxAttendees,
                termsAndConditions: editForm.termsAndConditions || null,
            });
            showToast('Event updated successfully!', 'success');
            setIsEditMode(false);
            fetchEvent(event._id);
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Failed to update event', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Fetch event posts
    const fetchPosts = async () => {
        if (!params.id) return;
        try {
            const result = await eventsApi.getPosts(params.id as string) as { posts: any[] };
            setPosts(result.posts || []);
        } catch (err) {
            console.error('Failed to fetch posts:', err);
        }
    };

    // Fetch posts when event loads
    useEffect(() => {
        if (event?._id) {
            fetchPosts();
        }
    }, [event?._id]);

    // Handle post image add (local preview only)
    const handlePostImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setPostImages(prev => [...prev, ...files]);
            setPostImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
        }
    };

    // Reset post form
    const resetPostForm = () => {
        setPostContent('');
        setPostImages([]);
        setPostImagePreviews([]);
        setEditingPost(null);
        setShowPostModal(false);
    };

    // Create or Update post
    const handleCreatePost = async () => {
        if (!params.id || !user?._id || !postContent.trim()) return;

        setIsCreatingPost(true);
        try {
            let imageUrls: string[] = [];
            if (postImages.length > 0) {
                const uploadPromises = postImages.map(file => uploadApi.single(file));
                const results = await Promise.all(uploadPromises);
                imageUrls = results.map((r: any) => r.url);
            }

            if (editingPost) {
                await eventsApi.updatePost(params.id as string, editingPost._id, {
                    content: postContent,
                    images: imageUrls.length > 0 ? imageUrls : editingPost.images,
                    userId: user._id
                });
            } else {
                await eventsApi.createPost(params.id as string, {
                    content: postContent,
                    images: imageUrls,
                    userId: user._id
                });
            }

            resetPostForm();
            fetchPosts();
            showToast(editingPost ? 'Post updated!' : 'Post created!', 'success');
        } catch (err) {
            showToast('Failed to save post', 'error');
        } finally {
            setIsCreatingPost(false);
        }
    };

    // Start editing a post
    const handleEditPost = (post: any) => {
        setEditingPost(post);
        setPostContent(post.content);
        setPostImagePreviews(post.images || []);
        setShowPostModal(true);
    };

    // Delete post
    const handleDeletePost = async (postId: string) => {
        if (!params.id || !user?._id) return;
        if (!confirm('Are you sure you want to delete this post?')) return;

        try {
            await eventsApi.deletePost(params.id as string, postId, user._id);
            fetchPosts();
            showToast('Post deleted', 'success');
        } catch (err) {
            showToast('Failed to delete post', 'error');
        }
    };

    if (authLoading || !isAuthenticated) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="p-6 lg:p-8">
                    <div className="animate-pulse">
                        <div className="h-64 bg-white/5 rounded-2xl mb-8" />
                        <div className="h-8 bg-white/5 rounded w-1/3 mb-4" />
                        <div className="h-4 bg-white/5 rounded w-full mb-2" />
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!event) {
        return (
            <DashboardLayout>
                <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white mb-2">Event not found</h1>
                        <p className="text-gray-400 mb-6">The event you&apos;re looking for doesn&apos;t exist.</p>
                        <Button onClick={() => router.push('/dashboard/events')}>Back to Events</Button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    const organizer = event.organizer as User;
    const venue = event.venue as Venue;
    const spotsLeft = event.maxAttendees - event.currentAttendees;
    const ticketsSold = tickets.reduce((sum, t) => sum + t.quantity, 0);
    const totalRevenue = tickets.reduce((sum, t) => sum + t.price, 0);
    const eventLink = typeof window !== 'undefined' ? `${window.location.origin}/events/${event._id}` : '';

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Link href="/dashboard/events" className="text-gray-400 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </Link>
                            <h1 className="text-3xl font-bold text-white">Manage Event</h1>
                        </div>
                        <p className="text-gray-400">View bookings and manage your event</p>
                    </div>
                    <div className="flex gap-3">
                        {isEditMode ? (
                            <>
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsEditMode(false)}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} isLoading={isSaving}>
                                    Save Changes
                                </Button>
                            </>
                        ) : (
                            <>
                                <Link href={`/events/${event._id}`} target="_blank">
                                    <Button variant="secondary">View Public Page</Button>
                                </Link>
                                {event.status !== 'cancelled' && (
                                    <>
                                        <Button
                                            variant="secondary"
                                            onClick={handleEditClick}
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Edit
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            className="!bg-red-500/20 !text-red-400 hover:!bg-red-500/30 !border-red-500/30"
                                            onClick={() => setShowCancelModal(true)}
                                        >
                                            Cancel Event
                                        </Button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Hero Image */}
                <div className="relative h-[300px] rounded-2xl overflow-hidden mb-8">
                    {event.images && event.images.length > 0 ? (
                        <img src={event.images[0]} alt={event.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-500/30 to-pink-500/30 flex items-center justify-center">
                            <svg className="w-24 h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-4 left-4 flex gap-2">
                        {event.eventType === 'private' && (
                            <span className="px-3 py-1.5 rounded-full bg-violet-500/30 backdrop-blur-sm border border-violet-500/30 text-violet-200 text-sm font-medium flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Private Event
                            </span>
                        )}
                        <span className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm capitalize">
                            {event.category}
                        </span>
                        <span className={`px-3 py-1.5 rounded-full backdrop-blur-sm text-sm capitalize ${event.status === 'upcoming' ? 'bg-green-500/30 text-green-200' :
                            event.status === 'ongoing' ? 'bg-blue-500/30 text-blue-200' :
                                event.status === 'completed' ? 'bg-gray-500/30 text-gray-200' :
                                    'bg-red-500/30 text-red-200'
                            }`}>
                            {event.status}
                        </span>
                    </div>

                    {/* Date Banner */}
                    <div className="absolute bottom-4 left-4 px-4 py-3 rounded-xl bg-black/70 backdrop-blur-sm border border-white/10">
                        <div className="text-violet-400 text-sm font-medium">
                            {formatDate(event.date)}
                            {event.endDate && new Date(event.endDate).toDateString() !== new Date(event.date).toDateString() && (
                                <> - {formatDate(event.endDate)}</>
                            )}
                        </div>
                        <div className="text-white text-lg font-semibold">{event.startTime} - {event.endTime}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Title */}
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{event.name}</h2>
                            {venue && typeof venue === 'object' && (
                                <p className="text-gray-400 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                    {venue.name} • {venue.address?.city}
                                </p>
                            )}
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4">
                                <div className="text-2xl font-bold text-white">{ticketsSold}</div>
                                <div className="text-gray-400 text-sm">Tickets Sold</div>
                            </div>
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4">
                                <div className="text-2xl font-bold text-white">{spotsLeft}</div>
                                <div className="text-gray-400 text-sm">Spots Left</div>
                            </div>
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4">
                                <div className="text-2xl font-bold text-green-400">{formatPrice(totalRevenue)}</div>
                                <div className="text-gray-400 text-sm">Total Revenue</div>
                            </div>
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4">
                                <div className="text-2xl font-bold text-white">{event.maxAttendees}</div>
                                <div className="text-gray-400 text-sm">Max Capacity</div>
                            </div>
                        </div>

                        {/* Private Event Access */}
                        {event.eventType === 'private' && (
                            <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    Private Event Access
                                </h3>
                                <p className="text-gray-400 text-sm mb-4">Share these details with your invited guests only.</p>

                                <div className="space-y-4">
                                    {/* Access Code */}
                                    <div className="bg-black/30 rounded-xl p-4">
                                        <div className="text-gray-400 text-xs mb-1">Access Code</div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-2xl font-mono font-bold text-violet-400 tracking-wider">
                                                {event.privateCode || 'N/A'}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => event.privateCode && copyToClipboard(event.privateCode, 'code')}
                                            >
                                                {copiedCode ? 'Copied!' : 'Copy'}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Event Link */}
                                    <div className="bg-black/30 rounded-xl p-4">
                                        <div className="text-gray-400 text-xs mb-1">Event Link</div>
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-white text-sm truncate flex-1">
                                                {eventLink}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copyToClipboard(eventLink, 'link')}
                                            >
                                                {copiedLink ? 'Copied!' : 'Copy Link'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Attendees / Tickets */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Attendees ({tickets.length})</h3>

                            {tickets.length === 0 ? (
                                <div className="text-center py-8">
                                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <p className="text-gray-400">No bookings yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                    {tickets.map((ticket) => (
                                        <div key={ticket._id} className="flex items-center justify-between p-4 bg-black/30 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-medium">
                                                    {ticket.user?.name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium">{ticket.user?.name || 'Unknown'}</p>
                                                    <p className="text-gray-500 text-sm">{ticket.user?.email || 'No email'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-white font-medium">{ticket.quantity} ticket{ticket.quantity > 1 ? 's' : ''}</p>
                                                <p className="text-gray-400 text-sm">{formatPrice(ticket.price)}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs ${ticket.isUsed ? 'bg-gray-500/20 text-gray-400' :
                                                ticket.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                {ticket.isUsed ? 'Used' : ticket.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Description / Edit Form */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">
                                {isEditMode ? 'Edit Event Details' : 'About this event'}
                            </h3>

                            {isEditMode ? (
                                <div className="space-y-4">
                                    {/* Name */}
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Event Name *</label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Description *</label>
                                        <textarea
                                            value={editForm.description}
                                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                            rows={4}
                                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                                        />
                                    </div>

                                    {/* Date & Time */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Start Date *</label>
                                            <input
                                                type="date"
                                                value={editForm.date}
                                                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">End Date</label>
                                            <input
                                                type="date"
                                                value={editForm.endDate}
                                                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Start Time *</label>
                                            <input
                                                type="time"
                                                value={editForm.startTime}
                                                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">End Time *</label>
                                            <input
                                                type="time"
                                                value={editForm.endTime}
                                                onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                                            />
                                        </div>
                                    </div>

                                    {/* Ticket Info */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Max Attendees</label>
                                            <input
                                                type="number"
                                                value={editForm.maxAttendees}
                                                onChange={(e) => setEditForm({ ...editForm, maxAttendees: parseInt(e.target.value) })}
                                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Ticket Price (₹)</label>
                                            <input
                                                type="number"
                                                value={editForm.ticketPrice}
                                                onChange={(e) => setEditForm({ ...editForm, ticketPrice: parseInt(e.target.value) })}
                                                disabled={editForm.ticketType === 'free'}
                                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
                                            />
                                        </div>
                                    </div>

                                    {/* Terms */}
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Terms & Conditions</label>
                                        <textarea
                                            value={editForm.termsAndConditions}
                                            onChange={(e) => setEditForm({ ...editForm, termsAndConditions: e.target.value })}
                                            rows={3}
                                            placeholder="Optional terms and conditions..."
                                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-400 leading-relaxed whitespace-pre-line">{event.description}</p>
                            )}
                        </div>

                        {/* Venue Details - Non-editable */}
                        {venue && typeof venue === 'object' && (
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-white">Venue Details</h3>
                                    <span className="text-xs text-gray-500 bg-gray-500/10 px-2 py-1 rounded">Non-editable</span>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-lg font-medium text-white">{venue.name}</h4>
                                        <p className="text-gray-400 text-sm mb-2">
                                            {venue.address?.street && `${venue.address.street}, `}
                                            {venue.address?.city}, {venue.address?.state}
                                        </p>
                                        {venue.capacity && (
                                            <p className="text-gray-500 text-sm">
                                                Capacity: {venue.capacity.min || 0} - {venue.capacity.max || 'N/A'} people
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tags */}
                        {event.tags && event.tags.length > 0 && (
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Tags</h3>
                                <div className="flex flex-wrap gap-2">
                                    {event.tags.map((tag, index) => (
                                        <span key={index} className="px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-sm">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Terms and Conditions */}
                        {(event as Event & { termsAndConditions?: string }).termsAndConditions && (
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Terms & Conditions</h3>
                                <p className="text-gray-400 leading-relaxed whitespace-pre-line text-sm">
                                    {(event as Event & { termsAndConditions?: string }).termsAndConditions}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-8 space-y-6">
                            {/* Event Info Card */}
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Event Info</h3>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Ticket Price</span>
                                        <span className={`font-semibold ${event.ticketPrice === 0 ? 'text-green-400' : 'text-white'}`}>
                                            {formatPrice(event.ticketPrice)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Event Type</span>
                                        <span className="text-white capitalize">{event.eventType}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Category</span>
                                        <span className="text-white capitalize">{event.category}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Status</span>
                                        <span className={`capitalize ${event.status === 'upcoming' ? 'text-green-400' :
                                            event.status === 'ongoing' ? 'text-blue-400' :
                                                'text-gray-400'
                                            }`}>{event.status}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                                <div className="space-y-3">
                                    <Button
                                        variant="secondary"
                                        className="w-full"
                                        onClick={() => copyToClipboard(eventLink, 'link')}
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                        </svg>
                                        Share Event
                                    </Button>
                                </div>
                            </div>

                            {/* Tags */}
                            {event.tags && event.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {event.tags.map((tag, index) => (
                                        <span key={index} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 text-sm">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Event Posts Section */}
            <div className="bg-black/40 backdrop-blur-sm border border-white/5 rounded-2xl p-6 mt-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-white">Event Posts</h3>
                    <Button onClick={() => setShowPostModal(true)}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New Post
                    </Button>
                </div>

                {posts.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <p>No posts yet. Create your first post to engage with attendees!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {posts.map((post: any) => (
                            <div key={post._id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <p className="text-white whitespace-pre-wrap flex-1">{post.content}</p>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => handleEditPost(post)}
                                            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeletePost(post._id)}
                                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                {post.images && post.images.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        {post.images.map((img: string, idx: number) => (
                                            <img key={idx} src={img} alt="" className="w-full h-24 object-cover rounded-lg" />
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                    <span>{post.likes?.length || 0} likes</span>
                                    <span>{post.comments?.length || 0} comments</span>
                                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Post Modal */}
            <Modal isOpen={showPostModal} onClose={resetPostForm} title={editingPost ? 'Edit Post' : 'Create Post'} size="md">
                <div className="space-y-4">
                    <textarea
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        placeholder="Share an update about your event..."
                        className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                    />

                    {postImagePreviews.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                            {postImagePreviews.map((preview, idx) => (
                                <div key={idx} className="relative">
                                    <img src={preview} alt="" className="w-full h-20 object-cover rounded-lg" />
                                    <button
                                        onClick={() => {
                                            setPostImagePreviews(prev => prev.filter((_, i) => i !== idx));
                                            setPostImages(prev => prev.filter((_, i) => i !== idx));
                                        }}
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <label className="flex items-center gap-2 text-gray-400 hover:text-white cursor-pointer transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Add Images</span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handlePostImageAdd}
                        />
                    </label>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={resetPostForm}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreatePost}
                            disabled={isCreatingPost || !postContent.trim()}
                        >
                            {isCreatingPost ? 'Posting...' : (editingPost ? 'Update Post' : 'Create Post')}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Cancel Event Modal */}
            <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancel Event" size="md">
                <div className="space-y-6">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <p className="text-red-400 font-medium">This action cannot be undone</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    Cancelling this event will notify all ticket holders and may trigger refunds based on your refund policy.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">
                            Reason for cancellation (optional)
                        </label>
                        <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Let attendees know why you're cancelling..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500 resize-none"
                            rows={3}
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => setShowCancelModal(false)}
                            disabled={cancelling}
                        >
                            Keep Event
                        </Button>
                        <Button
                            variant="primary"
                            className="flex-1 !bg-red-500 hover:!bg-red-600"
                            onClick={handleCancelEvent}
                            disabled={cancelling}
                        >
                            {cancelling ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Cancelling...
                                </span>
                            ) : (
                                'Cancel Event'
                            )}
                        </Button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
