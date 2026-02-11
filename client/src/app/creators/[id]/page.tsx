'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { brandsApi, messagesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import BrandHeader from '@/components/BrandHeader';
import PostCard from '@/components/PostCard';
import EventCard from '@/components/EventCard';
import { Loader2, AlertCircle, Instagram, Globe, Facebook, Linkedin, Twitter, Youtube, Link as LinkIcon } from 'lucide-react';
import Navbar from '@/components/Navbar';
// Footer removed as it is in layout

export default function CreatorProfilePage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { user } = useAuth();
    const { showToast } = useToast();

    const [brand, setBrand] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('about');
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [enquiryLoading, setEnquiryLoading] = useState(false);

    useEffect(() => {
        fetchData();
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
            setLoading(true);
            const [brandData, postsData, eventsData] = await Promise.all([
                brandsApi.getById(id) as Promise<BrandData>,
                brandsApi.getPosts(id) as Promise<{ posts: any[] }>,
                brandsApi.getEvents(id) as Promise<any[]>
            ]);

            if (!brandData) {
                console.error('Brand not found');
                setBrand(null);
                return;
            }

            setBrand(brandData);
            setPosts(postsData.posts || []);
            setEvents(eventsData || []);
        } catch (error) {
            console.error('Error fetching brand profile:', error);
            setBrand(null);
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

    const handleEnquiry = async () => {
        // If not logged in, redirect to signin
        if (!user?._id) {
            window.location.href = '/signin?redirect=' + encodeURIComponent(`/creators/${id}`);
            return;
        }

        setEnquiryLoading(true);
        try {
            const response = await messagesApi.startBrandEnquiry({ brandId: id });
            router.push(`/messages?conversation=${response.conversation._id}`);
        } catch (error) {
            console.error('Error starting enquiry:', error);
            const message = error instanceof Error ? error.message : 'Failed to start conversation';
            showToast(message, 'error');
        } finally {
            setEnquiryLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="animate-spin text-violet-500" size={40} />
            </div>
        );
    }

    if (!brand) {
        return (
            <div className="min-h-screen bg-black">
                <Navbar />
                <div className="flex flex-col items-center justify-center min-h-[70vh] text-white px-4">
                    <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Creator not found</h1>
                    <p className="text-gray-400 mb-6 text-center">The creator you&apos;re looking for doesn&apos;t exist or has been removed.</p>
                    <button
                        onClick={() => window.location.href = '/creators'}
                        className="px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors"
                    >
                        Browse All Creators
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black font-sans text-white">
            <Navbar />

            {/* Header Section */}
            <BrandHeader brand={brand} onFollow={handleFollow} isFollowing={isFollowing} />

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
                                    <p className="text-gray-400 whitespace-pre-line leading-relaxed">
                                        {brand.bio || 'No bio available.'}
                                    </p>
                                </div>

                                {/* Contact / Enquiry Section */}
                                <div className="bg-gradient-to-br from-violet-500/10 to-pink-500/10 rounded-xl p-6 border border-violet-500/20">
                                    <h3 className="text-lg font-semibold text-white mb-2">Get in Touch</h3>
                                    <p className="text-gray-400 text-sm mb-4">
                                        Want to book {brand.name} for your event or have an enquiry?
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        {/* Enquiry Button - Primary CTA */}
                                        {user?._id && (brand.user === user._id || brand.user?._id === user._id) ? (
                                            <button
                                                onClick={() => router.push('/messages')}
                                                className="px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                                </svg>
                                                View Enquiries
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleEnquiry}
                                                disabled={enquiryLoading}
                                                className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                {enquiryLoading ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                    </svg>
                                                )}
                                                {enquiryLoading ? 'Starting...' : 'Send Enquiry'}
                                            </button>
                                        )}
                                        {brand.socialLinks?.email && (
                                            <a
                                                href={`mailto:${brand.socialLinks.email}`}
                                                className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                                Send Email
                                            </a>
                                        )}
                                        {brand.socialLinks?.instagram && (
                                            <a
                                                href={brand.socialLinks.instagram}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                                </svg>
                                                Instagram
                                            </a>
                                        )}
                                        {brand.socialLinks?.whatsapp && (
                                            <a
                                                href={`https://wa.me/${brand.socialLinks.whatsapp.replace(/[^0-9]/g, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                                                </svg>
                                                WhatsApp
                                            </a>
                                        )}
                                    </div>
                                </div>

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
                                            <p className="text-gray-400">
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



                                {posts.length === 0 ? (
                                    <div className="text-center py-20 text-gray-400">
                                        <p>No posts yet from {brand.name}</p>
                                    </div>
                                ) : (
                                    posts.map(post => <PostCard key={post._id} post={post} type="brand" parentId={id} />)
                                )}
                            </div>
                        )}

                        {activeTab === 'events' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {events.length === 0 ? (
                                    <div className="col-span-full text-center py-20 text-gray-400">
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

                    {/* Right Column (Suggestions / Info) */}
                    <div className="w-full lg:w-80 space-y-6">
                        {/* Stats & Socials - Sticky Wrapper */}
                        <div className="bg-white/5 rounded-xl p-6 border border-white/5 sticky top-24 space-y-6">
                            <div>
                                <h4 className="font-bold mb-4 text-gray-200">Stats</h4>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Joined</span>
                                        <span>{new Date(brand.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Total Views</span>
                                        <span>{brand.stats?.views?.toLocaleString() || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Separator */}
                            <div className="border-t border-white/5"></div>

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
                                                    return <LinkIcon size={18} className="text-gray-400" />;
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
                                                <div className="text-xs text-gray-500">{member.role}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        )}
                    </div>
                </div>
            </div>

        </div>


    );
}
