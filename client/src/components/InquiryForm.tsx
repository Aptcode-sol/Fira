'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { inquiriesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

interface InquiryFormProps {
    referenceType: 'event' | 'venue';
    referenceId: string;
    referenceName: string;
    onClose: () => void;
}

export default function InquiryForm({ referenceType, referenceId, referenceName, onClose }: InquiryFormProps) {
    const { isAuthenticated, user } = useAuth();
    const { showToast } = useToast();

    const [senderName, setSenderName] = useState(user?.name || '');
    const [senderEmail, setSenderEmail] = useState(user?.email || '');
    const [senderPhone, setSenderPhone] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!senderName.trim()) newErrors.senderName = 'Name is required';
        if (!senderEmail.trim()) newErrors.senderEmail = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) newErrors.senderEmail = 'Invalid email format';
        if (!message.trim()) newErrors.message = 'Message is required';
        else if (message.trim().length < 10) newErrors.message = 'Message must be at least 10 characters';
        else if (message.trim().length > 2000) newErrors.message = 'Message must be at most 2000 characters';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setIsSubmitting(true);
        try {
            await inquiriesApi.submit({
                referenceType,
                referenceId,
                senderName: senderName.trim(),
                senderEmail: senderEmail.trim(),
                senderPhone: senderPhone.trim() || undefined,
                message: message.trim(),
            });
            showToast('Inquiry submitted successfully!', 'success');
            onClose();
        } catch (err: any) {
            if (err.status === 400) {
                showToast(err.message || 'Reference is unavailable', 'error');
            } else if (err.status === 429) {
                showToast(err.message || 'Rate limit exceeded. Try again later.', 'error');
            } else {
                showToast(err.message || 'Failed to submit inquiry', 'error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Read-only reference fields */}
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Reference Type</label>
                    <input
                        type="text"
                        value={referenceType === 'event' ? 'Event' : 'Venue'}
                        readOnly
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed"
                        aria-label="Reference type"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Reference Name</label>
                    <input
                        type="text"
                        value={referenceName}
                        readOnly
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed"
                        aria-label="Reference name"
                    />
                </div>
            </div>

            {/* Sender fields */}
            <div className="space-y-3">
                <Input
                    label="Your Name"
                    placeholder="Enter your name"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    readOnly={isAuthenticated && !!user?.name}
                    error={errors.senderName}
                    required
                />
                <Input
                    label="Your Email"
                    placeholder="Enter your email"
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    readOnly={isAuthenticated && !!user?.email}
                    error={errors.senderEmail}
                    required
                />
                <Input
                    label="Phone (optional)"
                    placeholder="Enter your phone number"
                    type="tel"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                />
            </div>

            {/* Message */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Message <span className="text-red-400">*</span>
                </label>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                    placeholder="What would you like to know?"
                    rows={4}
                    maxLength={2000}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                    aria-label="Message"
                    required
                />
                <div className="flex justify-between mt-1">
                    {errors.message && <p className="text-red-400 text-xs">{errors.message}</p>}
                    <p className="text-xs text-gray-500 ml-auto">{message.length}/2000</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={onClose}>
                    Cancel
                </Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
                </Button>
            </div>
        </div>
    );
}
