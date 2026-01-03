'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from '@/components/animations';

export default function CreatePage() {
    const router = useRouter();

    const handleCreate = () => {
        router.push('/signin');
    };

    const options = [
        {
            title: 'Create an Event',
            description: 'Host parties, concerts, workshops, or any gathering. Sell tickets or make it free.',
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            color: 'violet',
            path: '/create/event',
            features: ['Public & Private', 'Ticketing', 'Free Events'],
        },
        {
            title: 'List a Venue',
            description: 'Own a space? List it on FIRA and start earning from bookings.',
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
            color: 'pink',
            path: '/create/venue',
            features: ['Monetize', 'Manage Bookings', 'Analytics'],
        },
        {
            title: 'Create a Brand',
            description: 'Build your brand presence. Share updates, connect with followers, and grow your audience.',
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            ),
            color: 'cyan',
            path: '/create/brand',
            features: ['Social Feed', 'Followers', 'Verification'],
        },
    ];

    const getColorClasses = (color: string) => {
        const colors: Record<string, { bg: string; border: string; text: string; iconBg: string; hover: string }> = {
            violet: {
                bg: 'bg-violet-500/10',
                border: 'border-violet-500/20',
                text: 'text-violet-400',
                iconBg: 'bg-violet-500/20',
                hover: 'hover:border-violet-500/40',
            },
            pink: {
                bg: 'bg-pink-500/10',
                border: 'border-pink-500/20',
                text: 'text-pink-400',
                iconBg: 'bg-pink-500/20',
                hover: 'hover:border-pink-500/40',
            },
            cyan: {
                bg: 'bg-cyan-500/10',
                border: 'border-cyan-500/20',
                text: 'text-cyan-400',
                iconBg: 'bg-cyan-500/20',
                hover: 'hover:border-cyan-500/40',
            },
        };
        return colors[color] || colors.violet;
    };

    return (
        <>
            <PartyBackground />
            <Navbar />

            <main className="relative z-20 min-h-screen pt-28 pb-16 px-4">
                <div className="max-w-5xl mx-auto">
                    {/* Header */}
                    <SlideUp>
                        <div className="text-center mb-12">
                            <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6">
                                What would you like to <span className="text-violet-400">create</span>?
                            </h1>
                            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                                Start organizing your next unforgettable experience. Events, venues, or build your brand.
                            </p>
                        </div>
                    </SlideUp>

                    {/* Options Grid */}
                    <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {options.map((option, index) => {
                            const colors = getColorClasses(option.color);
                            return (
                                <StaggerItem key={option.title}>
                                    <button
                                        key={option.title}
                                        onClick={() => router.push(option.path)}
                                        className={`group text-left h-full bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-6 transition-all duration-300 ${colors.hover} hover:-translate-y-1`}
                                    >
                                        {/* Icon */}
                                        <div className={`w-14 h-14 rounded-xl ${colors.iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                                            <div className={colors.text}>
                                                {option.icon}
                                            </div>
                                        </div>

                                        {/* Title */}
                                        <h2 className={`text-xl font-bold text-white mb-2 group-hover:${colors.text} transition-colors`}>
                                            {option.title}
                                        </h2>

                                        {/* Description */}
                                        <p className="text-gray-400 text-sm mb-5 leading-relaxed">
                                            {option.description}
                                        </p>

                                        {/* Features */}
                                        <div className="flex flex-wrap gap-2">
                                            {option.features.map((feature) => (
                                                <span
                                                    key={feature}
                                                    className={`px-2.5 py-1 rounded-full ${colors.bg} ${colors.border} border ${colors.text} text-xs`}
                                                >
                                                    {feature}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Arrow indicator */}
                                        <div className="mt-6 flex items-center gap-2 text-gray-500 group-hover:text-white transition-colors">
                                            <span className="text-sm font-medium">Get started</span>
                                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </button>
                                </StaggerItem>
                            );
                        })}
                    </StaggerContainer>

                    {/* Stats Section */}
                    <FadeIn>
                        <div className="mt-16 grid grid-cols-3 gap-6">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-white mb-1">500+</div>
                                <div className="text-gray-500 text-sm">Events Created</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-white mb-1">100+</div>
                                <div className="text-gray-500 text-sm">Venues Listed</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-white mb-1">10K+</div>
                                <div className="text-gray-500 text-sm">Tickets Sold</div>
                            </div>
                        </div>
                    </FadeIn>

                    {/* CTA Section */}
                    <FadeIn>
                        <div className="mt-16 bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl p-8 text-center">
                            <SlideUp>
                                <h3 className="text-xl font-bold text-white mb-2">Need help getting started?</h3>
                                <p className="text-gray-400 mb-6">
                                    Check out our guides or contact support for assistance.
                                </p>
                                <div className="flex justify-center gap-4">
                                    <Link
                                        href="/help"
                                        className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                                    >
                                        View Guides
                                    </Link>
                                    <Link
                                        href="/contact"
                                        className="px-6 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors"
                                    >
                                        Contact Support
                                    </Link>
                                </div>
                            </SlideUp>
                        </div>
                    </FadeIn>
                </div>
            </main>
        </>
    );
}
