'use client';

import Link from 'next/link';
import { FadeIn, SlideUp } from '@/components/animations';

/**
 * "What is FIRA?" - the explainer that sits directly under the hero.
 *
 * Two jobs:
 *   1. A first-time visitor lands on a black page that says "FIRA" in huge
 *      letters and nothing else. This tells them, in plain words, what the
 *      product does and which of the two sides of it they are here for.
 *   2. It is the only place on the homepage that states the brand definition in
 *      prose ("FIRA - also written Lets FIRA or letsfira - is..."). Search
 *      engines read the homepage first, and they cannot associate a brand name
 *      they have never seen defined.
 */

const attendSteps = [
    {
        title: 'Browse what is on near you',
        body: 'Pick your city and see every party, concert, DJ night and festival coming up. Filter by date, category, and whether it is free or paid.',
    },
    {
        title: 'Book your ticket in a couple of taps',
        body: 'Pay online with UPI, card or netbanking. Prices are shown up front - what you see is what you pay.',
    },
    {
        title: 'Walk in with a QR code',
        body: 'Your ticket arrives by email the moment you pay, and lives in your dashboard. The organiser scans it at the door. No printing, no queue.',
    },
];

const hostSteps = [
    {
        title: 'Find a venue that fits',
        body: 'Banquet halls, rooftops, clubs, resorts, farmhouses and open-air spaces - every one reviewed before it goes live. Compare capacity, amenities and starting price.',
    },
    {
        title: 'Check the date and request it',
        body: 'See which venues are free on your date and send a booking request straight to the owner. They confirm or decline - no middleman, no chasing.',
    },
    {
        title: 'Publish, sell, get paid',
        body: 'Put your event live as public or private, sell tickets, scan guests in at the door with the built-in scanner, and receive your payout after the event.',
    },
];

const facts = [
    { label: 'Free to join', detail: 'You only pay when you book' },
    { label: 'Verified venues', detail: 'Every listing is reviewed' },
    { label: 'Instant tickets', detail: 'QR code by email, immediately' },
    { label: 'Secure payments', detail: 'Online payment and payouts' },
    { label: 'Across India', detail: 'Mumbai, Delhi, Bangalore & more' },
];

function StepList({ steps, accent }: { steps: typeof attendSteps; accent: string }) {
    return (
        <ol className="space-y-5">
            {steps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                    <span
                        className={`shrink-0 w-7 h-7 rounded-full ${accent} text-white text-xs font-bold flex items-center justify-center mt-0.5`}
                    >
                        {index + 1}
                    </span>
                    <div>
                        <h4 className="text-white font-semibold mb-1">{step.title}</h4>
                        <p className="text-gray-400 text-sm leading-relaxed">{step.body}</p>
                    </div>
                </li>
            ))}
        </ol>
    );
}

export default function WhatIsFira() {
    return (
        <section
            id="what-is-fira"
            aria-labelledby="what-is-fira-heading"
            className="relative z-20 px-4 sm:px-6 lg:px-8 py-20 md:py-28"
        >
            <div className="max-w-6xl mx-auto">
                {/* Definition */}
                <SlideUp>
                    <div className="max-w-3xl mx-auto text-center mb-14">
                        <h2
                            id="what-is-fira-heading"
                            className="text-3xl md:text-5xl font-bold text-white mb-6"
                        >
                            What is <span className="accent-text">FIRA</span>?
                        </h2>
                        <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-5">
                            FIRA - also written <strong className="text-white">Lets FIRA</strong> or{' '}
                            <strong className="text-white">letsfira</strong> - is where you find
                            parties worth going to, and where you book the place to throw your own.
                        </p>
                        <p className="text-gray-500 leading-relaxed">
                            One side of FIRA is discovery: everything happening in your city, with
                            tickets you can buy on the spot. The other side is hosting: verified
                            venues you can compare, book and pay for, then run your own event on top
                            of - tickets, guest list, door scanning and payouts included. Most people
                            start on one side and end up using both.
                        </p>
                    </div>
                </SlideUp>

                {/* The two sides */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-14">
                    <FadeIn delay={0.1}>
                        <div className="h-full rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="w-10 h-10 rounded-2xl bg-violet-500/20 text-violet-300 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                    </svg>
                                </span>
                                <h3 className="text-2xl font-bold text-white">You want to go out</h3>
                            </div>
                            <p className="text-gray-500 text-sm mb-7">
                                Find something happening this weekend and be there.
                            </p>
                            <StepList steps={attendSteps} accent="bg-violet-500" />
                            <Link
                                href="/events"
                                className="mt-8 inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                            >
                                Browse events near you →
                            </Link>
                        </div>
                    </FadeIn>

                    <FadeIn delay={0.2}>
                        <div className="h-full rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="w-10 h-10 rounded-2xl bg-pink-500/20 text-pink-300 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </span>
                                <h3 className="text-2xl font-bold text-white">You want to host</h3>
                            </div>
                            <p className="text-gray-500 text-sm mb-7">
                                A birthday, a wedding, a gig, a corporate night - book the space and run it.
                            </p>
                            <StepList steps={hostSteps} accent="bg-pink-500" />
                            <Link
                                href="/venues"
                                className="mt-8 inline-flex items-center gap-2 text-pink-400 hover:text-pink-300 font-semibold transition-colors"
                            >
                                Find a venue →
                            </Link>
                        </div>
                    </FadeIn>
                </div>

                {/* Answers to the questions people ask before signing up */}
                <FadeIn delay={0.3}>
                    <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm px-6 py-8 md:px-10">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                            {facts.map(fact => (
                                <div key={fact.label}>
                                    <p className="text-white font-semibold text-sm mb-1">{fact.label}</p>
                                    <p className="text-gray-500 text-xs leading-relaxed">{fact.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </FadeIn>

                {/* Who else is on FIRA */}
                <FadeIn delay={0.35}>
                    <p className="text-center text-gray-500 mt-10 max-w-2xl mx-auto leading-relaxed">
                        Bands, DJs, brands and event organisers run their own pages on FIRA too -
                        followers get notified the moment they announce something new.{' '}
                        <Link href="/about" className="text-violet-400 hover:text-violet-300 transition-colors">
                            Read more about FIRA
                        </Link>
                        .
                    </p>
                </FadeIn>
            </div>
        </section>
    );
}
