'use client';

import Link from 'next/link';
import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from './animations';

const features = [
    {
        title: 'Dedicated Page',
        description: 'Your own branded space for updates and announcements',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
            </svg>
        ),
    },
    {
        title: 'Fan Following',
        description: 'Connect with your audience and grow your fanbase',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
    {
        title: 'Easy Event Flow',
        description: 'Simple tools to organize events and manage tickets',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
        ),
    },
    {
        title: 'Verified Badge',
        description: 'Get verified and stand out from the crowd',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
        ),
    },
];

export default function BrandBandSection() {
    return (
        <section className="min-h-screen py-24 px-4 sm:px-6 lg:px-8 flex items-center">
            <div className="max-w-7xl mx-auto w-full">
                <FadeIn>
                    <div className="bg-black/70 backdrop-blur-sm rounded-3xl p-8 md:p-16 md:py-30 lg:p-20 lg:py-40 border border-white/10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            {/* Left Content */}
                            <SlideUp>
                                <div>
                                    <div className="inline-flex items-center gap-2 text-violet-400 text-sm mb-4">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        For Verified Artists
                                    </div>

                                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-white">
                                        Are you a <br /><span className="accent-text">Brand / Band</span>?
                                    </h2>

                                    <p className="text-gray-400 mb-8 leading-relaxed">
                                        Don't worry, we care for you. Organize your events, parties, and celebrate the moments with ease.
                                        Get your dedicated space and connect with your fans like never before.
                                    </p>

                                    <Link
                                        href="/brands"
                                        className="inline-flex items-center gap-2 text-white hover:text-violet-400 transition-colors"
                                    >
                                        Learn more
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </Link>
                                </div>
                            </SlideUp>

                            {/* Right - Features */}
                            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                        </div>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}

