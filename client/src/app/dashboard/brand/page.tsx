'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui';
import { brandsApi, uploadApi } from '@/lib/api';
import { FadeIn, SlideUp } from '@/components/animations';

interface BrandProfile {
    _id: string;
    name: string;
    type: 'brand' | 'band' | 'organizer';
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
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editTab, setEditTab] = useState<'basic' | 'social' | 'photos'>('basic');
    const [editForm, setEditForm] = useState({
        name: '',
        bio: '',
        address: '',
        instagram: '',
        twitter: '',
        facebook: '',
        website: '',
        spotify: '',
        youtube: '',
    });
    const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
    const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null);
    const [profilePreview, setProfilePreview] = useState('');
    const [coverPreview, setCoverPreview] = useState('');

    // Posts state
    const [posts, setPosts] = useState<any[]>([]);
    const [showPostModal, setShowPostModal] = useState(false);
    const [postContent, setPostContent] = useState('');
    const [postImages, setPostImages] = useState<File[]>([]);
    const [postImagePreviews, setPostImagePreviews] = useState<string[]>([]);
    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [editingPost, setEditingPost] = useState<any>(null);

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
            if (brandData) {
                setEditForm({
                    name: brandData.name || '',
                    bio: brandData.bio || '',
                    address: brandData.address || '',
                    instagram: brandData.socialLinks?.instagram || '',
                    twitter: brandData.socialLinks?.twitter || '',
                    facebook: brandData.socialLinks?.facebook || '',
                    website: brandData.socialLinks?.website || '',
                    spotify: brandData.socialLinks?.spotify || '',
                    youtube: brandData.socialLinks?.youtube || '',
                });
            }
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

    const handleSaveProfile = async () => {
        if (!user?._id) return;
        setIsSaving(true);
        try {
            let profilePhotoUrl = brand?.profilePhoto || undefined;
            let coverPhotoUrl = brand?.coverPhoto || undefined;

            // Upload photos if changed
            if (profilePhotoFile) {
                const result = await uploadApi.single(profilePhotoFile, 'brands');
                profilePhotoUrl = result.url;
            }
            if (coverPhotoFile) {
                const result = await uploadApi.single(coverPhotoFile, 'brands');
                coverPhotoUrl = result.url;
            }

            await brandsApi.create({
                userId: user._id,
                name: editForm.name,
                bio: editForm.bio,
                address: editForm.address,
                profilePhoto: profilePhotoUrl,
                coverPhoto: coverPhotoUrl,
                socialLinks: {
                    instagram: editForm.instagram || null,
                    twitter: editForm.twitter || null,
                    facebook: editForm.facebook || null,
                    website: editForm.website || null,
                    spotify: editForm.spotify || null,
                    youtube: editForm.youtube || null,
                },
            });
            // Reset photo states
            setProfilePhotoFile(null);
            setCoverPhotoFile(null);
            setProfilePreview('');
            setCoverPreview('');
            // Refresh data
            await fetchBrand();
            setIsEditing(false);
        } catch (err) {
            setError('Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setProfilePhotoFile(file);
            setProfilePreview(URL.createObjectURL(file));
        }
    };

    const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverPhotoFile(file);
            setCoverPreview(URL.createObjectURL(file));
        }
    };

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
    };

    // Create or Update post
    const handleCreatePost = async () => {
        if (!brand?._id || !user?._id || !postContent.trim()) return;

        setIsCreatingPost(true);
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
        }
    };

    if (isLoading || !isAuthenticated) {
        return (
            <DashboardLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
                </div>
            </DashboardLayout>
        );
    }

    if (loading) {
        return (
            <DashboardLayout>
                <div className="p-6 lg:p-8">
                    {/* Skeleton Header */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <div className="h-8 w-48 bg-white/[0.05] rounded-lg animate-pulse mb-2" />
                            <div className="h-4 w-64 bg-white/[0.05] rounded-lg animate-pulse" />
                        </div>
                        <div className="flex gap-3">
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
                        <p className="text-gray-400 mb-6">Create your brand profile to build your presence.</p>
                        <Link href="/create/brand">
                            <Button>Create Brand Profile</Button>
                        </Link>
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
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">My Brand</h1>
                            <p className="text-gray-400">Manage your brand profile and content</p>
                        </div>
                        <div className="flex gap-3">
                            <Link href={`/brands/${brand._id}`}>
                                <Button variant="secondary">View Public Profile</Button>
                            </Link>
                            {isEditing ? (
                                <>
                                    <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                                    <Button onClick={handleSaveProfile} disabled={isSaving}>
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </>
                            ) : (
                                <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
                            )}
                        </div>
                    </div>
                </SlideUp>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-6">
                        {error}
                    </div>
                )}

                {/* Profile Card */}
                <FadeIn delay={0.1}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Info */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Cover & Profile */}
                            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden">
                                {/* Cover Photo */}
                                <div className="relative h-48 bg-gradient-to-br from-cyan-500/30 to-blue-500/30">
                                    {brand.coverPhoto && (
                                        <img src={brand.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                </div>

                                <div className="relative px-6 pb-6">
                                    {/* Profile Photo */}
                                    <div className="absolute -top-16 left-6">
                                        <div className="w-32 h-32 rounded-full border-4 border-[#0a0a0a] overflow-hidden bg-gray-800">
                                            {brand.profilePhoto ? (
                                                <img src={brand.profilePhoto} alt={brand.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-500 text-white text-3xl font-bold">
                                                    {brand.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-20">
                                        {isEditing ? (
                                            <div className="space-y-4">
                                                {/* Tabs */}
                                                <div className="flex gap-2 border-b border-white/10 pb-3">
                                                    {['basic', 'social', 'photos'].map((tab) => (
                                                        <button
                                                            key={tab}
                                                            onClick={() => setEditTab(tab as 'basic' | 'social' | 'photos')}
                                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${editTab === tab
                                                                ? 'bg-cyan-500/20 text-cyan-400'
                                                                : 'text-gray-400 hover:text-white'
                                                                }`}
                                                        >
                                                            {tab === 'basic' ? 'Basic Info' : tab === 'social' ? 'Social Links' : 'Photos'}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Basic Info Tab */}
                                                {editTab === 'basic' && (
                                                    <>
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-1">Name</label>
                                                            <input
                                                                type="text"
                                                                value={editForm.name}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-1">Bio</label>
                                                            <textarea
                                                                value={editForm.bio}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                                                                rows={3}
                                                                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-1">Location</label>
                                                            <input
                                                                type="text"
                                                                value={editForm.address}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                                                                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                                                            />
                                                        </div>
                                                    </>
                                                )}

                                                {/* Social Links Tab */}
                                                {editTab === 'social' && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-1">Instagram</label>
                                                            <input
                                                                type="url"
                                                                value={editForm.instagram}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, instagram: e.target.value }))}
                                                                placeholder="https://instagram.com/..."
                                                                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-gray-600"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-1">Twitter</label>
                                                            <input
                                                                type="url"
                                                                value={editForm.twitter}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, twitter: e.target.value }))}
                                                                placeholder="https://twitter.com/..."
                                                                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-gray-600"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-1">Facebook</label>
                                                            <input
                                                                type="url"
                                                                value={editForm.facebook}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, facebook: e.target.value }))}
                                                                placeholder="https://facebook.com/..."
                                                                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-gray-600"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-1">Website</label>
                                                            <input
                                                                type="url"
                                                                value={editForm.website}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, website: e.target.value }))}
                                                                placeholder="https://..."
                                                                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-gray-600"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-1">Spotify</label>
                                                            <input
                                                                type="url"
                                                                value={editForm.spotify}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, spotify: e.target.value }))}
                                                                placeholder="https://open.spotify.com/..."
                                                                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-gray-600"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-1">YouTube</label>
                                                            <input
                                                                type="url"
                                                                value={editForm.youtube}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, youtube: e.target.value }))}
                                                                placeholder="https://youtube.com/..."
                                                                className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder:text-gray-600"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Photos Tab */}
                                                {editTab === 'photos' && (
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-2">Profile Photo</label>
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
                                                                    {profilePreview || brand.profilePhoto ? (
                                                                        <img src={profilePreview || brand.profilePhoto || ''} alt="Profile" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-500 text-white text-2xl font-bold">
                                                                            {brand.name.charAt(0)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <label className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white cursor-pointer hover:bg-white/10 transition-colors">
                                                                    Choose File
                                                                    <input type="file" accept="image/*" onChange={handleProfilePhotoChange} className="hidden" />
                                                                </label>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm text-gray-400 mb-2">Cover Photo</label>
                                                            <div className="relative h-32 rounded-lg overflow-hidden bg-gray-800">
                                                                {coverPreview || brand.coverPhoto ? (
                                                                    <img src={coverPreview || brand.coverPhoto || ''} alt="Cover" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/30 to-blue-500/30">
                                                                        <span className="text-gray-500">No cover photo</span>
                                                                    </div>
                                                                )}
                                                                <label className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-white text-sm cursor-pointer hover:bg-black/80 transition-colors">
                                                                    Change Cover
                                                                    <input type="file" accept="image/*" onChange={handleCoverPhotoChange} className="hidden" />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-3 mb-3">
                                                    <h2 className="text-2xl font-bold text-white">{brand.name}</h2>
                                                    <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-medium capitalize">
                                                        {brand.type}
                                                    </span>
                                                </div>
                                                <p className="text-gray-400 mb-4">{brand.bio || 'No bio yet'}</p>
                                                {brand.address && (
                                                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        </svg>
                                                        {brand.address}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
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
                                        <p className="text-gray-500">No social links added</p>
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
                                                    <div className="text-xs text-gray-500">{member.role}</div>
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
                                        <span className="text-gray-400">Followers</span>
                                        <span className="text-white font-semibold">{brand.stats.followers.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Events</span>
                                        <span className="text-white font-semibold">{brand.stats.events}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Profile Views</span>
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
                                <div className="text-sm text-gray-500">Member since</div>
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
                                <p className="text-gray-400">No posts yet. Create your first post!</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {posts.map((post: any) => (
                                    <div key={post._id} className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1">
                                                <p className="text-white whitespace-pre-wrap">{post.content}</p>
                                                {post.isEdited && <span className="text-xs text-gray-500 mt-1">(edited)</span>}
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
                                        <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
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

