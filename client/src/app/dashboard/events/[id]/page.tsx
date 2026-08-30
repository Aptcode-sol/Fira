'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import DiscountCodesSection from '@/components/dashboard/DiscountCodesSection';
import { Button, Modal } from '@/components/ui';
import { eventsApi, ticketsApi, uploadApi, clearRequestCache, type ScanningCode } from '@/lib/api';
import { openEditEvent } from '@/components/modals/CreateEventLauncher';
import { EVENT_SAVED } from '@/components/modals/CreateEventModal';
import { Event, User, Venue } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { formatDateTimeRange } from '@/lib/dateUtils';
import { formatInr } from '@/lib/formatInr';

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

    // Posts state
    const [posts, setPosts] = useState<any[]>([]);
    const [showPostModal, setShowPostModal] = useState(false);
    const [postContent, setPostContent] = useState('');
    const [postImages, setPostImages] = useState<File[]>([]);
    const [postImagePreviews, setPostImagePreviews] = useState<string[]>([]);
    // 11.10: already-uploaded image URLs kept for an edited post. Removing one
    // here persists the removal; new uploads (postImages) are added on top.
    const [existingImages, setExistingImages] = useState<string[]>([]);
    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [editingPost, setEditingPost] = useState<any>(null);
    const [postToDelete, setPostToDelete] = useState<string | null>(null);
    const [isDeletingPost, setIsDeletingPost] = useState(false);

    // Scanning Links state
    const [scanningCodes, setScanningCodes] = useState<ScanningCode[]>([]);
    const [copiedScanLink, setCopiedScanLink] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (params.id && isAuthenticated) {
            fetchEvent(params.id as string);
            fetchTickets(params.id as string);
            fetchScanningCodes(params.id as string);
        }
        // The event form opens as a modal over this page, so nothing remounts on save.
        const reload = () => params.id && fetchEvent(params.id as string);
        window.addEventListener(EVENT_SAVED, reload);
        return () => window.removeEventListener(EVENT_SAVED, reload);
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

    const fetchScanningCodes = async (eventId: string) => {
        try {
            const data = await eventsApi.getScanningCodes(eventId);
            setScanningCodes(data);
        } catch (error) {
            // Silently fail — user may not be the organizer
            console.error('Failed to fetch scanning codes:', error);
        }
    };

    /**
     * Revoke a link and replace it.
     *
     * Links are provisioned per tier by the server, so deactivating one is a rotation
     * rather than a deletion: refetching immediately issues a fresh link for that tier
     * and the revoked one stays listed as inactive.
     */
    const handleDeactivateCode = async (codeId: string) => {
        if (!event) return;
        try {
            await eventsApi.deactivateScanningCode(event._id, codeId);
            showToast('Link reset — copy the new one', 'success');
            // The refetch is what issues the replacement, so it must not be served
            // from the API client's 15s GET cache.
            clearRequestCache('/events');
            fetchScanningCodes(event._id);
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Failed to revoke link', 'error');
        }
    };

    const copyScanLink = (code: string) => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const link = `${baseUrl}/scan/${code}`;
        navigator.clipboard.writeText(link);
        setCopiedScanLink(code);
        setTimeout(() => setCopiedScanLink(null), 2000);
        showToast('Scanning link copied!', 'success');
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

    const formatPrice = (price: number) => (price === 0 ? 'Free' : formatINR(price));

    // 11.6: revenue must always show a rupee amount (₹0.00 when none), never "Free".
    const formatINR = formatInr;

    // 11.7: lowest configured tier price (falls back to ticketPrice when no tiers).
    const lowestTierPrice = (e: Event): number => {
        const tiers = e.ticketTiers ?? [];
        if (tiers.length === 0) return e.ticketPrice ?? 0;
        return Math.min(...tiers.map(t => t.price));
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
        setExistingImages([]);
        setEditingPost(null);
        setShowPostModal(false);
    };

    // Remove an image preview at index — maps back to either a kept existing
    // URL (first N previews) or a newly-added File so remove/replace persists.
    const handleRemovePostImage = (idx: number) => {
        if (idx < existingImages.length) {
            setExistingImages(prev => prev.filter((_, i) => i !== idx));
        } else {
            const fileIdx = idx - existingImages.length;
            setPostImages(prev => prev.filter((_, i) => i !== fileIdx));
        }
        setPostImagePreviews(prev => prev.filter((_, i) => i !== idx));
    };

    // Create or Update post
    const handleCreatePost = async () => {
        if (!params.id || !user?._id || !postContent.trim()) return;

        setIsCreatingPost(true);
        try {
            let uploadedUrls: string[] = [];
            if (postImages.length > 0) {
                const uploadPromises = postImages.map(file => uploadApi.single(file));
                const results = await Promise.all(uploadPromises);
                uploadedUrls = results.map((r: any) => r.url);
            }

            if (editingPost) {
                // 11.10: final images = kept existing URLs + newly uploaded ones,
                // so add/remove/replace in edit mode all persist (not text-only).
                await eventsApi.updatePost(params.id as string, editingPost._id, {
                    content: postContent,
                    images: [...existingImages, ...uploadedUrls],
                    userId: user._id
                });
            } else {
                const imageUrls = uploadedUrls;
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
        // 11.10: seed both the kept-URL list and the previews so existing
        // images can be removed/replaced, not just appended to.
        setExistingImages(post.images || []);
        setPostImages([]);
        setPostImagePreviews(post.images || []);
        setShowPostModal(true);
    };

    // Delete post — 11.11: confirm via in-app modal, not native confirm().
    const confirmDeletePost = async () => {
        if (!params.id || !user?._id || !postToDelete) return;
        setIsDeletingPost(true);
        try {
            await eventsApi.deletePost(params.id as string, postToDelete, user._id);
            fetchPosts();
            showToast('Post deleted', 'success');
            setPostToDelete(null);
        } catch (err) {
            showToast('Failed to delete post', 'error');
        } finally {
            setIsDeletingPost(false);
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
                        <p className="text-gray-300 mb-6">The event you&apos;re looking for doesn&apos;t exist.</p>
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
    // 11.6: revenue = Σ(ticketsBooked × price). `t.price` is the per-ticket
    // price, so multiply by quantity or multi-ticket bookings undercount.
    const totalRevenue = tickets.reduce((sum, t) => sum + t.price * t.quantity, 0);
    const eventLink = typeof window !== 'undefined' ? `${window.location.origin}/events/${event._id}` : '';

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="w-full md:w-auto">
                        <div className="flex items-center gap-3 mb-2">
                            <Link href="/dashboard/events" className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors bg-white/5 rounded-lg md:bg-transparent">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </Link>
                            <h1 className="text-2xl md:text-3xl font-bold text-white truncate">Manage Event</h1>
                        </div>
                        <p className="text-gray-300 text-sm md:text-base">View bookings and manage your event</p>
                    </div>
                    {/* justify-end: the row is w-full on mobile, so without it these sat
                        left-aligned under the subtitle and read as part of the heading
                        block rather than as actions. */}
                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 w-full md:w-auto">
                        <Link href={`/events/${event._id}`} target="_blank">
                            <Button variant="secondary" size="sm">
                                <span className="hidden sm:inline">View Public Page</span>
                                <span className="sm:hidden">View</span>
                            </Button>
                        </Link>
                        {event.status !== 'cancelled' && (
                            <>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => openEditEvent(event._id)}
                                >
                                    <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span className="hidden sm:inline">Edit</span>
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="!bg-red-500/20 !text-red-400 hover:!bg-red-500/30 !border-red-500/30"
                                    onClick={() => setShowCancelModal(true)}
                                >
                                    <span className="hidden sm:inline">Cancel Event</span>
                                    <span className="sm:hidden">Cancel</span>
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Hero Image — same height as the public event page, so the organizer
                    previews their cover at the size attendees actually see it. It was
                    h-44 (a listing-card height), which cropped a wide cover to a strip. */}
                <div className="relative h-[400px] md:h-[500px] rounded-2xl overflow-hidden mb-8 group">
                    {event.images && event.images.length > 0 ? (
                        <img src={event.images[0]} alt={event.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-500/30 to-pink-500/30 flex items-center justify-center">
                            <svg className="w-16 md:w-24 h-16 md:h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                        {event.eventType === 'private' && (
                            <span className="px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-violet-500/40 backdrop-blur-md border border-violet-500/30 text-violet-100 text-[10px] md:text-sm font-medium flex items-center gap-1.5">
                                <svg className="w-3 md:w-4 h-3 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Private
                            </span>
                        )}
                        <span className="px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] md:text-sm capitalize font-medium border border-white/10">
                            {event.category}
                        </span>
                        <span className={`px-2 md:px-3 py-1 md:py-1.5 rounded-full backdrop-blur-md text-[10px] md:text-sm capitalize font-medium border ${event.status === 'upcoming' ? 'bg-green-500/40 text-green-100 border-green-500/30' :
                            event.status === 'ongoing' ? 'bg-blue-500/40 text-blue-100 border-blue-500/30' :
                                event.status === 'completed' ? 'bg-gray-500/40 text-gray-100 border-gray-500/30' :
                                    'bg-red-500/40 text-red-100 border-red-500/30'
                            }`}>
                            {event.status}
                        </span>
                    </div>

                    {/* Date/Time Range Banner */}
                    <div className="absolute bottom-4 left-4 right-4 md:right-auto px-4 py-3 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 shadow-2xl">
                        <div className="text-white text-sm md:text-lg font-semibold text-center md:text-left">
                            {formatDateTimeRange(event.startDateTime, event.endDateTime)}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Title */}
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{event.name}</h2>
                            {venue && typeof venue === 'object' && (
                                <p className="text-gray-300 flex items-center gap-2">
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
                                <div className="text-gray-300 text-sm">Tickets Sold</div>
                            </div>
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4">
                                <div className="text-2xl font-bold text-white">{spotsLeft}</div>
                                <div className="text-gray-300 text-sm">Spots Left</div>
                            </div>
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4">
                                <div className="text-2xl font-bold text-green-400">{formatINR(totalRevenue)}</div>
                                <div className="text-gray-300 text-sm">Total Revenue</div>
                            </div>
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4">
                                <div className="text-2xl font-bold text-white">{event.maxAttendees}</div>
                                <div className="text-gray-300 text-sm">Max Capacity</div>
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
                                <p className="text-gray-300 text-sm mb-4">Share these details with your invited guests only.</p>

                                <div className="space-y-4">
                                    {/* Access Code */}
                                    <div className="bg-black/30 rounded-xl p-4">
                                        <div className="text-gray-300 text-xs mb-1">Access Code</div>
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
                                        <div className="text-gray-300 text-xs mb-1">Event Link</div>
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

                        {/* Scanning Links */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                                Scanning Links
                            </h3>
                            <p className="text-gray-300 text-sm mb-4">
                                One link per ticket tier. Share it with whoever works that door — they
                                open it on their own phone, no sign-in. It admits that tier only.
                            </p>

                            {/* No generate step: the server issues a link for every tier, so
                                there is nothing to decide here - just find the tier and copy.
                                Only active links are listed; a revoked one is replaced rather
                                than left as a dead row the organiser has to reason about. */}
                            {scanningCodes.filter(sc => sc.isActive).length === 0 ? (
                                <div className="text-center py-6">
                                    <p className="text-gray-400 text-sm">No scanner links yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {scanningCodes.filter(sc => sc.isActive).map((sc) => (
                                        <div key={sc._id} className="flex items-center gap-3 bg-black/30 rounded-xl p-3 border border-white/5">
                                            <span className="text-white font-medium text-sm truncate flex-1 min-w-0">
                                                {/* Only shows on an event with no tiers -
                                                    once tiers exist, every live link is
                                                    scoped to one. */}
                                                {sc.ticketTier || 'All tickets'}
                                            </span>
                                            <button
                                                onClick={() => copyScanLink(sc.code)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-xs font-medium text-violet-300 transition-colors flex-shrink-0"
                                            >
                                                {copiedScanLink === sc.code ? (
                                                    <span className="text-green-400">Copied</span>
                                                ) : (
                                                    <>
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                        Copy link
                                                    </>
                                                )}
                                            </button>
                                            {/* Revoking issues a replacement, so this is a rotation -
                                                the wording says so rather than implying the tier is
                                                left without a door. */}
                                            <button
                                                onClick={() => handleDeactivateCode(sc._id)}
                                                className="text-xs text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
                                                title="Revoke this link and issue a new one"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Discount Codes */}
                        {/* eventEnd is display only - the server derives the code's
                            validity window from the event itself. */}
                        <DiscountCodesSection eventId={event._id} eventEnd={event.endDateTime} />

                        {/* Attendees / Tickets */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Attendees ({tickets.length})</h3>

                            {tickets.length === 0 ? (
                                <div className="text-center py-8">
                                    <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <p className="text-gray-300">No bookings yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                    {tickets.map((ticket) => (
                                        <div key={ticket._id} className="flex flex-wrap items-center gap-3 p-4 bg-black/30 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-medium flex-shrink-0">
                                                    {ticket.user?.name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-white font-medium truncate">{ticket.user?.name || 'Unknown'}</p>
                                                    <p className="text-gray-300 text-sm truncate">{ticket.user?.email || 'No email'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 ml-auto">
                                                <div className="text-right">
                                                    <p className="text-white font-medium text-sm">{ticket.quantity} ticket{ticket.quantity > 1 ? 's' : ''}</p>
                                                    <p className="text-gray-300 text-xs">{formatPrice(ticket.price)}</p>
                                                </div>
                                                <span className={`px-2 py-1 rounded text-xs whitespace-nowrap flex-shrink-0 ${ticket.isUsed ? 'bg-gray-500/20 text-gray-300' :
                                                    ticket.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                                        'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {ticket.isUsed ? 'Used' : ticket.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">About this event</h3>
                            <p className="text-gray-300 leading-relaxed whitespace-pre-line">{event.description}</p>
                        </div>


                        {/* Venue Details - Non-editable */}
                        {venue && typeof venue === 'object' && (
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-white">Venue Details</h3>
                                    <span className="text-xs text-gray-300 bg-gray-500/10 px-2 py-1 rounded">Non-editable</span>
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
                                        <p className="text-gray-300 text-sm mb-2">
                                            {venue.address?.street && `${venue.address.street}, `}
                                            {venue.address?.city}, {venue.address?.state}
                                        </p>
                                        {venue.capacity && (
                                            <p className="text-gray-300 text-sm">
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
                                <p className="text-gray-300 leading-relaxed whitespace-pre-line text-sm">
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
                                    {/* 11.7: show the lowest tier price as "from ₹X onwards". */}
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-300">Ticket Price</span>
                                        <span className={`font-semibold ${lowestTierPrice(event) === 0 ? 'text-green-400' : 'text-white'}`}>
                                            {lowestTierPrice(event) === 0
                                                ? 'Free'
                                                : `from ${formatINR(lowestTierPrice(event))} onwards`}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-300">Event Type</span>
                                        <span className="text-white capitalize">{event.eventType}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-300">Category</span>
                                        <span className="text-white capitalize">{event.category}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-300">Status</span>
                                        <span className={`capitalize ${event.status === 'upcoming' ? 'text-green-400' :
                                            event.status === 'ongoing' ? 'text-blue-400' :
                                                'text-gray-300'
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
                                        <span key={index} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 text-sm">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Event Posts Section
                This sits OUTSIDE the page's `p-6 lg:p-8` wrapper (that closes
                just above), so it needs its own horizontal margin - without it
                the card ran flush to both screen edges on mobile. */}
            <div className="bg-black/40 backdrop-blur-sm border border-white/5 rounded-2xl p-4 sm:p-6 mt-8 mx-6 lg:mx-8 mb-8">
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
                    <div className="text-center py-12 text-gray-300">
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
                                            onClick={() => setPostToDelete(post._id)}
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
                                <div className="flex items-center gap-4 text-sm text-gray-300">
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
                                        onClick={() => handleRemovePostImage(idx)}
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

            {/* Delete Post Confirmation — 11.11: in-app modal, not native confirm(). */}
            <Modal isOpen={!!postToDelete} onClose={() => !isDeletingPost && setPostToDelete(null)} title="Delete Post" size="sm">
                <div className="space-y-6">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-sm text-gray-300">
                                Are you sure you want to delete this post? This action cannot be undone.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => setPostToDelete(null)}
                            disabled={isDeletingPost}
                        >
                            Keep Post
                        </Button>
                        <Button
                            variant="primary"
                            className="flex-1 !bg-red-500 hover:!bg-red-600"
                            onClick={confirmDeletePost}
                            disabled={isDeletingPost}
                        >
                            {isDeletingPost ? 'Deleting...' : 'Delete Post'}
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
                                <p className="text-sm text-gray-300 mt-1">
                                    Cancelling this event will notify all ticket holders and may trigger refunds based on your refund policy.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-300 mb-2">
                            Reason for cancellation (optional)
                        </label>
                        <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Let attendees know why you're cancelling..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-300 focus:outline-none focus:border-red-500 resize-none"
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
