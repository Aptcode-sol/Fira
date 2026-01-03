'use client';

import { useState, useEffect } from 'react';
import { FadeIn } from './animations';

const rotatingWords = ['FIRA', 'Celebrate', 'Party', 'Dance'];

export default function Hero() {
    const [wordIndex, setWordIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

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

                {/* Subtitle */}
                <FadeIn delay={0.2} duration={0.6} direction="up">
                    <p className="text-gray-500 text-base sm:text-lg md:text-xl mt-8 mb-12 max-w-md mx-auto leading-relaxed">
                        Create, book and enjoy parties on your own
                    </p>
                </FadeIn>

                {/* CTA Buttons - Center aligned with proper spacing */}
                <FadeIn delay={0.4} duration={0.6} direction="up">
                    <div className="flex flex-row gap-4 justify-center">
                        {/* View Parties - Glass morphic rounded */}
                        <button
                            onClick={() => scrollToSection('parties-section')}
                            className="min-w-[160px] px-6 py-3.5 rounded-full text-white font-medium bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300"
                        >
                            View Parties
                        </button>

                        {/* Create Parties - Solid white */}
                        <button
                            onClick={() => scrollToSection('create-section')}
                            className="min-w-[160px] btn-primary px-6 py-3.5 rounded-full font-medium"
                        >
                            Create Parties
                        </button>
                    </div>
                </FadeIn>

                {/* Scroll indicator */}
                {/* <FadeIn delay={0.8} duration={0.6} direction="up">
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
                        <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center pt-2">
                            <div className="w-1.5 h-2.5 bg-white/40 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                </FadeIn> */}
            </div>
        </section>
    );
}
