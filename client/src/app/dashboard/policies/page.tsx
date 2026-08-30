'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { SlideUp, FadeIn } from '@/components/animations';
import Link from 'next/link';

export default function PoliciesPage() {
    const policies = [
        {
            title: 'Terms & Conditions',
            description: 'The main agreement covering accounts, ticketing, venue bookings, payments, refunds, and liability.',
            href: '/terms',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
            color: 'violet',
        },
        {
            title: 'Organiser Agreement',
            description: 'Ticket revenue, escrow, payout timelines, and cancellation terms if you host a ticketed event.',
            href: '/organiser-agreement',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
            ),
            color: 'blue',
        },
        {
            title: 'Host Agreement',
            description: 'Listing standards, payout conditions, and claim handling if you list a venue.',
            href: '/host-agreement',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            ),
            color: 'green',
        },
        {
            title: 'Help & Support',
            description: 'Get help with your account, events, or bookings.',
            href: '/help',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            color: 'cyan',
        },
    ];

    const colorClasses: Record<string, { bg: string; text: string }> = {
        violet: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
        blue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
        green: { bg: 'bg-green-500/20', text: 'text-green-400' },
        pink: { bg: 'bg-pink-500/20', text: 'text-pink-400' },
        orange: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
        cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    };

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8">
                {/* Header */}
                <SlideUp>
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Legal & Agreements</h1>
                        <p className="text-gray-300">The three documents that govern your use of FIRA.</p>
                    </div>
                </SlideUp>

                {/* Policy Cards Grid */}
                <FadeIn delay={0.1}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {policies.map((policy, index) => (
                            <Link key={policy.href} href={policy.href}>
                                <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 group cursor-pointer h-full">
                                    <div className={`w-12 h-12 rounded-xl ${colorClasses[policy.color].bg} ${colorClasses[policy.color].text} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                                        {policy.icon}
                                    </div>
                                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-violet-400 transition-colors">
                                        {policy.title}
                                    </h3>
                                    <p className="text-sm text-gray-300">
                                        {policy.description}
                                    </p>
                                    <div className="mt-4 flex items-center text-sm text-violet-400 group-hover:gap-2 transition-all">
                                        <span>Read more</span>
                                        <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </FadeIn>

                {/* Contact Section */}
                <FadeIn delay={0.2}>
                    <div className="mt-8 bg-gradient-to-r from-violet-500/10 to-pink-500/10 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">Have questions?</h3>
                                <p className="text-gray-300 text-sm">
                                    Our support team is here to help you with any policy-related questions.
                                </p>
                            </div>
                            <Link href="mailto:support@letsfira.com" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-gray-200 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Contact Support
                            </Link>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </DashboardLayout>
    );
}
