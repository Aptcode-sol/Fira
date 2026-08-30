'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';

/** Badges that mean the account is an admin-approved creator. */
const CREATOR_BADGES = ['brand', 'band', 'organizer'];

/** Review state of a creator application. Mirrors BrandProfile.status. */
export type CreatorStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

/**
 * The account's creator state, as one control.
 *
 * Five states, because "apply as creator" is a review process rather than a switch:
 *
 *   none      -> Apply as Creator   (goes to the application form)
 *   pending   -> Applied            (tap explains it is awaiting review)
 *   approved  -> Verified Creator   (goes to the creator dashboard)
 *   rejected  -> Reapply            (back to the form)
 *   blocked   -> Blocked            (tap points at support; reapplying cannot help)
 *
 * The state comes from `status`, i.e. BrandProfile.status off the dashboard
 * payload, not from the user object. `user.creatorApplicationStatus` was declared
 * on the client type but no endpoint ever set it, so the pending state could never
 * appear - an applicant awaiting review saw "Apply as Creator" and applied again.
 * The profile document is where the admin decision is actually recorded.
 *
 * `verificationBadge` is used only as a stand-in while that payload is still in
 * flight, so an approved creator does not flash "Apply as Creator" on every load.
 * The badge is granted solely on approval now (fixed in brandService /
 * adminService), so the two agree.
 */
export default function CreatorStatusButton({
    status,
    className = '',
}: {
    status?: CreatorStatus | null;
    className?: string;
}) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();

    const badged = Boolean(user?.verificationBadge && CREATOR_BADGES.includes(user.verificationBadge));
    const state = status ?? (badged ? 'approved' : null);

    if (state === 'approved') {
        return (
            <Link href="/dashboard/creator" className={className}>
                <Button
                    variant="secondary"
                    className="w-full justify-center bg-violet-500/20 border-violet-500/30 text-violet-400 hover:bg-violet-500/30"
                >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified Creator
                </Button>
            </Link>
        );
    }

    if (state === 'pending') {
        // Tappable, not disabled. A disabled button gives no answer to the only
        // question an applicant has - "did it go through, and what now?" - and
        // disabled controls are skipped by screen readers entirely.
        return (
            <Button
                variant="secondary"
                onClick={() =>
                    showToast(
                        'Your creator application is with our team for review. You will be notified once it is approved.',
                        'info'
                    )
                }
                className={`justify-center bg-yellow-500/20 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30 ${className}`}
            >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Applied
            </Button>
        );
    }

    if (state === 'blocked') {
        // Separate from rejected on purpose: rejected invites another attempt,
        // blocked does not. Sending a blocked account back to the form would just
        // produce an application that cannot be approved.
        return (
            <Button
                variant="secondary"
                onClick={() =>
                    showToast(
                        'Your creator profile has been blocked. Please contact support if you think this is a mistake.',
                        'error'
                    )
                }
                className={`justify-center bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30 ${className}`}
            >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 11-12.728 12.728 9 9 0 0112.728-12.728zM5.636 5.636l12.728 12.728" />
                </svg>
                Blocked
            </Button>
        );
    }

    if (state === 'rejected') {
        return (
            <Button
                variant="secondary"
                onClick={() => {
                    showToast('Your previous application was not approved. You can apply again.', 'info');
                    router.push('/create/creator');
                }}
                className={`justify-center bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30 ${className}`}
            >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reapply
            </Button>
        );
    }

    return (
        <Link href="/create/creator" className={className}>
            <Button variant="secondary" className="w-full justify-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Apply as Creator
            </Button>
        </Link>
    );
}
