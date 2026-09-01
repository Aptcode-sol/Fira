'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { brandsApi, uploadApi } from '@/lib/api';
import { FadeIn, SlideUp } from '@/components/animations';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { openCreateCreator, openEditCreator } from '@/components/modals/CreateCreatorLauncher';
import { CREATOR_SAVED } from '@/components/modals/CreateCreatorModal';

/** Review state of the creator application. Mirrors BrandProfile.status. */
type BrandStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

/**
 * What a profile that is not approved needs to say on this page.
 *
 * The public /creators listing already filters on `status: 'approved'`, so an
 * unapproved profile is invisible there - but this page gave no sign of that, and
 * showed the same management UI either way. Someone who had just applied saw a live
 * brand page and reasonably concluded they were live.
 */
const STATUS_NOTICE: Record<Exclude<BrandStatus, 'approved'>, { tone: string; title: string; body: string }> = {
    pending: {
        tone: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
        title: 'Awaiting review',
        body: 'Your creator profile is with our team. It stays hidden from the public creators list until it is approved - you can keep editing it in the meantime.',
    },
    rejected: {
        tone: 'bg-red-500/10 border-red-500/30 text-red-300',
        title: 'Not approved',
        body: 'This profile was not approved. Update the details below and it will go back into the review queue.',
    },
    blocked: {
        tone: 'bg-red-500/10 border-red-500/30 text-red-300',
        title: 'Blocked',
        body: 'This profile has been blocked and is hidden from the public creators list. Please contact support if you think this is a mistake.',
    },
};

interface BrandProfile {
    _id: string;
    name: string;
    type: 'brand' | 'band' | 'organizer';
    status: BrandStatus;
    bio: string;
    coverPhoto: string | null;
    profilePhoto: string | null;
    address: string | null;
    socialLinks: {
        instagram: string | null;
        twitter: string | null;
        facebook: string | null;
        website: string | null;
        spotify: string | null;
        youtube: string | null;
    };
    stats: {
        followers: number;
        events: number;
        views: number;
    };
    members: { name: string; role: string; photoUrl?: string }[];
    createdAt: string;
}

