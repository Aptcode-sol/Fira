'use client';

import Link from 'next/link';
import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from './animations';

const features = [
    {
        title: 'List Your Space',
        description: 'Showcase your venue with photos, amenities, and pricing',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        title: 'Easy Bookings',
        description: 'Let organizers book your venue with simple clicks',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
    },
    {
        title: 'Manage Schedule',
        description: 'Control availability and manage all your bookings',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    {
        title: 'Earn More',
        description: 'Get paid securely for every successful booking',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
];

export default function VenueOwnerSection() {
    return (
        <section className="min-h-screen py-24 px-4 sm:px-6 lg:px-8 flex items-center">
            <div className="max-w-7xl mx-auto w-full">
                <FadeIn>
                    <div className="bg-black/70 backdrop-blur-sm rounded-3xl p-8 md:p-16  md:py-30 lg:p-20 lg:py-40 border border-white/10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            {/* Left - Features */}
                            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-6 order-2 lg:order-1">
                                {features.map((feature) => (
                                    <StaggerItem key={feature.title}>
                                        <div className="glass-card p-5 group h-full">
                                            <div className="text-violet-400 mb-3">
                                                {feature.icon}
                                            </div>
                                            <h3 className="text-white font-medium mb-1">{feature.title}</h3>
                                            <p className="text-gray-500 text-sm">{feature.description}</p>
                                        </div>
                                    </StaggerItem>
                                ))}
                            </StaggerContainer>

                            {/* Right Content */}
                            <SlideUp className="order-1 lg:order-2">
                                <div>
                                    <div className="inline-flex items-center gap-2 text-violet-400 text-sm mb-4">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        For Venue Owners
                                    </div>

                                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-white">
                                        Rent your venues for <span className="accent-text">events</span>?
                                    </h2>

                                    <p className="text-gray-400 mb-8 leading-relaxed">
                                        We are here for you. List your places and let organizers book your venue easily.
                                        Manage your bookings, set your prices, and earn from every event.
                                    </p>

                                    <Link
                                        href="/list-venue"
                                        className="inline-flex items-center gap-2 text-white hover:text-violet-400 transition-colors"
                                    >
                                        Start listing
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </Link>
                                </div>
                            </SlideUp>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}

