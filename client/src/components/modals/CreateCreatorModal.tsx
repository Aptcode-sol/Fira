'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CitySearch, Input, Select, StepperModal } from '@/components/ui';
import type { StepperStep } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { brandsApi, uploadApi, clearRequestCache } from '@/lib/api';
import { isFilled, type FieldErrors } from '@/lib/validation';

const CREATOR_TYPES = [
    { value: 'brand', label: 'Brand' },
    { value: 'band', label: 'Band' },
    { value: 'organizer', label: 'Event Organizer' },
    { value: 'artist', label: 'Artist' },
    { value: 'dj', label: 'DJ' },
    { value: 'dancer', label: 'Dancer' },
    { value: 'planner', label: 'Event Planner' },
    { value: 'musician', label: 'Musician' },
    { value: 'photographer', label: 'Photographer' },
    { value: 'caterer', label: 'Caterer' },
];

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Fired after a creator profile is created or edited.
 *
 * The screens that show a creator (My Brand, the dashboard card, the public
 * profile) are client components holding their own fetched copy, so
 * router.refresh() alone will not update them. They listen for this and refetch.
 */
export const CREATOR_SAVED = 'creator-saved';

/** Blank draft. Declared once so "Clear all" and the initial state cannot drift. */
const EMPTY_FORM = {
    name: '',
    type: 'brand',
    bio: '',
    instagram: '',
    twitter: '',
    facebook: '',
    website: '',
    spotify: '',
    youtube: '',
};

/** The subset of a creator profile this form reads when editing. */
export interface CreatorDraft {
    _id: string;
    name?: string;
    type?: string;
    bio?: string;
    profilePhoto?: string | null;
    coverPhoto?: string | null;
    cities?: string[];
    primaryCity?: string | null;
    address?: string | null;
    socialLinks?: {
        instagram?: string | null;
        twitter?: string | null;
        facebook?: string | null;
        website?: string | null;
        spotify?: string | null;
        youtube?: string | null;
    };
    members?: { name: string; role: string }[];
}

interface CreateCreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    /**
     * Present = edit an existing profile instead of creating one.
     *
     * Editing reuses this form rather than having its own. Creator had the same
     * split the venue flow used to: a four-step create route and a separate
     * three-tab inline editor on My Brand. They had already drifted - the create
     * route collected cities, a primary city and team members, and the editor
     * could not touch any of them, so those fields were write-once at signup.
     */
    creator?: CreatorDraft | null;
}

/**
 * Creator profile creation and editing, in the same stepper modal events and
 * venues use.
 *
 * Photos are the reason this exists as one component: both the poster-equivalent
 * (square profile) and the banner (16:9 cover) have to survive an edit that does
 * not re-upload them, which the old inline editor got wrong by sending
 * `undefined` for an untouched photo.
 */
