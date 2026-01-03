'use client';

import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from './animations';

const steps = [
    {
        number: '01',
        title: 'List Your Venue',
        description: 'Venue owners can easily register and list their spaces with photos, amenities, and pricing.',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
    },
    {
        number: '02',
        title: 'Discover & Book',
        description: 'Users explore venues, check availability, and book instantly for parties or private events.',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        ),
    },
    {
        number: '03',
        title: 'Create & Sell Tickets',
        description: 'Host public events with ticket sales or create private gatherings with exclusive invite codes.',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
        ),
    },
];

const features = [
    {
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
        title: 'Verified Venues',
    },
    {
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
        title: 'GPS Location',
    },
    {
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
        ),
        title: 'Secure Payments',
    },
    {
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        ),
        title: 'Instant Chat',
    },
];

export default function HowItWorks() {
    return (
        <FadeIn>
            <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
                <div className="max-w-6xl mx-auto">
                    {/* Section Header */}
                    <SlideUp>
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-semibold mb-4 text-white">
                                How <span className="accent-text">FIRA</span> Works
                            </h2>
                            <p className="text-gray-500 max-w-xl mx-auto">
                                From listing your venue to hosting unforgettable events - simple and seamless.
                            </p>
                        </div>
                    </SlideUp>

                    {/* Steps - Clean minimal design */}
                    <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-20">
                        {steps.map((step) => (
                            <StaggerItem key={step.number}>
                                <div className="text-center group">
                                    {/* Step Number */}
                                    <div className="inline-flex items-center justify-center mb-6">
                                        <span className="text-6xl font-bold text-white/5 group-hover:text-violet-500/10 transition-colors duration-500">
                                            {step.number}
                                        </span>
                                    </div>

                                    {/* Icon - Clean, no background */}
                                    <div className="flex justify-center mb-4">
                                        <span className="text-violet-400 group-hover:text-violet-300 transition-colors">
                                            {step.icon}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
                                </div>
                            </StaggerItem>
                        ))}
                    </StaggerContainer>

                    {/* Features - Minimal inline style */}
                    <SlideUp delay={0.2}>
                        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
                            {features.map((feature) => (
                                <div
                                    key={feature.title}
                                    className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group"
                                >
                                    <span className="text-violet-400 group-hover:text-violet-300 transition-colors">
                                        {feature.icon}
                                    </span>
                                    <span className="text-sm font-medium">{feature.title}</span>
                                </div>
                            ))}
                        </div>
                    </SlideUp>
                </div>
            </section>
        </FadeIn>
    );
}

