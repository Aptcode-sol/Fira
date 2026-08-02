'use client';

import Link from 'next/link';
import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from './animations';

/**
 * The homepage's statement of what FIRA actually is.
 *
 * Deliberately editorial rather than another card grid: the three sections that
 * follow (Create a party / Bands & brands / Rent your venue) are all
 * icon-title-description grids, so a fourth would make the page read as one
 * long repeated block. This one leads with type and uses hairline rules and
 * numerals instead of boxes, which breaks the rhythm and reads as a considered
 * opening statement rather than a feature list.
 */

const pillars = [
    {
        number: '01',
        title: 'Discover',
        body: 'Parties, concerts, DJ nights and festivals happening in your city — with tickets you can buy in a couple of taps.',
    },
    {
        number: '02',
        title: 'Book',
        body: 'Verified banquet halls, rooftops, clubs and farmhouses. Compare capacity and price, check your date, request the owner directly.',
    },
    {
        number: '03',
        title: 'Host',
        body: 'Publish your event, sell tickets, scan guests in at the door and get paid out. The whole night, run from one place.',
    },
];

export default function WhatWeDoSection() {
    return (
        <section
            id="what-we-do"
            aria-labelledby="what-we-do-heading"
            className="relative z-20 py-24 md:py-32 px-4 sm:px-6 lg:px-8"
        >
            <div className="max-w-5xl mx-auto">
                {/* Statement */}
                <SlideUp>
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <p className="text-xs uppercase tracking-[0.25em] text-violet-400/80 mb-6">
                            What is FIRA
                        </p>
                        <h2
                            id="what-we-do-heading"
                            className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-[1.05] tracking-tight mb-8"
                        >
                            Everything a party needs,
                            <br className="hidden sm:block" />{' '}
                            <span className="accent-text">in one place</span>.
                        </h2>
                        <p className="text-gray-400 text-lg leading-relaxed">
                            FIRA is where you find the night out — and where you book the room, sell
                            the tickets and run it yourself. Two sides of the same thing, for people
                            who go out and the people who make it happen.
                        </p>
                    </div>
                </SlideUp>

                {/* Pillars. Hairline rules instead of cards - lighter on the eye
                    and visually distinct from the grids further down the page. */}
                <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.06] border-y border-white/[0.06]">
                    {pillars.map((pillar) => (
                        <StaggerItem key={pillar.number}>
                            <div className="h-full bg-[#0a0a0a] px-6 py-10 md:px-8 md:py-12 group transition-colors duration-500 hover:bg-white/[0.015]">
                                <div className="flex items-baseline gap-4 mb-4">
                                    <span className="font-mono text-xs text-violet-400/50 group-hover:text-violet-400 transition-colors duration-500">
                                        {pillar.number}
                                    </span>
                                    <h3 className="text-2xl font-semibold text-white tracking-tight">
                                        {pillar.title}
                                    </h3>
                                </div>
                                <p className="text-gray-500 leading-relaxed text-[15px]">
                                    {pillar.body}
                                </p>
                            </div>
                        </StaggerItem>
                    ))}
                </StaggerContainer>

                {/* Both doors, side by side - the page should never assume which
                    of the two audiences a visitor belongs to. */}
                <FadeIn delay={0.2}>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center mt-16">
                        <Link
                            href="/events"
                            className="btn-primary px-8 py-3.5 rounded-full font-medium inline-flex items-center justify-center gap-2"
                        >
                            Find something tonight
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </Link>
                        <Link
                            href="/venues"
                            className="btn-secondary px-8 py-3.5 rounded-full font-medium inline-flex items-center justify-center"
                        >
                            Browse venues
                        </Link>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}
