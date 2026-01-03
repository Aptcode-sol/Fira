'use client';

import Link from 'next/link';
import { FadeIn, SlideUp } from './animations';

export default function CTASection() {
    return (
        <FadeIn>
            <section className="min-h-screen py-24 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
                <div className="max-w-3xl mx-auto text-center">
                    <SlideUp>
                        <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-white">
                            Let's start the <span className="accent-text">party</span>
                        </h2>
                    </SlideUp>

                    <SlideUp delay={0.15}>
                        <p className="text-gray-500 text-lg mb-10 max-w-xl mx-auto">
                            Join thousands of party lovers, venue owners, and artists. Your next celebration starts here.
                        </p>
                    </SlideUp>

                    <SlideUp delay={0.3}>
                        <Link
                            href="/signup"
                            className="btn-primary px-10 py-4 rounded-full font-medium text-lg inline-flex items-center gap-2"
                        >
                            Join Now
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </Link>
                    </SlideUp>
                </div>
            </section>
        </FadeIn>
    );
}

