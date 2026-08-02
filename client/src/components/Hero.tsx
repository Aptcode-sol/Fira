'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FadeIn } from './animations';
import { useAuth } from '@/contexts/AuthContext';

const rotatingWords = ['FIRA', 'Celebrate', 'Party', 'Dance'];

export default function Hero() {
    const [wordIndex, setWordIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
        const interval = setInterval(() => {
            setIsAnimating(true);
            setTimeout(() => {
                setWordIndex((prev) => (prev + 1) % rotatingWords.length);
                setIsAnimating(false);
            }, 300);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <section className="relative min-h-screen flex items-center justify-center pt-10">
            <div className="relative z-10 w-full max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 py-20 text-center">

                {/* Hero Content - Center aligned with proper text alignment */}
                <FadeIn duration={0.8} direction="up">
                    <div className="relative inline-block">
                        {/* Animated Tagline - Perfectly aligned with FIRA left edge */}
                        <div className="text-left">
                            <div className="text-lg sm:text-xl md:text-2xl font-medium mb-1 flex items-center gap-2">
                                <span className="text-gray-400">Let's</span>
                                <span
                                    className={`accent-text font-semibold transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
                                        }`}
                                >
                                    {rotatingWords[wordIndex]}
                                </span>
                            </div>

                            {/* Main FIRA - Bigger and bolder */}
                            <h1 className="text-[120px] sm:text-[140px] md:text-[180px] lg:text-[220px] font-black text-white leading-[0.85] tracking-[-0.03em] font-fascinate">
                                FIRA
                            </h1>
                        </div>
                    </div>
                </FadeIn>

                {/* Subtitle. States both sides of the product in one line -
                    a visitor should know what FIRA does before they scroll. */}
                <FadeIn delay={0.2} duration={0.6} direction="up">
                    <p className="text-gray-400 text-base sm:text-lg md:text-xl mt-8 mb-12 max-w-lg mx-auto leading-relaxed">
                        Find parties worth going to.
                        <br className="hidden sm:block" />{' '}
                        <span className="text-gray-500">Book the venue to throw your own.</span>
                    </p>
                </FadeIn>

                {/* CTA Buttons - Center aligned with proper spacing */}
                <FadeIn delay={0.4} duration={0.6} direction="up">
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex flex-row gap-4 justify-center">
                            {/* View Parties - Glass morphic rounded */}
                            <button
                                onClick={() => scrollToSection('parties-section')}
                                className="min-w-[160px] px-6 py-3.5 rounded-full text-white font-medium bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300"
                            >
                                View Parties
                            </button>

                            {/* Primary CTA. For a signed-out visitor the highest-value
                                action is creating an account, not scrolling further -
                                every visitor here is a lead we otherwise lose. */}
                            {!isLoading && !isAuthenticated ? (
                                <Link
                                    href="/signup"
                                    className="min-w-[160px] btn-primary px-6 py-3.5 rounded-full font-medium flex items-center justify-center"
                                >
                                    Get Started Free
                                </Link>
                            ) : (
                                <button
                                    onClick={() => scrollToSection('create-section')}
                                    className="min-w-[160px] btn-primary px-6 py-3.5 rounded-full font-medium"
                                >
                                    Create Parties
                                </button>
                            )}
                        </div>

                        {!isLoading && !isAuthenticated && (
                            <p className="text-gray-500 text-sm">
                                Free to join.{' '}
                                <button
                                    onClick={() => scrollToSection('create-section')}
                                    className="text-violet-400 hover:text-violet-300 transition-colors underline underline-offset-4"
                                >
                                    Or host your own party
                                </button>
                            </p>
                        )}
                    </div>
                </FadeIn>

                {/* Scroll cue. The hero fills the viewport, so without this
                    there is nothing telling a visitor the page continues. */}
                <FadeIn delay={0.9} duration={0.8}>
                    <button
                        onClick={() => scrollToSection('what-we-do')}
                        aria-label="Scroll to find out more"
                        className="hidden sm:flex absolute bottom-10 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-gray-600 hover:text-gray-400 transition-colors group"
                    >
                        <span className="text-[10px] uppercase tracking-[0.2em]">More</span>
                        <span className="w-5 h-8 rounded-full border border-white/15 flex justify-center pt-1.5 group-hover:border-white/30 transition-colors">
                            <span className="w-1 h-1.5 rounded-full bg-white/40 animate-bounce" />
                        </span>
                    </button>
                </FadeIn>
            </div>
        </section>
    );
}
