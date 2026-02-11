'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { SlideUp, FadeIn } from '@/components/animations';
import Link from 'next/link';

export default function PoliciesPage() {
    const policies = [
        {
            title: 'Privacy Policy',
            description: 'Learn how we collect, use, and protect your personal information.',
            href: '/privacy',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            ),
            color: 'violet',
        },
        {
            title: 'Terms of Service',
            description: 'Read the terms and conditions for using FIRA platform.',
            href: '/terms',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
            color: 'blue',
        },
        {
            title: 'Refund Policy',
            description: 'Understand our refund and cancellation policies for events and bookings.',
            href: '/refund-policy',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
            ),
            color: 'green',
        },
        {
            title: 'Community Guidelines',
            description: 'Our standards for creating a safe and inclusive community.',
            href: '/community-guidelines',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
            color: 'pink',
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
                        <h1 className="text-3xl font-bold text-white mb-2">Policies & Guidelines</h1>
                        <p className="text-gray-400">Review our policies, terms, and community guidelines.</p>
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
                                    <p className="text-sm text-gray-400">
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
                                <p className="text-gray-400 text-sm">
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