export default function BrandDashboardPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const [brand, setBrand] = useState<BrandProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Posts state
    const [posts, setPosts] = useState<any[]>([]);
    const [showPostModal, setShowPostModal] = useState(false);
    const [postContent, setPostContent] = useState('');

    // Lock body scroll while the hand-rolled post overlay is open (mirrors <Modal>).
    useBodyScrollLock(showPostModal);
    const [postImages, setPostImages] = useState<File[]>([]);
    const [postImagePreviews, setPostImagePreviews] = useState<string[]>([]);
    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [editingPost, setEditingPost] = useState<any>(null);
    const [postError, setPostError] = useState('');

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/signin');
        }
    }, [isLoading, isAuthenticated, router]);

    const fetchBrand = async () => {
        if (!user?._id) return;
        try {
            setLoading(true);
            const brandData = await brandsApi.getMyProfile(user._id) as BrandProfile;
            setBrand(brandData);
            // No form seeding: the edit modal takes `brand` as a prop and derives
            // its own baseline, so there is no second copy of these fields to sync.
        } catch (err) {
            setError('Failed to load brand profile');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated && user?._id) {
            fetchBrand();
        }
    }, [isAuthenticated, user?._id]);

    // Saving lives in CreateCreatorModal now. The handler that was here posted to
    // brandsApi.create() rather than update(), so "Save Changes" asked the server
    // to create a second profile, and it dropped cities, primaryCity and members
    // from the payload - blanking them on every save.

    // Refetch when the shared modal reports a save.
    useEffect(() => {
        const refresh = () => fetchBrand();
        window.addEventListener(CREATOR_SAVED, refresh);
        return () => window.removeEventListener(CREATOR_SAVED, refresh);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?._id]);

    // Fetch brand posts
    const fetchPosts = async () => {
        if (!brand?._id) return;
        try {
            const result = await brandsApi.getPosts(brand._id) as { posts: any[] };
            setPosts(result.posts || []);
        } catch (err) {
            console.error('Failed to fetch posts:', err);
        }
    };

    // Fetch posts when brand loads
    useEffect(() => {
        if (brand?._id) {
            fetchPosts();
        }
    }, [brand?._id]);

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
        setPostError('');
    };

    // Create or Update post
    const handleCreatePost = async () => {
        if (!brand?._id || !user?._id || !postContent.trim()) return;

        setIsCreatingPost(true);
        setPostError('');
        try {
            // Upload images to Cloudinary first (only on submit)
            let imageUrls: string[] = [];
            if (postImages.length > 0) {
                const uploadPromises = postImages.map(file => uploadApi.single(file));
                const results = await Promise.all(uploadPromises);
                imageUrls = results.map((r: any) => r.url);
            }

            if (editingPost) {
                // Update existing post
                await brandsApi.updatePost(brand._id, editingPost._id, {
                    content: postContent,
                    images: imageUrls.length > 0 ? imageUrls : editingPost.images,
                    userId: user._id
                });
            } else {
                // Create new post
                await brandsApi.createPost(brand._id, {
                    content: postContent,
                    images: imageUrls,
                    userId: user._id
                });
            }

            resetPostForm();
            fetchPosts();
        } catch (err) {
            console.error('Failed to create/update post:', err);
            setPostError(err instanceof Error ? err.message : 'Failed to create post. Please try again.');
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
        if (!brand?._id || !user?._id) return;
        if (!confirm('Are you sure you want to delete this post?')) return;

        try {
            await brandsApi.deletePost(brand._id, postId, user._id);
            fetchPosts();
        } catch (err) {
            console.error('Failed to delete post:', err);
            alert(err instanceof Error ? err.message : 'Failed to delete post. Please try again.');
        }
    };

    if (isLoading || !isAuthenticated) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    if (loading) {
        return (
            <DashboardLayout>
                <div className="p-6 lg:p-8">
                    {/* Skeleton Header */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 mb-8">
                        <div>
                            <div className="h-8 w-48 bg-white/[0.05] rounded-lg animate-pulse mb-2" />
                            <div className="h-4 w-64 bg-white/[0.05] rounded-lg animate-pulse" />
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <div className="h-10 w-32 bg-white/[0.05] rounded-lg animate-pulse" />
                            <div className="h-10 w-28 bg-white/[0.05] rounded-lg animate-pulse" />
                        </div>
                    </div>
                    {/* Skeleton Profile Card */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden">
                                <div className="h-48 bg-white/[0.05] animate-pulse" />
                                <div className="p-6">
                                    <div className="h-6 w-40 bg-white/[0.05] rounded animate-pulse mb-3" />
                                    <div className="h-4 w-full bg-white/[0.05] rounded animate-pulse mb-2" />
                                    <div className="h-4 w-2/3 bg-white/[0.05] rounded animate-pulse" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                                <div className="h-5 w-20 bg-white/[0.05] rounded animate-pulse mb-4" />
                                <div className="space-y-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="flex justify-between">
                                            <div className="h-4 w-24 bg-white/[0.05] rounded animate-pulse" />
                                            <div className="h-4 w-16 bg-white/[0.05] rounded animate-pulse" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!brand) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center p-6">
                    <div className="text-center">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-white mb-2">No Brand Profile</h3>
                        <p className="text-gray-300 mb-6">Create your brand profile to build your presence.</p>
                        <Button onClick={openCreateCreator}>Create Brand Profile</Button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header */}
                <SlideUp>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">My Brand</h1>
                            <p className="text-gray-300">Manage your brand profile and content</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Link href={`/brands/${brand._id}`}>
                                <Button variant="secondary">View Public Profile</Button>
                            </Link>
                            {/* Opens the same stepper the create flow uses, prefilled
                                with this profile. Routed through the app-root launcher
                                (not a locally-mounted modal) so the dialog escapes the
                                dashboard's stacking context - a modal mounted here sits
                                below the fixed navbar and bottom nav. */}
                            <Button onClick={() => openEditCreator(brand._id)}>Edit Profile</Button>
                        </div>
                    </div>
                </SlideUp>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-6">
                        {error}
                    </div>
                )}

                {/* Review state. Above the profile card so it is read before the
                    management controls, not after. */}
                {brand.status && brand.status !== 'approved' && STATUS_NOTICE[brand.status] && (
                    <div className={`border px-4 py-3 rounded-xl mb-6 ${STATUS_NOTICE[brand.status].tone}`}>
                        <p className="font-semibold">{STATUS_NOTICE[brand.status].title}</p>
                        <p className="text-sm mt-1 text-gray-300">{STATUS_NOTICE[brand.status].body}</p>
                    </div>
                )}

                {/* Profile Card */}
                <FadeIn delay={0.1}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Info */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Cover & Profile.
                                Cover is aspect-video (16:9) so the uploaded banner is
                                shown in full rather than cropped to a fixed strip, and
                                the avatar sits inline under it instead of floating over
                                the body with a fixed pt-20 that left a dead gap when the
                                bio was short. */}
                            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden">
                                {/* Cover. No dark overlay: the name and bio sit BELOW
                                    the banner here (unlike the public page, where they
                                    overlay it), so an overlay only dulls the image. */}
                                <div className="relative w-full aspect-video bg-gradient-to-br from-violet-500/20 to-pink-500/20">
                                    {brand.coverPhoto && (
                                        <img src={brand.coverPhoto} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
                                    )}
                                </div>

                                {/* Identity: avatar overlaps the cover edge, text flows
                                    beside it, so the row height follows the content.
                                    relative z-10: the cover above is positioned, and a
                                    positioned sibling paints over static content
                                    regardless of DOM order - without this the banner
                                    covered the avatar and name where -mt-12 overlaps. */}
                                <div className="relative z-10 px-6 pb-6">
                                    {/* Only the avatar overlaps the banner (-mt-12). The
                                        name row sits in normal flow below it, so the text
                                        never rides up against the cover image. */}
                                    <div className="-mt-12 w-24 h-24 rounded-2xl border-4 border-[#0a0a0a] overflow-hidden bg-gray-800">
                                        {brand.profilePhoto ? (
                                            <img src={brand.profilePhoto} alt={brand.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-pink-500 text-white text-3xl font-bold">
                                                {brand.name.charAt(0)}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
                                        <h2 className="text-2xl font-bold text-white">{brand.name}</h2>
                                        {brand.status === 'approved' && (
                                            <svg className="w-5 h-5 flex-shrink-0 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                        <span className="px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-medium capitalize">
                                            {brand.type}
                                        </span>
                                    </div>

                                    {brand.bio && <p className="text-gray-300 mt-3">{brand.bio}</p>}
                                    {brand.address && (
                                        <div className="flex items-center gap-2 text-gray-300 text-sm mt-3">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            </svg>
                                            {brand.address}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Social Links */}
                            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Social Links</h3>
                                <div className="flex flex-wrap gap-3">
                                    {Object.entries(brand.socialLinks || {}).map(([platform, link]) => (
                                        link && (
                                            <a
                                                key={platform}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-white/5 rounded-lg text-gray-300 hover:bg-white/10 transition-colors capitalize text-sm"
                                            >
                                                {platform}
                                            </a>
                                        )
                                    ))}
                                    {!Object.values(brand.socialLinks || {}).some(v => v) && (
                                        <p className="text-gray-300">No social links added</p>
                                    )}
                                </div>
                            </div>

                            {/* Team Members */}
                            {brand.members && brand.members.length > 0 && (
                                <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4">Team Members</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {brand.members.map((member, index) => (
                                            <div key={index} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                                                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-medium">
                                                    {member.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-white">{member.name}</div>
                                                    <div className="text-xs text-gray-300">{member.role}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Stats Sidebar */}
                        <div className="space-y-6">
                            {/* Stats Cards */}
                            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Stats</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300">Followers</span>
                                        <span className="text-white font-semibold">{brand.stats.followers.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300">Events</span>
                                        <span className="text-white font-semibold">{brand.stats.events}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300">Profile Views</span>
                                        <span className="text-white font-semibold">{brand.stats.views.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                                <div className="space-y-3">
                                    <Link href="/create/event" className="block">
                                        <Button variant="secondary" className="w-full justify-start">
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Create Event
                                        </Button>
                                    </Link>
                                    <Button variant="ghost" className="w-full justify-start" onClick={() => setShowPostModal(true)}>
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Create Post
                                    </Button>
                                </div>
                            </div>

                            {/* Member Since */}
                            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                                <div className="text-sm text-gray-300">Member since</div>
                                <div className="text-white font-medium">{new Date(brand.createdAt).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>

                    {/* Posts Section */}
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-white">Your Posts</h3>
                            <Button onClick={() => setShowPostModal(true)}>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                New Post
                            </Button>
                        </div>

                        {posts.length === 0 ? (
                            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-12 text-center">
                                <p className="text-gray-300">No posts yet. Create your first post!</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {posts.map((post: any) => (
                                    <div key={post._id} className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1">
                                                <p className="text-white whitespace-pre-wrap">{post.content}</p>
                                                {post.isEdited && <span className="text-xs text-gray-300 mt-1">(edited)</span>}
                                            </div>
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
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                                                {post.images.map((img: string, idx: number) => (
                                                    <img key={idx} src={img} alt="" className="w-full h-32 object-cover rounded-lg" />
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4 mt-4 text-sm text-gray-300">
                                            <span>{post.likes?.length || 0} likes</span>
                                            <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </FadeIn>
            </div>

            {/* Post Modal */}
            {showPostModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg">
                        <div className="p-6 border-b border-white/10">
                            <h3 className="text-xl font-semibold text-white">
                                {editingPost ? 'Edit Post' : 'Create Post'}
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Error message */}
                            {postError && (
                                <div className="px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                                    {postError}
                                </div>
                            )}
                            <textarea
                                value={postContent}
                                onChange={(e) => setPostContent(e.target.value)}
                                placeholder="What's on your mind?"
                                className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                            />

                            {/* Image Previews */}
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

                            {/* Add Images */}
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
                        </div>
                        <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                            <Button variant="ghost" onClick={resetPostForm}>
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
                </div>
            )}
        </DashboardLayout>
    );
}

