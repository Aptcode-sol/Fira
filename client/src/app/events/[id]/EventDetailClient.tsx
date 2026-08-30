'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { BackButton, ShareButton, Button, Modal, Input } from '@/components/ui';
import { eventsApi, ticketsApi, uploadApi } from '@/lib/api';
import Link from 'next/link';
import { formatSingleDateTime } from '@/lib/dateUtils';
import { Event, User, Venue } from '@/lib/types';
import { organizerIdentity } from '@/lib/organizerIdentity';
import { formatInr } from '@/lib/formatInr';
import { useAuth } from '@/contexts/AuthContext';
import PostCard from '@/components/PostCard';
import { useToast } from '@/components/ui/Toast';
import TicketDisplay from '@/components/TicketDisplay';
import BillingCard from '@/components/BillingCard';
import DiscountCodeInput from '@/components/DiscountCodeInput';
import InquiryForm from '@/components/InquiryForm';
import { paymentsApi } from '@/lib/api'; // Add paymentsApi import

/**
 * How long the purchased-ticket confirmation stays on screen before we navigate
 * to the tickets dashboard. Slightly longer than the venue flow because there
 * is an actual ticket + QR code to look at here.
 */
const SUCCESS_REDIRECT_DELAY_MS = 4000;

/**
 * `initialEvent` is the same document the server already fetched for this page's
 * metadata and JSON-LD (cached per request, so seeding costs nothing extra).
 *
 * Without it this component mounted with `event: null` and `isLoading: true`, so the
 * HTML a crawler receives was two skeleton divs and no <h1> - the event name, date,
 * price and description existed only in <title> and ld+json. Every event URL served
 * the same ~450 bytes of navbar and footer text, which is why Search Console had them
 * as "Discovered - currently not indexed" and picked a different canonical for one:
 * from the outside they were indistinguishable pages.
 */