export default function CreateCreatorModal({ isOpen, onClose, creator = null }: CreateCreatorModalProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();
    const isEditing = Boolean(creator?._id);

    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({});

    const [form, setForm] = useState(EMPTY_FORM);

    const [cities, setCities] = useState<string[]>([]);
    const [primaryCity, setPrimaryCity] = useState('');

    const [members, setMembers] = useState<{ name: string; role: string }[]>([]);
    const [newMember, setNewMember] = useState({ name: '', role: '' });

    // Newly picked files, and the object URLs previewing them.
    const [profileFile, setProfileFile] = useState<File | null>(null);
    const [profilePreview, setProfilePreview] = useState('');
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState('');

    /**
     * Photos already saved on the profile.
     *
     * Kept separate from the file/preview pair so an edit that touches neither
     * photo still submits the existing URLs, and clearing one is an explicit act
     * (empty string) rather than indistinguishable from "not changed".
     */
    const [savedProfileUrl, setSavedProfileUrl] = useState('');
    const [savedCoverUrl, setSavedCoverUrl] = useState('');

    const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    /** The values "Clear all" restores: the saved profile when editing, else blank. */
    const baseline = (): typeof EMPTY_FORM => {
        if (!creator) return EMPTY_FORM;
        return {
            name: creator.name ?? '',
            type: creator.type ?? 'brand',
            bio: creator.bio ?? '',
            instagram: creator.socialLinks?.instagram ?? '',
            twitter: creator.socialLinks?.twitter ?? '',
            facebook: creator.socialLinks?.facebook ?? '',
            website: creator.socialLinks?.website ?? '',
            spotify: creator.socialLinks?.spotify ?? '',
            youtube: creator.socialLinks?.youtube ?? '',
        };
    };

    /**
     * Which profile the form currently holds - null meaning "a new one".
     *
     * The modal is mounted once and only hidden on close, which is what makes an
     * accidental close non-destructive. The flip side is it has to notice when it
     * is reopened pointing at something else.
     */
    const loadedCreatorId = useRef<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setErrors({});
        const id = creator?._id ?? null;
        if (id === loadedCreatorId.current) return;
        loadedCreatorId.current = id;

        setForm(baseline());
        setCities(creator?.cities ?? []);
        setPrimaryCity(creator?.primaryCity ?? creator?.address ?? '');
        setMembers(creator?.members ?? []);
        setSavedProfileUrl(creator?.profilePhoto ?? '');
        setSavedCoverUrl(creator?.coverPhoto ?? '');
        // The cleanup effect below revokes the previous object URLs.
        setProfileFile(null);
        setProfilePreview('');
        setCoverFile(null);
        setCoverPreview('');
        setStep(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, creator?._id]);

    // Object URLs are leaked memory until revoked, and the previews are replaced
    // every time a different file is picked.
    useEffect(() => {
        return () => {
            if (profilePreview) URL.revokeObjectURL(profilePreview);
        };
    }, [profilePreview]);

    useEffect(() => {
        return () => {
            if (coverPreview) URL.revokeObjectURL(coverPreview);
        };
    }, [coverPreview]);

    /**
     * Discard changes. Creating goes back to blank; editing goes back to what is
     * currently saved, which is what "clear" means when amending something that
     * already exists.
     */
    const resetForm = () => {
        setForm(baseline());
        setCities(creator?.cities ?? []);
        setPrimaryCity(creator?.primaryCity ?? creator?.address ?? '');
        setMembers(creator?.members ?? []);
        setSavedProfileUrl(creator?.profilePhoto ?? '');
        setSavedCoverUrl(creator?.coverPhoto ?? '');
        setProfileFile(null);
        setProfilePreview('');
        setCoverFile(null);
        setCoverPreview('');
        setNewMember({ name: '', role: '' });
        setErrors({});
        setStep(0);
    };

    /** Shared guard for both pickers: one file, an image, under the size cap. */
    const pickImage = (
        e: React.ChangeEvent<HTMLInputElement>,
        label: string,
        onAccept: (file: File, preview: string) => void
    ) => {
        const file = e.target.files?.[0];
        // Reset immediately so re-picking the same file still fires onChange.
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast(`${label} must be an image`, 'error');
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            showToast(`${label} exceeds the 2MB limit`, 'error');
            return;
        }
        onAccept(file, URL.createObjectURL(file));
    };

    const addMember = () => {
        if (!newMember.name.trim() || !newMember.role.trim()) return;
        setMembers(prev => [...prev, { name: newMember.name.trim(), role: newMember.role.trim() }]);
        setNewMember({ name: '', role: '' });
    };

    const removeMember = (index: number) => setMembers(prev => prev.filter((_, i) => i !== index));

    /** Per-step validation. Returns a field -> message map; empty means valid. */
    const validateStep = (index: number): FieldErrors => {
        const found: FieldErrors = {};
        if (index === 0) {
            // isFilled trims, so a name of only spaces fails here rather than
            // being saved and rendering as a blank creator everywhere.
            if (!isFilled(form.name)) found.name = 'Give your profile a name';
            if (!isFilled(form.type)) found.type = 'Pick what kind of creator this is';
        }
        return found;
    };

    const canAdvance = (fromStep: number) => {
        const found = validateStep(fromStep);
        setErrors(found);
        return Object.keys(found).length === 0;
    };

    const handleSubmit = async () => {
        if (!user?._id) return;

        // Re-check every step, not just the last: Next only guards forward
        // movement, and the finish button lives on a step that validates nothing.
        for (let i = 0; i < 3; i++) {
            const found = validateStep(i);
            if (Object.keys(found).length > 0) {
                setErrors(found);
                setStep(i);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            // A newly picked file replaces the saved URL; an untouched photo keeps
            // it; a removed photo submits '' so the server clears the field.
            let profilePhoto = savedProfileUrl;
            let coverPhoto = savedCoverUrl;

            if (profileFile) {
                showToast('Uploading profile photo...', 'info');
                profilePhoto = (await uploadApi.single(profileFile, 'brands')).url;
            }
            if (coverFile) {
                showToast('Uploading cover photo...', 'info');
                coverPhoto = (await uploadApi.single(coverFile, 'brands')).url;
            }

            const payload = {
                name: form.name.trim(),
                type: form.type,
                bio: form.bio,
                cities: cities.length > 0 ? cities : undefined,
                primaryCity: primaryCity || (cities.length > 0 ? cities[0] : null),
                profilePhoto,
                coverPhoto,
                socialLinks: {
                    instagram: form.instagram || null,
                    twitter: form.twitter || null,
                    facebook: form.facebook || null,
                    website: form.website || null,
                    spotify: form.spotify || null,
                    youtube: form.youtube || null,
                },
                members,
            };

            // Both create and edit go through POST /brands, which upserts on the
            // authenticated user (a user has exactly one profile). There is no
            // PUT /brands/:id route - calling one returned an HTML 404 that the
            // JSON client parsed as "Unexpected token '<'". The server strips
            // protected fields (status, stats, badge) from the payload, so an edit
            // cannot self-approve.
            await brandsApi.create({ ...payload, userId: user._id });
            showToast(isEditing ? 'Profile updated' : 'Creator profile submitted for review', 'success');

            // The brand endpoints are GET-cached, so the screens that refetch on
            // CREATOR_SAVED would otherwise be served the pre-save copy.
            clearRequestCache();
            window.dispatchEvent(new CustomEvent(CREATOR_SAVED));
            loadedCreatorId.current = null;
            onClose();
            router.refresh();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to save profile';
            showToast(message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    /** Cover: single landscape 16:9, the banner on My Brand and the public page. */
    const coverShown = coverPreview || savedCoverUrl;
    /** Profile: single square, the avatar everywhere including the dashboard card. */
    const profileShown = profilePreview || savedProfileUrl;

    const steps: StepperStep[] = [
        {
            label: 'Basics',
            content: (
                <>
                    <Input
                        label="Name *"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        error={errors.name}
                        helperText="The name your audience sees on events and posts"
                    />
                    <Select
                        label="Creator Type *"
                        value={form.type}
                        onChange={(val) => set('type', val)}
                        options={CREATOR_TYPES}
                        error={errors.type}
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Bio</label>
                        <textarea
                            value={form.bio}
                            onChange={(e) => set('bio', e.target.value)}
                            rows={4}
                            maxLength={500}
                            placeholder="What do you do, and what should people expect from your events?"
                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                    </div>
                    {/* Cities are a list, so the field clears after each pick and the
                        selection lives in the chips below it - that is what
                        CitySearch's clearOnSelect is for. The first chip is the
                        primary city unless one is chosen explicitly. */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Cities you work in</label>
                        <p className="text-xs text-gray-400 mb-2">Add as many as you travel to. The first is your primary city.</p>
                        <CitySearch
                            value=""
                            clearOnSelect
                            onSelect={(city) => {
                                setCities(prev => (prev.includes(city.city) ? prev : [...prev, city.city]));
                                setPrimaryCity(prev => prev || city.city);
                            }}
                            placeholder="Search a city..."
                        />
                        {cities.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {cities.map((city) => (
                                    <span
                                        key={city}
                                        className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-violet-500/20 text-violet-300 text-sm"
                                    >
                                        {city}
                                        {city === primaryCity && (
                                            <span className="text-[10px] uppercase tracking-wide text-violet-400/80">primary</span>
                                        )}
                                        <button
                                            type="button"
                                            aria-label={`Remove ${city}`}
                                            onClick={() => {
                                                const next = cities.filter(c => c !== city);
                                                setCities(next);
                                                // Removing the primary promotes whatever
                                                // is left, so the profile never keeps a
                                                // primary city it no longer operates in.
                                                if (city === primaryCity) setPrimaryCity(next[0] ?? '');
                                            }}
                                            className="w-5 h-5 rounded-full bg-black/30 hover:bg-red-500 text-white text-xs leading-none"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ),
        },
        {
            label: 'Photos',
            content: (
                <>
                    {/* Cover - landscape, matches the event banner guidance so the two
                        flows ask for the same thing in the same words. */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Cover Photo <span className="text-violet-400">(Single • Landscape)</span>
                        </label>
                        <p className="text-xs text-gray-400 mb-3">
                            Upload <span className="text-white">1 landscape image</span> (16:9 ratio).
                            Recommended: 1200 × 675 px. JPG or PNG, up to 2MB.
                        </p>
                        {coverShown ? (
                            <div className="relative inline-block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={coverShown}
                                    alt="Cover preview"
                                    className="w-full max-w-md aspect-video object-cover rounded-xl border border-white/10"
                                />
                                {/* Always visible, not hover-only: on a touch screen
                                    there is no hover, so a hover-only remove control
                                    cannot be reached at all. */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCoverFile(null);
                                        setCoverPreview('');
                                        setSavedCoverUrl('');
                                    }}
                                    aria-label="Remove cover photo"
                                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold shadow-lg"
                                >
                                    ×
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center gap-2 w-full max-w-md aspect-video rounded-xl border-2 border-dashed border-white/20 text-gray-400 hover:border-violet-500/50 hover:text-white cursor-pointer transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-sm">Click to upload cover photo</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => pickImage(e, 'Cover photo', (file, preview) => {
                                        setCoverFile(file);
                                        setCoverPreview(preview);
                                    })}
                                />
                            </label>
                        )}
                    </div>

                    {/* Profile - square avatar. */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Profile Photo <span className="text-violet-400">(Single • Square)</span>
                        </label>
                        <p className="text-xs text-gray-400 mb-3">
                            Upload <span className="text-white">1 square image</span>.
                            Recommended: 400 × 400 px. JPG or PNG, up to 2MB.
                        </p>
                        {profileShown ? (
                            <div className="relative inline-block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={profileShown}
                                    alt="Profile preview"
                                    className="w-28 h-28 object-cover rounded-2xl border border-white/10"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProfileFile(null);
                                        setProfilePreview('');
                                        setSavedProfileUrl('');
                                    }}
                                    aria-label="Remove profile photo"
                                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold shadow-lg"
                                >
                                    ×
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center gap-1 w-28 h-28 rounded-2xl border-2 border-dashed border-white/20 text-gray-400 hover:border-violet-500/50 hover:text-white cursor-pointer transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-xs">Upload</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => pickImage(e, 'Profile photo', (file, preview) => {
                                        setProfileFile(file);
                                        setProfilePreview(preview);
                                    })}
                                />
                            </label>
                        )}
                    </div>
                </>
            ),
        },
        {
            label: 'Social & Team',
            content: (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input label="Instagram" value={form.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="https://instagram.com/..." />
                        <Input label="Twitter" value={form.twitter} onChange={(e) => set('twitter', e.target.value)} placeholder="https://twitter.com/..." />
                        <Input label="Facebook" value={form.facebook} onChange={(e) => set('facebook', e.target.value)} placeholder="https://facebook.com/..." />
                        <Input label="Website" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://..." />
                        <Input label="Spotify" value={form.spotify} onChange={(e) => set('spotify', e.target.value)} placeholder="https://open.spotify.com/..." />
                        <Input label="YouTube" value={form.youtube} onChange={(e) => set('youtube', e.target.value)} placeholder="https://youtube.com/..." />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Team members</label>
                        <p className="text-xs text-gray-400 mb-3">Optional. Band line-up, crew, or the people behind the brand.</p>

                        {members.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {members.map((member, index) => (
                                    <div key={`${member.name}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                                        <div className="min-w-0">
                                            <span className="text-white text-sm">{member.name}</span>
                                            <span className="text-gray-400 text-xs ml-2">{member.role}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeMember(index)}
                                            aria-label={`Remove ${member.name}`}
                                            className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/80 text-white text-sm font-bold"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Name and Role share a row; Add sits on its own full-width
                            row below. min-w-0 lets the two inputs shrink inside the
                            modal instead of forcing the row wider than the panel and
                            clipping the button off the right edge. */}
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMember.name}
                                    onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Name"
                                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                />
                                <input
                                    type="text"
                                    value={newMember.role}
                                    onChange={(e) => setNewMember(prev => ({ ...prev, role: e.target.value }))}
                                    placeholder="Role"
                                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={addMember}
                                disabled={!newMember.name.trim() || !newMember.role.trim()}
                                className="w-full py-2 rounded-lg border border-dashed border-white/20 text-sm text-gray-300 hover:border-violet-500/50 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/20 disabled:hover:text-gray-300 transition-colors"
                            >
                                Add member
                            </button>
                        </div>
                    </div>
                </>
            ),
        },
    ];

    return (
        <StepperModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit creator profile' : 'Apply as a creator'}
            steps={steps}
            step={step}
            onStepChange={setStep}
            onFinish={handleSubmit}
            finishLabel={isEditing ? 'Save changes' : 'Submit application'}
            isFinishing={isSubmitting}
            canAdvance={canAdvance}
            onReset={resetForm}
        />
    );
}
