import React from 'react';
import Image from 'next/image';
import { MapPin, Users, Calendar } from 'lucide-react';
import { formatCount } from '@/lib/formatCount';

interface BrandHeaderProps {
    brand: {
        _id: string;
        name: string;
        bio: string;
        // Both are optional in practice - a creator can exist without either.
        // Typing them as required string hid the missing-photo case.
        coverPhoto?: string | null;
        profilePhoto?: string | null;
        stats: {
            followers: number;
            events: number;
        };
        members?: { name: string; role: string; photoUrl?: string }[];
        type: string;
    };
    onFollow: () => void;
    isFollowing: boolean;
    isOwnProfile?: boolean;
}

export default function BrandHeader({ brand, onFollow, isFollowing, isOwnProfile }: BrandHeaderProps) {
    return (
        <div className="relative mb-8">
            {/* Cover Photo - 16:9 aspect ratio maintained on all screen sizes, matching event page */}
            <div className="max-w-7xl mx-auto px-4 md:px-8">
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden">
                    <Image
                        src={brand.coverPhoto || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=2000&q=80'}
                        alt={`${brand.name} Cover`}
                        fill
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>
            </div>

            <div className="px-4 md:px-8 max-w-7xl mx-auto relative -mt-16 md:-mt-20 z-10">
                <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
                    {/* Profile Photo */}
                    <div className="relative">
                        {/* Falls back to the initial, exactly as the creator card does.
                            This previously pointed <Image> at '/default-avatar.png',
                            which does not exist in public/ - so a creator with no photo
                            got a broken image, and the browser rendered its alt text
                            (the full name) spilling out of the circle. */}
                        <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-black overflow-hidden bg-zinc-900 shadow-2xl flex items-center justify-center">
                            {brand.profilePhoto ? (
                                <Image
                                    src={brand.profilePhoto}
                                    alt={brand.name}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <span className="text-5xl md:text-6xl font-bold text-white uppercase select-none">
                                    {brand.name?.charAt(0)}
                                </span>
                            )}
                        </div>
                        <span className="absolute bottom-2 right-0 md:bottom-3 md:right-1 px-3 py-1 rounded-full bg-black text-white border border-white/10 text-xs font-medium backdrop-blur-md uppercase tracking-wider">
                            {brand.type}
                        </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-3xl md:text-5xl font-bold text-white">{brand.name}</h1>
                            <svg className="w-6 h-6 md:w-8 md:h-8 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-gray-300 text-lg md:text-xl max-w-2xl font-light leading-relaxed">
                            {brand.bio}
                        </p>

                        <div className="flex flex-col gap-2 mt-4">
                            <div className="flex flex-wrap gap-4 text-sm font-medium text-gray-300">
                                {/* Same compact formatting as the card, so a creator's
                                    follower count does not read "12,400" here and
                                    "12.4K" one screen earlier. */}
                                <div className="flex items-center gap-1">
                                    <Users size={16} />
                                    <span className="text-white tabular-nums">{formatCount(brand.stats.followers)}</span> Followers
                                </div>
                                <div className="flex items-center gap-1">
                                    <Calendar size={16} />
                                    <span className="text-white tabular-nums">{formatCount(brand.stats.events)}</span> Events
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {!isOwnProfile && (
                    <div className="flex gap-3 mb-4 w-full md:w-auto">
                        <button
                            onClick={onFollow}
                            className={`flex-1 md:flex-none px-8 py-3 rounded-full font-bold transition-all ${isFollowing
                                ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                                : 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20'
                                }`}
                        >
                            {isFollowing ? 'Following' : 'Follow'}
                        </button>
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
}
