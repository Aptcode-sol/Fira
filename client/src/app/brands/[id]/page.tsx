'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { brandsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import BrandHeader from '@/components/BrandHeader';
import PostCard from '@/components/PostCard';
import EventCard from '@/components/EventCard';
import { Loader2, AlertCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
// Footer removed as it is in layout

export default function BrandProfilePage() {
    const params = useParams();
    const id = params.id as string;
    const { user } = useAuth();

    const [brand, setBrand] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('posts');
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, [id]);

    // Check follow status when user is available
    useEffect(() => {
        if (user && id) {
            checkFollowStatus();
        }
    }, [user, id]);

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
            setBrand(brandData);
            setPosts(postsData.posts);
            setEvents(eventsData);
        } catch (error) {
            console.error('Error fetching brand profile:', error);
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
        if (!user?._id) {
            // Could redirect to login or show message
            return;
        }

        setFollowLoading(true);
        try {
            if (isFollowing) {
                await brandsApi.unfollow(id, user._id);
                setIsFollowing(false);
                // Update local brand stats
                if (brand) {
                    setBrand({
                        ...brand,
                        stats: { ...brand.stats, followers: (brand.stats?.followers || 1) - 1 }
                    });
                }
            } else {
                await brandsApi.follow(id, user._id);
                setIsFollowing(true);
                if (brand) {
                    setBrand({
                        ...brand,
                        stats: { ...brand.stats, followers: (brand.stats?.followers || 0) + 1 }
                    });
                }
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
        } finally {
            setFollowLoading(false);
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
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
                Brand not found
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
                    {['posts', 'events'].map((tab) => (
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
                                <div className="flex gap-2 flex-wrap">
                                    {Object.entries((brand.socialLinks || {}) as Record<string, string>).map(([platform, link]) => (
                                        link && (
                                            <a key={platform} href={link as string} target="_blank" className="px-3 py-2 bg-black/20 rounded-lg hover:bg-white/10 capitalize text-sm border border-white/5 transition-colors">
                                                {platform}
                                            </a>
                                        )
                                    ))}
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
