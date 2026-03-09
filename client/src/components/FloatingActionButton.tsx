'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { brandsApi } from '@/lib/api';
import CreatePostModal from './modals/CreatePostModal';

export default function FloatingActionButton() {
    const { isAuthenticated, user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isHovered, setIsHovered] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
    const [brandId, setBrandId] = useState<string | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Check if user is a creator
    const isCreator = user?.verificationBadge && ['brand', 'band', 'organizer'].includes(user.verificationBadge);

    // Fetch brand ID if creator
    useEffect(() => {
        const fetchBrandId = async () => {
            if (isCreator && !brandId && user?._id) {
                try {
                    const profile = await brandsApi.getMyProfile(user._id) as any;
                    if (profile) {
                        setBrandId(profile._id);
                    }
                } catch (e) {
                    console.error('Failed to fetch brand profile', e);
                }

            }
        };
        fetchBrandId();
    }, [isCreator, brandId, user]);

    // Don't show on certain pages
    const hiddenPaths = [
        '/signin',
        '/signup',
        '/forgot-password',
        '/venue-portal/signin',
        '/venue-portal/signup',
        '/create/event',
        '/create/creator',
    ];

    const shouldHide = hiddenPaths.some(path => pathname.startsWith(path));

    // Only show for authenticated regular users (not venue owners on their portal)
    const isVenueOwner = user?.role === 'venue_owner';
    const isOnVenuePortal = pathname.startsWith('/venue-portal');

    if (!isMounted || !isAuthenticated || shouldHide || (isVenueOwner && isOnVenuePortal)) {
        return null;
    }

    const handleMainClick = () => {
        if (isCreator) {
            setShowOptions(!showOptions);
        } else {
            router.push('/create/event');
        }
    };

    const handleCreatePost = () => {
        if (!brandId) return;
        setIsCreatePostOpen(true);
        setShowOptions(false);
    };

    const handleCreateEvent = () => {
        router.push('/create/event');
        setShowOptions(false);
    };

    return (
        <>
            <div
                className="fixed bottom-24 md:bottom-8 right-6 z-40 flex flex-col-reverse items-end"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Main Button */}
                <motion.button
                    onClick={handleMainClick}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-violet-500 text-white shadow-lg shadow-violet-500/25 flex items-center justify-center transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30 z-50`}
                >
                    <svg
                        className={`w-6 h-6 transition-transform duration-300 ${showOptions ? 'rotate-45' : (isHovered && !isCreator ? 'rotate-90' : '')}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                </motion.button>

                {/* Speed Dial Options for Creators */}
                <AnimatePresence>
                    {isCreator && showOptions && (
                        <div className="flex flex-col-reverse items-end gap-3 mb-3">
                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                transition={{ delay: 0.1 }}
                                className="flex items-center gap-3 mr-2"
                            >
                                <span className="bg-black/90 border border-white/10 text-white text-sm font-medium px-3 py-1.5 rounded-lg shadow-lg">
                                    Create Event
                                </span>
                                <button
                                    onClick={handleCreateEvent}
                                    className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-violet-500 text-white shadow-lg flex items-center justify-center hover:shadow-xl hover:shadow-violet-500/30 transition-all"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </button>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                transition={{ delay: 0.05 }}
                                className="flex items-center gap-3 mr-2"
                            >
                                <span className="bg-black/90 border border-white/10 text-white text-sm font-medium px-3 py-1.5 rounded-lg shadow-lg">
                                    Create Post
                                </span>
                                <button
                                    onClick={handleCreatePost}
                                    disabled={!brandId}
                                    className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-violet-500 text-white shadow-lg flex items-center justify-center hover:shadow-xl hover:shadow-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Tooltip for Non-Creators */}
                <AnimatePresence>
                    {!isCreator && isHovered && (
                        <motion.div
                            initial={{ opacity: 0, x: 10, y: -28 }} // Adjusted position to align with button center
                            animate={{ opacity: 1, x: 0, y: -28 }}
                            exit={{ opacity: 0, x: 10, y: -28 }}
                            className="absolute right-full mr-3 whitespace-nowrap pointer-events-none" // pointer-events-none to prevent flickering
                        >
                            <span className="px-3 py-2 rounded-lg bg-black/90 border border-white/10 text-white text-sm font-medium shadow-lg">
                                Create Event
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Create Post Modal */}
            {brandId && (
                <CreatePostModal
                    isOpen={isCreatePostOpen}
                    onClose={() => setIsCreatePostOpen(false)}
                    brandId={brandId}
                />
            )}
        </>
    );
}