export default function EventDetailClient({ initialEvent = null }: { initialEvent?: Event | null }) {
    const params = useParams();
    const router = useRouter();
    const { isAuthenticated, user } = useAuth();
    const { showToast } = useToast();
    const [event, setEvent] = useState<Event | null>(initialEvent);
    // Only show the skeleton when there is genuinely nothing to show. The refetch
    // below still runs - it returns viewer-specific fields the anonymous server read
    // cannot see - but it refreshes in place instead of blanking the page.
    const [isLoading, setIsLoading] = useState(!initialEvent);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [isPrivateCodeModalOpen, setIsPrivateCodeModalOpen] = useState(false);
    const [ticketQuantity, setTicketQuantity] = useState(1);
    // Index into event.ticketTiers of the tier the buyer selected (null = no tiers / general admission).
    const [selectedTierIndex, setSelectedTierIndex] = useState<number | null>(null);
    const [privateCode, setPrivateCode] = useState('');
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [purchasedTicket, setPurchasedTicket] = useState<any>(null);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isTermsExpanded, setIsTermsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState('about');
    const [posts, setPosts] = useState<any[]>([]);

    // Post creation state
    const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
    const [newPostContent, setNewPostContent] = useState('');
    const [newPostImages, setNewPostImages] = useState<string[]>([]);
    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isUploadingGalleryImage, setIsUploadingGalleryImage] = useState(false);

    // Discount code state
    const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);

    // Inquiry modal state
    const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);

    useEffect(() => {
        if (params.id) {
            fetchEvent(params.id as string);
        }
    }, [params.id]);

    const fetchEvent = async (id: string) => {
        try {
            // Not `setIsLoading(true)` when the server already supplied the event -
            // that would throw the rendered page away and flash the skeleton on every
            // mount, which is the opposite of the point.
            const data = await eventsApi.getById(id);
            setEvent(data as Event);
        } catch (error) {
            console.error('Failed to fetch event:', error);
            // Keep whatever the server rendered rather than replacing a real event
            // with mock data because a background refresh failed.
            setEvent(prev => prev ?? getMockEvent(id));
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch event posts
    const fetchPosts = async () => {
        if (!params.id) return;
        try {
            const result = await eventsApi.getPosts(params.id as string) as { posts: any[] };
            setPosts(result.posts || []);
        } catch (error) {
            console.error('Failed to fetch event posts:', error);
        }
    };

    useEffect(() => {
        if (params.id && event) {
            fetchPosts();
        }
    }, [params.id, event]);

    const handleGetTickets = () => {
        if (!isAuthenticated) {
            showToast('Please sign in to get tickets', 'warning');
            router.push('/signin');
            return;
        }

        if (event?.eventType === 'private') {
            setIsPrivateCodeModalOpen(true);
        } else {
            setIsTicketModalOpen(true);
        }
    };

    const submitPrivateCode = () => {
        if (privateCode === event?.privateCode) {
            setIsPrivateCodeModalOpen(false);
            setIsTicketModalOpen(true);
        } else {
            showToast('Invalid access code', 'error');
        }
    };

    const loadRazorpay = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const purchaseTickets = async () => {
        if (!user?._id || !event?._id) return;

        /*
         * Which tier the buyer picked, by name.
         *
         * This used to be hardcoded to 'general' no matter what the tier picker above
         * showed, so every ticket was issued as general admission at the event's base
         * price - the tiers were decorative, and a VIP buyer was charged the cheapest
         * tier's price. The name is what the ticket records and what a tier-scoped
         * door scanner matches against, so it has to be the real selection.
         */
        const tiers = event.ticketTiers ?? [];
        if (tiers.length > 0 && selectedTierIndex === null) {
            showToast('Please select a ticket tier', 'error');
            return;
        }
        const ticketType = tiers.length > 0 ? tiers[selectedTierIndex!].name : 'general';

        // Start purchase flow
        setIsPurchasing(true);
        try {
            // 1. Initiate purchase request
            const result = await ticketsApi.purchase({
                userId: user._id,
                eventId: event._id,
                quantity: ticketQuantity,
                ticketType
            });

            // 2. Handle Payment Flow (keeping for future when payments are enabled)
            if (result.paymentRequired && result.paymentData) {
                const isLoaded = await loadRazorpay();
                if (!isLoaded) {
                    showToast('Razorpay SDK failed to load. Are you online?', 'error');
                    setIsPurchasing(false);
                    return;
                }

                const options = {
                    key: result.paymentData.keyId,
                    amount: result.paymentData.amount,
                    currency: result.paymentData.currency,
                    name: "Firaa Events",
                    description: `Tickets for ${event.name}`,
                    order_id: result.paymentData.gatewayOrderId,
                    handler: async function (response: any) {
                        try {
                            const verifyResult = await paymentsApi.verifyPayment({
                                paymentId: result.paymentData.payment._id,
                                gatewayOrderId: response.razorpay_order_id,
                                gatewayPaymentId: response.razorpay_payment_id,
                                gatewaySignature: response.razorpay_signature
                            }) as { success: boolean; payment?: any };

                            if (verifyResult.success) {
                                showToast('Payment successful!', 'success');

                                // Call purchase again to confirm/fetch ticket if needed, or if the backend created it on verify
                                // Optimization: backend's verifyPayment returns { success: true, payment }. 
                                // ticketService needs to finalize the ticket creation.
                                // NOTE: In my implementation, ticketService returns EARLY if payment is required.
                                // We need to call ticketsApi.purchase AGAIN with the paymentId to actually CREATE the ticket.

                                const finalTicketResult = await ticketsApi.purchase({
                                    userId: user._id,
                                    eventId: event._id!,
                                    // Same tier as the payment was priced for. Sending
                                    // 'general' here would have issued a general ticket
                                    // against a VIP charge.
                                    ticketType,
                                    quantity: ticketQuantity,
                                    paymentId: result.paymentData.payment._id
                                });

                                setPurchasedTicket(finalTicketResult.ticket);
                                setIsTicketModalOpen(false);
                                fetchEvent(event._id!); // Refresh spots
                                // The purchased-ticket modal opens off
                                // `purchasedTicket`; redirecting immediately
                                // closed it before the buyer ever saw the ticket
                                // they just paid for.
                                setTimeout(() => router.push('/dashboard/tickets'), SUCCESS_REDIRECT_DELAY_MS);
                            } else {
                                showToast('Payment verification failed', 'error');
                            }
                        } catch (err: any) {
                            console.error(err);
                            showToast(err.message || 'Payment verification failed', 'error');
                        } finally {
                            setIsPurchasing(false);
                        }
                    },
                    prefill: {
                        name: user.name,
                        email: user.email,
                        contact: user.phone || ''
                    },
                    theme: {
                        color: "#8b5cf6"
                    },
                    modal: {
                        ondismiss: function () {
                            setIsPurchasing(false);
                        }
                    }
                };

                const paymentObject = new (window as any).Razorpay(options);
                paymentObject.open();

            } else if (result.ticket) {
                // Free ticket path
                setPurchasedTicket(result.ticket);
                showToast(`${ticketQuantity} ticket(s) booked successfully!`, 'success');
                setIsTicketModalOpen(false);
                fetchEvent(event._id);
                setIsPurchasing(false);
                setTimeout(() => router.push('/dashboard/tickets'), SUCCESS_REDIRECT_DELAY_MS);
            }
        } catch (err: unknown) {
            const error = err as { message?: string };
            showToast(error.message || 'Failed to purchase tickets', 'error');
            setIsPurchasing(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatPrice = (price: number) => (price === 0 ? 'Free' : formatInr(price));

    // Check if current user is the event organizer
    const isOrganizer = user?._id && event?.organizer &&
        (typeof event.organizer === 'object'
            ? (event.organizer as User)._id === user._id
            : event.organizer === user._id);

    // Handle image upload for posts
    const handlePostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingImage(true);
        try {
            const result = await uploadApi.single(file, 'posts') as { url: string };
            setNewPostImages(prev => [...prev, result.url]);
            showToast('Image uploaded successfully', 'success');
        } catch (error) {
            showToast('Failed to upload image', 'error');
        } finally {
            setIsUploadingImage(false);
        }
    };

    // Create a new post
    const handleCreatePost = async () => {
        if (!newPostContent.trim() || !user?._id || !event?._id) {
            showToast('Please write something for your post', 'warning');
            return;
        }

        setIsCreatingPost(true);
        try {
            await eventsApi.createPost(event._id, {
                content: newPostContent,
                images: newPostImages,
                userId: user._id
            });
            showToast('Post created! Ticket holders have been notified.', 'success');
            setNewPostContent('');
            setNewPostImages([]);
            setIsCreatePostModalOpen(false);
            fetchPosts(); // Refresh posts
        } catch (error: any) {
            showToast(error?.message || 'Failed to create post', 'error');
        } finally {
            setIsCreatingPost(false);
        }
    };

    // Handle gallery image upload
    const handleGalleryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !event?._id) return;

        setIsUploadingGalleryImage(true);
        try {
            const uploadedUrls: string[] = [];

            for (let i = 0; i < files.length; i++) {
                const result = await uploadApi.single(files[i], 'events') as { url: string };
                uploadedUrls.push(result.url);
            }

            // Update event with new images
            const updatedImages = [...(event.images || []), ...uploadedUrls];
            await eventsApi.update(event._id, { images: updatedImages });

            showToast(`${uploadedUrls.length} photo(s) added to gallery!`, 'success');
            fetchEvent(event._id); // Refresh event to show new images
        } catch (error) {
            showToast('Failed to upload image', 'error');
        } finally {
            setIsUploadingGalleryImage(false);
            // Reset the input
            e.target.value = '';
        }
    };

    if (isLoading) {
        return (
            <>
                <PartyBackground />
                <Navbar />
                <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                    <div className="max-w-6xl mx-auto animate-pulse">
                        <div className="h-96 bg-white/5 rounded-2xl mb-8" />
                        <div className="h-8 bg-white/5 rounded w-1/3 mb-4" />
                        <div className="h-4 bg-white/5 rounded w-full mb-2" />
                    </div>
                </main>
            </>
        );
    }

    if (!event) {
        return (
            <>
                <PartyBackground />
                <Navbar />
                <main className="relative z-20 min-h-screen pt-28 pb-16 px-4 flex items-center justify-center">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white mb-2">Event not found</h1>
                        <p className="text-gray-300 mb-6">The event you&apos;re looking for doesn&apos;t exist.</p>
                        <Button onClick={() => router.push('/events')}>Browse Events</Button>
                    </div>
                </main>
            </>
        );
    }

    // Shared with EventCard so the two cannot disagree about who hosts an event.
    const host = organizerIdentity(event);
    const venue = event.venue as Venue;
    const spotsLeft = event.maxAttendees - event.currentAttendees;

    // ponytail: check if all ticket tiers are sold out (Requirement 5.5)
    const isTiersSoldOut = event.ticketTiers && event.ticketTiers.length > 0
        ? event.ticketTiers.every(tier => tier.soldCount >= tier.maxQuantity)
        : false;
    const isSoldOut = isTiersSoldOut || spotsLeft <= 0;

    /**
     * Nothing left to buy: cancelled, marked completed, or already started.
     *
     * Derived once because both the mobile action row and the sidebar panel render a
     * ticket CTA - inlining the condition twice is how the two end up disagreeing
     * about whether an event is still open.
     */
    const hasEnded =
        event.status === 'completed' ||
        event.status === 'cancelled' ||
        new Date(event.startDateTime) < new Date();

    /** The CTA label, shared by both placements. */
    const ticketCtaLabel = event.ticketPrice === 0 ? 'Register for Free' : 'Get Tickets';

    return (
        <>
            <PartyBackground />
            <Navbar />

            <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* The only way off this page was the browser's own back gesture.
                        Falls back to the events list when opened from a shared link.
                        Share sits opposite it - these pages are what actually gets
                        passed around, and copying from the address bar is not a thing
                        anyone does on a phone. */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <BackButton fallbackHref="/events" label="Back to Events" />
                        <ShareButton title={event.name} text={`Check out ${event.name} on FIRA`} />
                    </div>

                    {/* Hero Image */}
                    <div className="relative h-[400px] md:h-[500px] rounded-2xl overflow-hidden mb-8">
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
                        </div>

                        {/* Date/Time Range Banner */}
                        <div className="absolute bottom-4 left-4 px-4 py-3 rounded-xl bg-black/70 backdrop-blur-sm border border-white/10">
                            <div className="text-violet-400 text-sm font-medium">
                                {formatSingleDateTime(event.startDateTime)}
                            </div>
                            <div className="text-white text-lg font-semibold">
                                to {formatSingleDateTime(event.endDateTime)}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Content */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Title */}
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">{event.name}</h1>

                                {/* Host: the brand the event is run under, falling back
                                    to the personal account. Unlike the card, this page is
                                    not itself a link, so the brand name can link through
                                    to the creator profile. */}
                                {host && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 flex-shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-medium">
                                            {host.photo ? (
                                                <img src={host.photo} alt={host.name} className="w-full h-full object-cover" />
                                            ) : (
                                                host.name?.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                {host.href ? (
                                                    <Link href={host.href} className="text-white font-medium hover:text-violet-300 transition-colors truncate">
                                                        {host.name}
                                                    </Link>
                                                ) : (
                                                    <span className="text-white font-medium truncate">{host.name}</span>
                                                )}
                                                {host.verified && (
                                                    <svg className="w-5 h-5 flex-shrink-0 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="text-gray-300 text-sm">Event Organizer</span>
                                        </div>
                                    </div>
                                )}

                                {/* Mobile action row, mirroring the venue page.
                                    The ticket panel is a sidebar on desktop but stacks to
                                    the very bottom on mobile, so the only way to buy was
                                    to scroll past the description, venue, tabs and
                                    gallery first. This puts the CTA directly under the
                                    event title with the price beside it; the bottom panel
                                    stays for anyone who reads the whole page. */}
                                <div className="flex items-center gap-3 mt-4 lg:hidden">
                                    <div className="flex-shrink-0">
                                        <span className={`text-xl font-bold ${event.ticketPrice === 0 ? 'text-green-400' : 'text-white'}`}>
                                            {formatPrice(event.ticketPrice)}
                                        </span>
                                        {event.ticketPrice > 0 && (
                                            <span className="text-gray-300 text-xs ml-1">/ ticket</span>
                                        )}
                                    </div>
                                    {hasEnded ? (
                                        <Button className="flex-1" disabled>
                                            Event {event.status === 'cancelled' ? 'Cancelled' : 'Ended'}
                                        </Button>
                                    ) : isSoldOut ? (
                                        <Button className="flex-1" disabled>
                                            Sold Out
                                        </Button>
                                    ) : (
                                        <Button className="flex-1" onClick={handleGetTickets}>
                                            {ticketCtaLabel}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-6 border-b border-white/10">
                                {['about', 'posts', 'gallery'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`pb-3 px-2 text-lg font-medium capitalize transition-all ${activeTab === tab
                                            ? 'text-violet-400 border-b-2 border-violet-400'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* About Tab */}
                            {activeTab === 'about' && (
                                <>
                                    {/* Description */}
                                    <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                        <h2 className="text-xl font-semibold text-white mb-4">About this event</h2>
                                        <div className="relative">
                                            <p className={`text-gray-300 leading-relaxed whitespace-pre-line ${!isDescriptionExpanded ? 'line-clamp-3' : ''}`}>
                                                {event.description}
                                            </p>
                                            {event.description && event.description.length > 200 && (
                                                <button
                                                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                                    className="mt-2 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
                                                >
                                                    {isDescriptionExpanded ? 'Show less' : 'Read more'}
                                                </button>
                                            )}
                                        </div>
                                    </div>



                                    {/* Venue / Custom Venue Info */}
                                    {(venue && typeof venue === 'object') ? (
                                        <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                            <h2 className="text-xl font-semibold text-white mb-4">Venue</h2>
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-medium text-white">{venue.name}</h3>
                                                    <p className="text-gray-300 text-sm">{venue.address?.city}, {venue.address?.state}</p>
                                                    {(venue as any).locationLink && (
                                                        <a
                                                            href={(venue as any).locationLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 text-xs hover:bg-violet-500/30"
                                                        >
                                                            Open in Maps
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14" />
                                                            </svg>
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : ((event as any).customVenue ? (
                                        <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                            <h2 className="text-xl font-semibold text-white mb-4">Custom Venue</h2>
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-medium text-white">{(event as any).customVenue?.name}</h3>
                                                    <p className="text-gray-300 text-sm">{(event as any).customVenue?.city}</p>
                                                    {(event as any).customVenue?.locationLink && (
                                                        <a
                                                            href={(event as any).customVenue.locationLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 text-xs hover:bg-violet-500/30"
                                                        >
                                                            Open in Maps
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14" />
                                                            </svg>
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : null)}

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

                                    {/* Terms and Conditions */}
                                    {(event as Event & { termsAndConditions?: string }).termsAndConditions && (
                                        <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                            <h2 className="text-xl font-semibold text-white mb-4">Terms & Conditions</h2>
                                            <div className="relative">
                                                <p className={`text-gray-300 leading-relaxed whitespace-pre-line text-sm ${!isTermsExpanded ? 'line-clamp-3' : ''}`}>
                                                    {(event as Event & { termsAndConditions?: string }).termsAndConditions}
                                                </p>
                                                {(event as Event & { termsAndConditions?: string }).termsAndConditions!.length > 150 && (
                                                    <button
                                                        onClick={() => setIsTermsExpanded(!isTermsExpanded)}
                                                        className="mt-2 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
                                                    >
                                                        {isTermsExpanded ? 'Show less' : 'Read more'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Posts Tab */}
                            {activeTab === 'posts' && (
                                <div className="space-y-6">
                                    {/* Create Post Button - Organizer Only */}
                                    {isOrganizer && (
                                        <button
                                            onClick={() => setIsCreatePostModalOpen(true)}
                                            className="w-full p-4 border-2 border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-violet-500/50 transition-all flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Create a Post
                                        </button>
                                    )}

                                    {posts.length === 0 ? (
                                        <div className="text-center py-20 text-gray-300">
                                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                                            </svg>
                                            <p>No posts yet for this event</p>
                                            {isOrganizer && <p className="text-sm mt-2">Share updates with your ticket holders!</p>}
                                        </div>
                                    ) : (
                                        posts.map(post => <PostCard key={post._id} post={post} type="event" parentId={params.id as string} />)
                                    )}
                                </div>
                            )}

                            {/* Gallery Tab */}
                            {activeTab === 'gallery' && (
                                <div className="space-y-6">
                                    {/* Add Photos Button - Organizer Only */}
                                    {isOrganizer && (
                                        <label className="w-full p-4 border-2 border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-violet-500/50 transition-all flex items-center justify-center gap-2 cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={handleGalleryImageUpload}
                                                className="hidden"
                                                disabled={isUploadingGalleryImage}
                                            />
                                            {isUploadingGalleryImage ? (
                                                <>
                                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    Add Photos to Gallery
                                                </>
                                            )}
                                        </label>
                                    )}

                                    {event.images && event.images.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {event.images.map((image, index) => (
                                                <div
                                                    key={index}
                                                    className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer"
                                                    onClick={() => window.open(image, '_blank')}
                                                >
                                                    <img
                                                        src={image}
                                                        alt={`${event.name} - Image ${index + 1}`}
                                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                                    />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-20 text-gray-300">
                                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p>No gallery images yet for this event</p>
                                            {isOrganizer && <p className="text-sm mt-2">Add photos to share event moments!</p>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Sidebar - Ticket Card */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-28 bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                {/* Price */}
                                <div className="mb-6">
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-3xl font-bold ${event.ticketPrice === 0 ? 'text-green-400' : 'text-white'}`}>
                                            {formatPrice(event.ticketPrice)}
                                        </span>
                                        {event.ticketPrice > 0 && <span className="text-gray-300">per ticket</span>}
                                    </div>
                                </div>

                                {/* Quick Info */}
                                <div className="space-y-4 mb-6 pb-6 border-b border-white/10">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-300">From</span>
                                        <span className="text-white text-right">{formatSingleDateTime(event.startDateTime)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-300">To</span>
                                        <span className="text-white text-right">{formatSingleDateTime(event.endDateTime)}</span>
                                    </div>
                                    {/* No "Spots Left" row. Publishing the remaining
                                        count also publishes how many have sold, and on a
                                        new listing "480 / 500" reads as nobody is going.
                                        spotsLeft still gates the Sold Out state and the
                                        per-purchase cap below - it is enforced, just not
                                        advertised. */}
                                </div>

                                {hasEnded ? (
                                    <Button className="w-full" size="lg" disabled>
                                        Event {event.status === 'cancelled' ? 'Cancelled' : 'Ended'}
                                    </Button>
                                ) : isSoldOut ? (
                                    <>
                                        <span className="block w-full text-center px-4 py-2 mb-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-semibold">
                                            Sold Out
                                        </span>
                                        <Button className="w-full" size="lg" disabled>
                                            Sold Out
                                        </Button>
                                    </>
                                ) : (
                                    <Button className="w-full" size="lg" onClick={handleGetTickets}>
                                        {ticketCtaLabel}
                                    </Button>
                                )}

                                {event.eventType === 'private' && (
                                    <p className="text-xs text-gray-300 text-center mt-4">
                                        This is a private event. You&apos;ll need an access code to register.
                                    </p>
                                )}

                                {/* Ask a Question button */}
                                <button
                                    onClick={() => setIsInquiryModalOpen(true)}
                                    className="w-full mt-4 text-sm text-violet-400 hover:text-violet-300 transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.065 2.386-1.772 3.772-1.772 1.928 0 3.5 1.21 3.5 2.772 0 1.561-1.572 2.772-3.5 2.772-.969 0-1.839-.258-2.438-.698M12 17h.01" />
                                    </svg>
                                    Ask a Question
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Private Code Modal */}
            <Modal
                isOpen={isPrivateCodeModalOpen}
                onClose={() => setIsPrivateCodeModalOpen(false)}
                title="Enter Access Code"
            >
                <div className="space-y-4">
                    <p className="text-gray-300">This is a private event. Please enter the access code provided by the organizer.</p>
                    <Input
                        placeholder="Enter access code"
                        value={privateCode}
                        onChange={(e) => setPrivateCode(e.target.value.toUpperCase())}
                    />
                    <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1" onClick={() => setIsPrivateCodeModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button className="flex-1" onClick={submitPrivateCode}>
                            Submit
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Ticket Purchase Modal */}
            <Modal
                isOpen={isTicketModalOpen}
                onClose={() => { setIsTicketModalOpen(false); setAppliedDiscount(null); }}
                title="Get Tickets"
                size="md"
            >
                {(() => {
                    // Tiers available on this event (may be empty -> general admission).
                    const tiers = event.ticketTiers ?? [];
                    const hasTiers = tiers.length > 0;
                    const selectedTier = hasTiers && selectedTierIndex !== null ? tiers[selectedTierIndex] : null;
                    // Remaining seats for the chosen tier; falls back to the event's spotsLeft
                    // when there are no tiers (general admission).
                    const tierRemaining = selectedTier
                        ? Math.max(0, selectedTier.maxQuantity - selectedTier.soldCount)
                        : spotsLeft;
                    // Per-purchase ceiling: never exceed the hard cap of 10, the seats left,
                    // or the selected tier's remaining. This is the 11.2 quantity cap.
                    const perPurchaseMax = Math.max(1, Math.min(10, spotsLeft, tierRemaining));
                    const atLimit = ticketQuantity >= perPurchaseMax;
                    // Price shown for the active selection.
                    const activePrice = selectedTier ? selectedTier.price : event.ticketPrice;
                    return (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">{event.name}</h3>
                        <p className="text-gray-300 text-sm">{formatSingleDateTime(event.startDateTime)}</p>
                    </div>

                    {/* Ticket tiers (11.8): list the available tiers so the buyer can pick one. */}
                    {hasTiers && (
                        <div className="space-y-2">
                            <span className="text-gray-300 text-sm">Select a ticket tier</span>
                            {tiers.map((tier, index) => {
                                const remaining = Math.max(0, tier.maxQuantity - tier.soldCount);
                                const soldOut = remaining <= 0;
                                // 11.3: match the tick by the tier's own index, not a
                                // mismatched key, so the correct tier shows selected.
                                const isSelected = selectedTierIndex === index;
                                return (
                                    <button
                                        key={index}
                                        type="button"
                                        disabled={soldOut}
                                        onClick={() => {
                                            setSelectedTierIndex(index);
                                            setTicketQuantity(1);
                                        }}
                                        className={`w-full p-4 rounded-xl border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isSelected
                                            ? 'bg-violet-500/20 border-violet-500 text-white'
                                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="font-medium">{tier.name}</div>
                                                {tier.description && (
                                                    <div className="text-xs text-gray-400 mt-0.5">{tier.description}</div>
                                                )}
                                                {/* Sold out is a state you must see - the
                                                    tier is unselectable. The remaining
                                                    count is not: it leaked how many of
                                                    each tier had sold. `remaining` still
                                                    caps the quantity stepper below. */}
                                                {soldOut && (
                                                    <div className="text-xs text-gray-400 mt-0.5">Sold out</div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-semibold whitespace-nowrap">{formatPrice(tier.price)}</span>
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${isSelected ? 'bg-violet-500 text-white' : 'bg-white/10 text-transparent'}`}>
                                                    {isSelected ? '✓' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="bg-white/5 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-gray-300">{selectedTier ? selectedTier.name : 'General Admission'}</span>
                            <span className="text-white font-semibold">{formatPrice(activePrice)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">Quantity</span>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setTicketQuantity(Math.max(1, ticketQuantity - 1));
                                    }}
                                    className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                                >
                                    -
                                </button>
                                <span className="text-white font-medium w-8 text-center">{ticketQuantity}</span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        // Cap at the spots actually left / selected tier's
                                        // remaining, not a flat 10 - an event with 3 seats
                                        // free must not let someone pick 10 and hit a server
                                        // rejection at checkout (11.2).
                                        setTicketQuantity(Math.min(perPurchaseMax, ticketQuantity + 1));
                                    }}
                                    disabled={atLimit}
                                    className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        {/* 11.2: inline notice when the buyer hits the per-purchase limit. */}
                        {atLimit && (
                            <p className="mt-2 text-xs text-amber-400 text-right">Limit reached</p>
                        )}
                    </div>

                    {/* Billing runs off activePrice, the selected tier's price - not
                        event.ticketPrice, which is only the base figure. Quoting the base
                        price for a VIP tier showed a total the server would not charge. */}
                    <div className="border-t border-white/10 pt-4 space-y-4">
                        {activePrice > 0 && (
                            <>
                                <DiscountCodeInput
                                    eventId={event._id!}
                                    subtotal={activePrice * ticketQuantity}
                                    onApplied={(discount) => setAppliedDiscount(discount)}
                                    onRemoved={() => setAppliedDiscount(null)}
                                    appliedCode={appliedDiscount?.code ?? null}
                                />
                                <BillingCard
                                    ticketPrice={activePrice}
                                    quantity={ticketQuantity}
                                    platformFeePercentage={(event as any).platformFeePercentage ?? 5}
                                    discountAmount={appliedDiscount?.amount ?? 0}
                                    discountCode={appliedDiscount?.code}
                                />
                            </>
                        )}
                        {activePrice === 0 && (
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-gray-300">Total</span>
                                <span className="text-2xl font-bold text-white">Free</span>
                            </div>
                        )}
                        <Button
                            className="w-full"
                            size="lg"
                            onClick={purchaseTickets}
                            disabled={isPurchasing || (hasTiers && selectedTierIndex === null)}
                        >
                            {isPurchasing
                                ? 'Processing...'
                                : hasTiers && selectedTierIndex === null
                                    ? 'Select a tier'
                                    : activePrice === 0 ? 'Confirm Registration' : 'Get Tickets'}
                        </Button>
                    </div>
                </div>
                    );
                })()}
            </Modal>
            {/* Success Ticket Modal */}
            <Modal
                isOpen={!!purchasedTicket}
                onClose={() => setPurchasedTicket(null)}
                title="You're In!"
                size="lg"
            >
                {purchasedTicket && event && (
                    <TicketDisplay
                        ticket={purchasedTicket}
                        event={event}
                        onClose={() => setPurchasedTicket(null)}
                    />
                )}
            </Modal>

            {/* Create Post Modal - Organizer Only */}
            <Modal
                isOpen={isCreatePostModalOpen}
                onClose={() => {
                    setIsCreatePostModalOpen(false);
                    setNewPostContent('');
                    setNewPostImages([]);
                }}
                title="Create a Post"
                size="md"
            >
                <div className="space-y-4">
                    <p className="text-gray-300 text-sm">Share an update with your ticket holders. They will be notified about this post.</p>

                    {/* Text Content */}
                    <textarea
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder="What would you like to share about your event?"
                        className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />

                    {/* Image Upload */}
                    <div>
                        <label className="text-sm text-gray-300 mb-2 block">Add Images (optional)</label>
                        <div className="flex flex-wrap gap-2">
                            {newPostImages.map((img, idx) => (
                                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden group">
                                    <img src={img} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => setNewPostImages(prev => prev.filter((_, i) => i !== idx))}
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                    >
                                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                            <label className="w-20 h-20 border-2 border-dashed border-white/20 rounded-lg flex items-center justify-center cursor-pointer hover:border-violet-500/50 transition-colors">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePostImageUpload}
                                    className="hidden"
                                    disabled={isUploadingImage}
                                />
                                {isUploadingImage ? (
                                    <svg className="w-5 h-5 text-gray-300 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                )}
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => {
                                setIsCreatePostModalOpen(false);
                                setNewPostContent('');
                                setNewPostImages([]);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleCreatePost}
                            disabled={isCreatingPost || !newPostContent.trim()}
                        >
                            {isCreatingPost ? 'Posting...' : 'Post Update'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Inquiry Modal */}
            <Modal
                isOpen={isInquiryModalOpen}
                onClose={() => setIsInquiryModalOpen(false)}
                title="Ask a Question"
                size="md"
            >
                <InquiryForm
                    referenceType="event"
                    referenceId={event._id!}
                    referenceName={event.name}
                    onClose={() => setIsInquiryModalOpen(false)}
                />
            </Modal>
        </>
    );
}

// Mock event data
function getMockEvent(id: string): Event {
    return {
        _id: id,
        organizer: { _id: 'u1', name: 'DJ Cosmic', email: '', avatar: null, phone: null, role: 'user', isVerified: true, emailVerified: true, verificationBadge: 'brand', socialLinks: { instagram: null, twitter: null, facebook: null, website: null }, followers: [], following: [], bankDetails: { accountName: null, accountNumber: null, ifscCode: null, bankName: null }, isActive: true, createdAt: '', updatedAt: '' },
        venue: { _id: 'v1', name: 'Skyline Terrace', owner: '', description: '', images: [], videos: [], capacity: { min: 0, max: 500 }, pricing: { basePrice: 50000, pricePerHour: null, currency: 'INR' }, amenities: [], rules: [], location: { type: 'Point', coordinates: [72.8777, 19.0760] }, address: { street: 'Marine Drive', city: 'Mumbai', state: 'Maharashtra', pincode: '', country: '' }, availability: [], blockedDates: [], status: 'approved', rating: { average: 4.8, count: 124 }, isActive: true, createdAt: '', updatedAt: '' },
        booking: null,
        name: 'Neon Nights Festival',
        description: 'Get ready for an electrifying night of music, lights, and unforgettable experiences at Neon Nights Festival!\n\nJoin us for an immersive journey through electronic dance music featuring:\n\n🎵 World-class DJs spinning the hottest tracks\n💡 Stunning visual displays and neon art installations\n🎪 Multiple stages with different music genres\n🍹 Premium bars and gourmet food stalls\n\nWhether you\'re a seasoned raver or new to the scene, Neon Nights promises an experience that will leave you breathless. Our state-of-the-art sound system and carefully curated lineup ensure every moment is pure magic.\n\nDoors open at 9 PM. Come early to explore the art installations and grab the best spots!',
        images: ['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200'],
        startDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000).toISOString(), // +7 days, 21:00
        endDateTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(), // +8 days, 04:00
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 1500,
        maxAttendees: 500,
        currentAttendees: 342,
        privateCode: null,
        category: 'party',
        tags: ['EDM', 'Dance', 'Neon', 'Festival', 'Nightlife'],
        status: 'upcoming',
        isFeatured: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}
