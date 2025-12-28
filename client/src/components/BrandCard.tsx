'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from './ui';
import { useToast } from './ui/Toast';

interface BrandCardProps {
    brand: {
        _id: string;
        name: string;
        type: string;
        bio: string;
        coverPhoto?: string | null;
        profilePhoto?: string | null;
        stats: {
            followers: number;
            events: number;
        };
        user?: {
            _id: string;
            name: string;
        };
    };
    onFollow?: (id: string) => void;
}

export default function BrandCard({ brand, onFollow }: BrandCardProps) {
    const [isFollowing, setIsFollowing] = useState(false); // Todo: Init based on actual follow status
    const { showToast } = useToast();

    const handleFollow = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsFollowing(!isFollowing);
        if (onFollow) onFollow(brand._id);
    };

    const formatFollowers = (count: number) => {
        if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
        if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
        return count.toString();
    };

    const handleEnquiry = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        showToast('Visit the brand page to view contact details', 'info');
    };

    return (
        <Link href={`/brands/${brand._id}`} className="block">
            <div className="group relative bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all duration-300 hover:-translate-y-1">
                {/* Cover Photo */}
                <div className="h-32 w-full bg-gradient-to-r from-violet-900/20 to-pink-900/20 relative">
                    {brand.coverPhoto ? (
                        <img
                            src={brand.coverPhoto}
                            alt={`${brand.name} cover`}
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-30">
                            <svg className="w-12 h-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                </div>

                {/* Profile Content */}
                <div className="p-4 pt-0 relative">
                    <div className="flex justify-between items-start mb-3">
                        {/* Avatar */}
                        <div className="-mt-10 relative">
                            <div className="relative w-20 h-20 rounded-full border-4 border-black bg-neutral-900 flex items-center justify-center overflow-hidden">
                                {brand.profilePhoto ? (
                                    <img
                                        src={brand.profilePhoto}
                                        alt={brand.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-2xl font-bold text-white uppercase">
                                        {brand.name.charAt(0)}
                                    </span>
                                )}
                            </div>
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black text-white border border-white/10 text-[10px] uppercase font-bold tracking-wider z-10 whitespace-nowrap">
                                {brand.type}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <h3 className="text-lg font-bold text-white group-hover:text-violet-400 transition-colors">
                                    {brand.name}
                                </h3>
                                <svg className="w-4 h-4 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            {brand.user?.name && (
                                <p className="text-sm text-gray-500">by {brand.user.name}</p>
                            )}
                        </div>

                        <p className="text-sm text-gray-400 line-clamp-2 min-h-[40px]">
                            {brand.bio || 'No bio available'}
                        </p>

                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                            <div className="flex gap-4 text-xs font-medium text-gray-400">
                                <span>{formatFollowers(brand.stats.followers)} Followers</span>
                                <span>{brand.stats.events} Events</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 px-3 text-xs bg-transparent border border-white/10 text-white hover:bg-neutral-800"
                                    onClick={handleEnquiry}
                                >
                                    Enquiry
                                </Button>
                                <Button
                                    size="sm"
                                    variant={isFollowing ? "secondary" : "primary"}
                                    className={`h-8 px-3 text-xs ${isFollowing ? 'bg-transparent border border-white/10 text-white hover:bg-neutral-800' : ''}`}
                                    onClick={handleFollow}
                                >
                                    {isFollowing ? 'Following' : 'Follow'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
