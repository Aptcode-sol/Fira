'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { inquiriesApi, messagesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

export type InquiryReference = 'event' | 'venue' | 'creator';

interface InquiryFormProps {
    referenceType: InquiryReference;
    referenceId: string;
    referenceName: string;
    onClose: () => void;
}

/** Who the sender is actually writing to, for the copy. */
const COUNTERPARTY: Record<InquiryReference, string> = {
    event: 'organizer',
    venue: 'venue owner',
    creator: 'creator',
};

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;

/**
 * "Ask a question" on an event or venue. The question opens a chat thread with
 * the organizer/owner, so this collects only the question itself:
 *
 * - Name and email used to be fields here, but the server derives both from the
 *   authenticated account and explicitly ignores whatever the body sends
 *   (inquiryService.submitInquiry). They were read-only for signed-in users and
 *   discarded for everyone, so they only added steps.
 * - Phone was never stored by the server at all.
 * - Reference type/name were read-only inputs restating the page you are already
 *   on; they are a heading now.
 */
export default function InquiryForm({ referenceType, referenceId, referenceName, onClose }: InquiryFormProps) {
    const { isAuthenticated, user } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();

    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // The server 401s an anonymous enquiry, and a chat thread needs an account to
    // reply into, so ask for sign-in up front instead of failing on submit.
    if (!isAuthenticated || !user?._id) {
        const redirect = `/${referenceType}s/${referenceId}`;
        return (
            <div className="space-y-5">
                <p className="text-gray-300 text-sm">
                    Sign in to ask about <span className="text-white font-medium">{referenceName}</span>. Your
                    question starts a chat with the {COUNTERPARTY[referenceType]}, so you get replies in one
                    place.
                </p>
                <div className="flex gap-3 pt-2">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        className="flex-1"
                        onClick={() => {
                            window.location.href = `/signin?redirect=${encodeURIComponent(redirect)}`;
                        }}
                    >
                        Sign in
                    </Button>
                </div>
            </div>
        );
    }

    const trimmed = message.trim();
    const canSubmit = trimmed.length >= MESSAGE_MIN && trimmed.length <= MESSAGE_MAX && !isSubmitting;

    const handleSubmit = async () => {
        if (trimmed.length < MESSAGE_MIN) {
            setError(`Please write at least ${MESSAGE_MIN} characters`);
            return;
        }
        setError('');
        setIsSubmitting(true);
        try {
            // A creator has no Inquiry record behind it - the thread with the brand
            // owner IS the enquiry. Still gated behind this form rather than opening
            // a thread on a bare button press: that created an empty conversation
            // that then sat in both inboxes forever reading "No messages yet".
            if (referenceType === 'creator') {
                const { conversation } = await messagesApi.startBrandEnquiry({
                    brandId: referenceId,
                    message: trimmed,
                });
                onClose();
                showToast('Question sent. Opening your chat...', 'success');
                router.push(`/messages?conversation=${conversation._id}`);
                return;
            }

            // The enquiry record is always created first, then promoted to a chat
            // thread. The inquiry's own id is what the server needs to resolve the
            // owner - it will not take a reference id from the client.
            const inquiry = await inquiriesApi.submit({
                referenceType,
                referenceId,
                message: trimmed,
            });
            onClose();
            showToast('Question sent. Opening your chat...', 'success');

            try {
                const { conversation } = await messagesApi.startInquiryConversation({
                    inquiryId: inquiry._id,
                    message: trimmed,
                });
                // router.push, not window.location: a full page load tears down the
                // toast provider, so the confirmation above would flash and die.
                router.push(`/messages?conversation=${conversation._id}`);
            } catch (convErr) {
                // The enquiry landed, so this is not a failed submit - but the
                // sender still needs telling that the thread did not open,
                // otherwise the silence looks like nothing happened.
                console.error('Failed to open inquiry conversation:', convErr);
                showToast('Enquiry sent. Opening the chat failed - find it under Enquiries.', 'info');
            }
        } catch (err: any) {
            if (err.status === 429) {
                showToast(err.message || 'Too many enquiries for this listing. Try again later.', 'error');
            } else if (err.status === 400) {
                showToast(err.message || 'This listing is unavailable', 'error');
            } else {
                showToast(err.message || 'Failed to send enquiry', 'error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-5">
            <p className="text-sm text-gray-300">
                Asking about <span className="text-white font-medium">{referenceName}</span>. This starts a chat
                with the {COUNTERPARTY[referenceType]}.
            </p>

            <div>
                <label htmlFor="enquiry-message" className="block text-sm font-medium text-gray-300 mb-2">
                    Your question <span className="text-red-400">*</span>
                </label>
                <textarea
                    id="enquiry-message"
                    value={message}
                    onChange={(e) => {
                        setMessage(e.target.value.slice(0, MESSAGE_MAX));
                        if (error) setError('');
                    }}
                    placeholder="What would you like to know?"
                    rows={5}
                    maxLength={MESSAGE_MAX}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                    aria-describedby="enquiry-message-help"
                    required
                />
                <div id="enquiry-message-help" className="flex justify-between mt-1">
                    {error && <p className="text-red-400 text-xs">{error}</p>}
                    <p className="text-xs text-gray-500 ml-auto">
                        {message.length}/{MESSAGE_MAX}
                    </p>
                </div>
            </div>

            <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={onClose}>
                    Cancel
                </Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={!canSubmit}>
                    {isSubmitting ? 'Sending...' : 'Send question'}
                </Button>
            </div>
        </div>
    );
}
