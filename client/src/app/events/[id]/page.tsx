'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { Button, Modal, Input } from '@/components/ui';
import { eventsApi, ticketsApi } from '@/lib/api';
import { Event, User, Venue } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import PostCard from '@/components/PostCard';
import { useToast } from '@/components/ui/Toast';
import TicketDisplay from '@/components/TicketDisplay';
import { paymentsApi } from '@/lib/api'; // Add paymentsApi import

export default function EventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { isAuthenticated, user } = useAuth();
    const { showToast } = useToast();
    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [isPrivateCodeModalOpen, setIsPrivateCodeModalOpen] = useState(false);
    const [ticketQuantity, setTicketQuantity] = useState(1);
    const [privateCode, setPrivateCode] = useState('');
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [purchasedTicket, setPurchasedTicket] = useState<any>(null);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isTermsExpanded, setIsTermsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState('about');
    const [posts, setPosts] = useState<any[]>([]);

    useEffect(() => {
        if (params.id) {
            fetchEvent(params.id as string);
        }
    }, [params.id]);

    const fetchEvent = async (id: string) => {
        try {
            setIsLoading(true);
            const data = await eventsApi.getById(id);
            setEvent(data as Event);
        } catch (error) {
            console.error('Failed to fetch event:', error);
            setEvent(getMockEvent(id));
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

        // Check if paid ticket - show coming soon message
        if (event.ticketType === 'paid' || (event.ticketPrice && event.ticketPrice > 0)) {
            showToast('Payments coming soon! Stay tuned.', 'info');
            setIsTicketModalOpen(false);
            return;
        }

        // Free ticket flow - keep existing code
        setIsPurchasing(true);
        try {
            // 1. Initiate purchase request
            const result = await ticketsApi.purchase({
                userId: user._id,
                eventId: event._id,
                quantity: ticketQuantity,
                ticketType: 'general'
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
                                    quantity: ticketQuantity,
                                    ticketType: 'general',
                                    paymentId: result.paymentData.payment._id
                                });

                                setPurchasedTicket(finalTicketResult.ticket);
                                setIsTicketModalOpen(false);
                                fetchEvent(event._id!); // Refresh spots
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

    const formatPrice = (price: number) => {
        if (price === 0) return 'Free';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(price);
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
                        <p className="text-gray-400 mb-6">The event you&apos;re looking for doesn&apos;t exist.</p>
                        <Button onClick={() => router.push('/events')}>Browse Events</Button>
                    </div>
                </main>
            </>
        );
    }

    const organizer = event.organizer as User;
    const venue = event.venue as Venue;
    const spotsLeft = event.maxAttendees - event.currentAttendees;

    return (
        <>
            <PartyBackground />
            <Navbar />

            <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                <div className="max-w-6xl mx-auto">
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

                        {/* Date Banner */}
                        <div className="absolute bottom-4 left-4 px-4 py-3 rounded-xl bg-black/70 backdrop-blur-sm border border-white/10">
                            <div className="text-violet-400 text-sm font-medium">
                                {formatDate(event.date)}
                                {event.endDate && event.endDate !== event.date && new Date(event.endDate).toDateString() !== new Date(event.date).toDateString() && (
                                    <> - {formatDate(event.endDate)}</>
                                )}
                            </div>
                            <div className="text-white text-lg font-semibold">{event.startTime} - {event.endTime}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Content */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Title */}
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">{event.name}</h1>

                                {/* Organizer */}
                                {organizer && typeof organizer === 'object' && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-medium">
                                            {organizer.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-medium">{organizer.name}</span>
                                                {organizer.isVerified && (
                                                    <svg className="w-5 h-5 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="text-gray-400 text-sm">Event Organizer</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-6 border-b border-white/10">
                                {['about', 'posts'].map((tab) => (
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
                                            <p className={`text-gray-400 leading-relaxed whitespace-pre-line ${!isDescriptionExpanded ? 'line-clamp-3' : ''}`}>
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



                                    {/* Venue Info */}
                                    {venue && typeof venue === 'object' && (
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
                                                    <p className="text-gray-400 text-sm">{venue.address?.city}, {venue.address?.state}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

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

                                    {/* Terms and Conditions */}
                                    {(event as Event & { termsAndConditions?: string }).termsAndConditions && (
                                        <div className="bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
                                            <h2 className="text-xl font-semibold text-white mb-4">Terms & Conditions</h2>
                                            <div className="relative">
                                                <p className={`text-gray-400 leading-relaxed whitespace-pre-line text-sm ${!isTermsExpanded ? 'line-clamp-3' : ''}`}>
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
                                <div>
                                    {posts.length === 0 ? (
                                        <div className="text-center py-20 text-gray-400">
                                            <p>No posts yet for this event</p>
                                        </div>
                                    ) : (
                                        posts.map(post => <PostCard key={post._id} post={post} type="event" parentId={params.id as string} />)
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
                                        {event.ticketPrice > 0 && <span className="text-gray-400">per ticket</span>}
                                    </div>
                                </div>

                                {/* Quick Info */}
                                <div className="space-y-4 mb-6 pb-6 border-b border-white/10">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Date</span>
                                        <span className="text-white">{formatDate(event.date)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Time</span>
                                        <span className="text-white">{event.startTime} - {event.endTime}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Spots Left</span>
                                        <span className={`font-medium ${spotsLeft < 20 ? 'text-red-400' : 'text-white'}`}>
                                            {spotsLeft} / {event.maxAttendees}
                                        </span>
                                    </div>
                                </div>

                                {spotsLeft > 0 ? (
                                    <Button className="w-full" size="lg" onClick={handleGetTickets}>
                                        {event.ticketPrice === 0 ? 'Register for Free' : 'Get Tickets'}
                                    </Button>
                                ) : (
                                    <Button className="w-full" size="lg" disabled>
                                        Sold Out
                                    </Button>
                                )}

                                {event.eventType === 'private' && (
                                    <p className="text-xs text-gray-500 text-center mt-4">
                                        This is a private event. You&apos;ll need an access code to register.
                                    </p>
                                )}
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
                    <p className="text-gray-400">This is a private event. Please enter the access code provided by the organizer.</p>
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
                onClose={() => setIsTicketModalOpen(false)}
                title="Get Tickets"
                size="md"
            >
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">{event.name}</h3>
                        <p className="text-gray-400 text-sm">{formatDate(event.date)} • {event.startTime}</p>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-gray-300">General Admission</span>
                            <span className="text-white font-semibold">{formatPrice(event.ticketPrice)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">Quantity</span>
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
                                        setTicketQuantity(Math.min(10, ticketQuantity + 1));
                                    }}
                                    className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-gray-400">Total</span>
                            <span className="text-2xl font-bold text-white">
                                {formatPrice(event.ticketPrice * ticketQuantity)}
                            </span>
                        </div>
                        <Button className="w-full" size="lg" onClick={purchaseTickets} disabled={isPurchasing}>
                            {isPurchasing ? 'Processing...' : event.ticketPrice === 0 ? 'Confirm Registration' : 'Get Tickets'}
                        </Button>
                    </div>
                </div>
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
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        startTime: '21:00',
        endTime: '04:00',
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
