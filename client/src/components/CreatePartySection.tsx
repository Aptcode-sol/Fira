'use client';

import Link from 'next/link';
import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from './animations';

const steps = [
    {
        number: '01',
        title: 'Book Venue',
        description: 'Find and book the perfect venue for your party',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
    },
    {
        number: '02',
        title: 'Create Party',
        description: 'Set up your event as public or private',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
        ),
    },
    {
        number: '03',
        title: 'Share & Celebrate',
        description: 'Invite guests and enjoy your party',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
        ),
    },
];

export default function CreatePartySection() {
    return (
        <FadeIn>
            <section id="create-section" className="min-h-screen py-24 px-4 sm:px-6 lg:px-8 flex items-center">
                <div className="max-w-5xl mx-auto">
                    {/* Section Header */}
                    <SlideUp>
                        <div className="text-center mb-16">
                            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 text-white">
                                Want to create a <span className="accent-text">party</span>?
                            </h2>
                            <p className="text-gray-500 max-w-xl mx-auto">
                                It's simple. Follow these three easy steps.
                            </p>
                        </div>
                    </SlideUp>

                    {/* Steps */}
                    <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                        {steps.map((step, index) => (
                            <StaggerItem key={step.number}>
                                <div className="relative text-center group">
                                    {/* Connector line */}
                                    {index < steps.length - 1 && (
                                        <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-white/20 to-transparent"></div>
                                    )}

                                    {/* Step number */}
                                    <div className="text-5xl font-bold text-white/5 mb-4 group-hover:text-violet-500/10 transition-colors">
                                        {step.number}
                                    </div>

                                    {/* Icon */}
                                    <div className="text-violet-400 mb-4 flex justify-center">
                                        {step.icon}
                                    </div>

                                    {/* Content */}
                                    <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                                    <p className="text-gray-500 text-sm">{step.description}</p>
                                </div>
                            </StaggerItem>
                        ))}
                    </StaggerContainer>

                    {/* CTA Button */}
                    <SlideUp delay={0.3}>
                        <div className="text-center">
                            <Link
                                href="/create"
                                className="btn-primary px-8 py-3.5 rounded-full font-medium inline-flex items-center gap-2"
                            >
                                Want to proceed?
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </Link>
                        </div>
                    </SlideUp>
                </div>
            </section>
        </FadeIn>
    );
}

