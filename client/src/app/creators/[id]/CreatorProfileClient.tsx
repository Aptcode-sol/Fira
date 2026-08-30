'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { brandsApi, messagesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import BrandHeader from '@/components/BrandHeader';
import PostCard from '@/components/PostCard';
import CreatePostModal from '@/components/modals/CreatePostModal';
import EventCard from '@/components/EventCard';
import { Loader2, AlertCircle, Instagram, Globe, Facebook, Linkedin, Twitter, Youtube, Link as LinkIcon } from 'lucide-react';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import InquiryForm from '@/components/InquiryForm';
import { BackButton, ShareButton, Modal } from '@/components/ui';
// Footer removed as it is in layout

/**
 * `initialBrand` is the profile the server already read for this page's metadata and
 * MusicGroup/Organization schema. Seeding from it is what puts the creator's name, type,
 * city and bio into the HTML - the page previously served 423 characters of navbar and
 * footer, identical across all 22 profiles. See page.tsx.
 *
 * Posts and events still load client-side: they are secondary content, and the name and
 * bio are what the page needs to be indexable for.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function CreatorProfileClient({ initialBrand = null }: { initialBrand?: any }) {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { user } = useAuth();
    const { showToast } = useToast();

    const [brand, setBrand] = useState<any>(initialBrand);
    const [posts, setPosts] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(!initialBrand);
    const [activeTab, setActiveTab] = useState('about');
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
    const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);

    // Does the signed-in user own this profile? `brand.user` comes back either
    // as a raw id or as a populated object depending on the endpoint, so check
    // both shapes.
    const isOwner = Boolean(
        user?._id && brand && (brand.user === user._id || brand.user?._id === user._id)
    );

    useEffect(() => {
        fetchData();
    }, [id]);

    // CreatePostModal announces a successful post on the window, so the list
    // refreshes without a manual reload.
    useEffect(() => {
        const refresh = () => fetchData();
        window.addEventListener('brand-post-created', refresh);
        return () => window.removeEventListener('brand-post-created', refresh);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Check follow status when user is available
    useEffect(() => {
        if (user && id) {
            checkFollowStatus();
        }
    }, [user, id]);

    // Listen for new posts
    useEffect(() => {
        const handlePostCreated = () => {
            fetchData();
        };
        window.addEventListener('brand-post-created', handlePostCreated);
        return () => window.removeEventListener('brand-post-created', handlePostCreated);
    }, [id]);

    interface BrandData {
        _id: string;
        name: string;
        bio: string;
        createdAt: string;
        stats: any;
        socialLinks: any;
        members: any[];
    }

    const fetchData = async () => {
        try {
            // No setLoading(true): when the server seeded the profile, flipping back to
            // loading would throw away the rendered page and flash a skeleton on mount.
            const [brandData, postsData, eventsData] = await Promise.all([
                brandsApi.getById(id) as Promise<BrandData>,
                brandsApi.getPosts(id) as Promise<{ posts: any[] }>,
                brandsApi.getEvents(id) as Promise<any[]>
            ]);

            if (!brandData) {
                console.error('Brand not found');
                // Keep the server-rendered profile if there is one; only an empty page
                // should become the not-found state.
                setBrand((prev: any) => prev ?? null);
                return;
            }

            setBrand(brandData);
            setPosts(postsData.posts || []);
            setEvents(eventsData || []);
        } catch (error) {
            console.error('Error fetching brand profile:', error);
            setBrand((prev: any) => prev ?? null);
        } finally {
            setLoading(false);
        }
    };

    const checkFollowStatus = async () => {
        if (!user?._id) return;
        try {
            const result = await brandsApi.getFollowStatus(id, user._id);
            setIsFollowing(result.isFollowing);
        } catch (error) {
            console.error('Error checking follow status:', error);
        }
    };

    const handleFollow = async () => {
        // If not logged in, redirect to signin
        if (!user?._id) {
            window.location.href = '/signin?redirect=' + encodeURIComponent(`/creators/${id}`);
            return;
        }

        // Optimistic update
        const wasFollowing = isFollowing;
        const previousBrand = brand;

        setIsFollowing(!wasFollowing);
        if (brand) {
            setBrand({
                ...brand,
                stats: {
                    ...brand.stats,
                    followers: wasFollowing
                        ? Math.max(0, (brand.stats?.followers || 1) - 1)
                        : (brand.stats?.followers || 0) + 1
                }
            });
        }

        setFollowLoading(true);
        try {
            if (wasFollowing) {
                await brandsApi.unfollow(id, user._id);
                showToast(`Unfollowed ${brand?.name}`, 'success');
            } else {
                await brandsApi.follow(id, user._id);
                showToast(`Now following ${brand?.name}!`, 'success');
            }
        } catch (error: unknown) {
            console.error('Error toggling follow:', error);
            // Revert on error
            setIsFollowing(wasFollowing);
            if (previousBrand) {
                setBrand(previousBrand);
            }
            const message = error instanceof Error ? error.message : 'Failed to update follow status';
            showToast(message, 'error');
        } finally {
            setFollowLoading(false);
        }
    };

    // Enquiring opens the same form events and venues use, so a thread is only
    // created once there is an actual question in it. Pressing this used to start
    // an empty conversation that then sat in both inboxes reading "No messages
    // yet"; the sign-in gate lives inside the form.
    const handleEnquiry = () => setIsEnquiryOpen(true);

    if (loading) {
        return (
            <>
                <PartyBackground />
                <main className="relative z-20 min-h-screen flex items-center justify-center">
                    <Loader2 className="animate-spin text-violet-500" size={40} />
                </main>
            </>
        );
    }

    if (!brand) {
        return (
            <>
                <PartyBackground />
                <Navbar />
                <div className="relative z-20 flex flex-col items-center justify-center min-h-[70vh] text-white px-4">
                    <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Creator not found</h1>
                    <p className="text-gray-300 mb-6 text-center">The creator you&apos;re looking for doesn&apos;t exist or has been removed.</p>
                    <button
                        onClick={() => window.location.href = '/creators'}
                        className="px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors"
                    >
                        Browse All Creators
                    </button>
                </div>
            </>
        );
    }

    return (
        <>
            {/* Same backdrop as the event and venue detail pages - the light rays
                sit behind a z-20 content layer. */}
            <PartyBackground />
            <Navbar />

            <div className="relative z-20 min-h-screen font-sans text-white">

            {/* Above the banner rather than inside the content column: BrandHeader is a
                full-bleed hero, so a control placed after it would sit below the fold on
                a phone. Falls back to the creators list when opened from a shared link. */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 pt-24 flex items-center justify-between gap-3">
                <BackButton fallbackHref="/creators" label="Back to Creators" />
                <ShareButton title={brand.name} text={`Check out ${brand.name} on FIRA`} />
            </div>

            {/* Header Section */}
            <BrandHeader brand={brand} onFollow={handleFollow} isFollowing={isFollowing} isOwnProfile={!!(user && (brand.user === user._id || brand.user?._id === user._id))} />

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 pb-20">

                {/* Tabs */}
                <div className="flex gap-8 border-b border-white/10 mb-8 overflow-x-auto">
                    {['about', 'posts', 'events'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 px-2 text-lg font-medium transition-all capitalize whitespace-nowrap ${activeTab === tab
                                ? 'text-violet-400 border-b-2 border-violet-400'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Left/Main Column */}
                    <div className="flex-1">
                        {activeTab === 'about' && (
                            <div className="space-y-6">
                                {/* Bio Section */}
                                <div className="bg-white/5 rounded-xl p-6 border border-white/5">
                                    <h3 className="text-lg font-semibold text-white mb-4">About</h3>
                                    <p className="text-gray-300 whitespace-pre-line leading-relaxed">
                                        {brand.bio || 'No bio available.'}
                                    </p>
                                </div>

                                {/* 14.1: The "Get in Touch" block was removed here as a
                                    duplicate of the Socials block. The in-app enquiry CTA
                                    it held now lives in the Socials sidebar so messaging
                                    stays reachable. */}

                                {/* Location if available - supports both legacy address and new cities array */}
                                {(brand.cities?.length > 0 || brand.address) && (
                                    <div className="bg-white/5 rounded-xl p-6 border border-white/5">
                                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            {brand.cities?.length > 1 ? 'Active Cities' : 'Location'}
                                        </h3>
                                        {brand.cities?.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {brand.cities.map((city: string, idx: number) => (
                                                    <span
                                                        key={idx}
                                                        className={`px-3 py-1.5 rounded-full text-sm ${brand.primaryCity === city
                                                            ? 'bg-violet-500/20 border border-violet-500/50 text-violet-400'
                                                            : 'bg-white/10 border border-white/10 text-gray-300'
                                                            }`}
                                                    >
                                                        {city}
                                                        {brand.primaryCity === city && (
                                                            <span className="ml-1 text-xs">★</span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : brand.address && (
                                            <p className="text-gray-300">
                                                {brand.address.city && `${brand.address.city}, `}
                                                {brand.address.state && `${brand.address.state}, `}
                                                {brand.address.country || 'India'}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'posts' && (
                            <div>
                                {/* Owner-only composer. Viewing your own profile
                                    previously offered no way to post at all -
                                    it just said "No posts yet" with no action. */}
                                {isOwner && (
                                    <div className="mb-6 flex justify-end">
                                        <button
                                            onClick={() => setIsCreatePostOpen(true)}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            New Post
                                        </button>
                                    </div>
                                )}

                                {posts.length === 0 ? (
                                    <div className="text-center py-20 text-gray-300">
                                        {isOwner ? (
                                            <>
                                                <p className="mb-4">You haven&apos;t posted anything yet.</p>
                                                <button
                                                    onClick={() => setIsCreatePostOpen(true)}
                                                    className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                                                >
                                                    Write your first post →
                                                </button>
                                            </>
                                        ) : (
                                            <p>No posts yet from {brand.name}</p>
                                        )}
                                    </div>
                                ) : (
                                    posts.map(post => <PostCard key={post._id} post={post} type="brand" parentId={id} />)
                                )}
                            </div>
                        )}

                        {activeTab === 'events' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {events.length === 0 ? (
                                    <div className="col-span-full text-center py-20 text-gray-300">
                                        <p>No upcoming events.</p>
                                    </div>
                                ) : (
                                    events.map(event => (
                                        <EventCard key={event._id} event={event} />
                                    ))
                                )}
                            </div>
                        )}


                    </div>

                    {/* Right Column (Suggestions / Info)

                        Sticky lives on the column, not on the first card inside
                        it. A stuck element keeps its original flow space but is
                        painted lower down, so sticking the Stats/Socials card on
                        its own slid it over the Members card sitting below it in
                        the same column - the overlap in 14.3, which was only ever
                        scoped away on mobile and still happened from lg up.
                        Sticking the column moves both cards as one unit, so they
                        cannot overlap each other.

                        self-start is required: a stretched flex item is as tall as
                        the row, and a sticky element that fills its containing
                        block has nowhere to move, which silently kills the effect.
                        The height cap plus overflow keeps the bottom of a long
                        sidebar reachable while it is pinned. */}
                    <div className="w-full lg:w-80 space-y-6 lg:self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                        <div className="bg-white/5 rounded-xl p-6 border border-white/5 space-y-6">
                            <div>
                                <h4 className="font-bold mb-4 text-gray-200">Stats</h4>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-300">Joined</span>
                                        <span>{new Date(brand.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-300">Total Views</span>
                                        <span>{brand.stats?.views?.toLocaleString() || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Separator */}
                            <div className="border-t border-white/5"></div>

                            {/* Enquiry CTA — the "Get in Touch" block was removed as a
                                duplicate of Socials (14.1); the messaging entry point it
                                held is preserved here so chat stays reachable. */}
                            {user?._id && (brand.user === user._id || brand.user?._id === user._id) ? (
                                <button
                                    onClick={() => router.push('/messages')}
                                    className="w-full px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                    </svg>
                                    View Enquiries
                                </button>
                            ) : (
                                <button
                                    onClick={handleEnquiry}
                                    className="w-full px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    Send Enquiry
                                </button>
                            )}

                            {/* Socials */}
                            <div>
                                <h4 className="font-bold mb-4 text-gray-200">Socials</h4>
                                <div className="space-y-3">
                                    {Object.entries((brand.socialLinks || {}) as Record<string, string>).map(([platform, link]) => {
                                        if (!link) return null;

                                        const getSocialIcon = (platform: string) => {
                                            switch (platform.toLowerCase()) {
                                                case 'instagram':
                                                    return <Instagram size={18} className="text-pink-500" />;
                                                case 'website':
                                                    return <Globe size={18} className="text-blue-400" />;
                                                case 'facebook':
                                                    return <Facebook size={18} className="text-blue-600" />;
                                                case 'twitter':
                                                    return <Twitter size={18} className="text-sky-500" />;
                                                case 'linkedin':
                                                    return <Linkedin size={18} className="text-blue-500" />;
                                                case 'youtube':
                                                    return <Youtube size={18} className="text-red-500" />;
                                                default:
                                                    return <LinkIcon size={18} className="text-gray-300" />;
                                            }
                                        };

                                        return (
                                            <a
                                                key={platform}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                                    {getSocialIcon(platform)}
                                                </div>
                                                <span className="capitalize">{platform}</span>
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Members Section */}
                        {brand.members && brand.members.length > 0 && (
                            <div className="bg-white/5 rounded-xl p-6 border border-white/5">
                                <h4 className="font-bold mb-4 text-gray-200">Members</h4>
                                <div className="space-y-3">
                                    {brand.members.map((member: any, idx: number) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden relative">
                                                {member.photoUrl ? (
                                                    <img src={member.photoUrl} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs bg-zinc-700">{member.name[0]}</div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm text-gray-200">{member.name}</div>
                                                <div className="text-xs text-gray-300">{member.role}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        )}
                    </div>
                </div>
            </div>

            {/* Composer. The modal dispatches `brand-post-created` on success,
                which the effect above listens for to refresh the list. */}
            {isOwner && (
                <CreatePostModal
                    isOpen={isCreatePostOpen}
                    onClose={() => setIsCreatePostOpen(false)}
                    brandId={id}
                />
            )}

            {/* Same enquiry form as events and venues - one question box, one
                behaviour, and no thread until there is something in it. */}
            <Modal
                isOpen={isEnquiryOpen}
                onClose={() => setIsEnquiryOpen(false)}
                title={`Ask ${brand.name}`}
                size="md"
            >
                <InquiryForm
                    referenceType="creator"
                    referenceId={id}
                    referenceName={brand.name}
                    onClose={() => setIsEnquiryOpen(false)}
                />
            </Modal>
            </div>
        </>
    );
}
