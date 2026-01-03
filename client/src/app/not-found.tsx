'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui';
import PartyBackground from '@/components/PartyBackground';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
            <PartyBackground />

            {/* Animated gradient orbs */}
            <motion.div
                className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-[120px]"
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
            <motion.div
                className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/20 rounded-full blur-[100px]"
                animate={{
                    scale: [1.2, 1, 1.2],
                    opacity: [0.2, 0.4, 0.2],
                }}
                transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />

            <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
                {/* Animated 404 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center"
                >
                    {/* Glitchy 404 text */}
                    <motion.h1
                        className="text-[150px] md:text-[200px] font-black leading-none tracking-tighter bg-gradient-to-b from-white via-white/80 to-white/20 bg-clip-text text-transparent select-none"
                        animate={{
                            textShadow: [
                                '0 0 40px rgba(139, 92, 246, 0.5)',
                                '0 0 80px rgba(139, 92, 246, 0.3)',
                                '0 0 40px rgba(139, 92, 246, 0.5)',
                            ],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    >
                        404
                    </motion.h1>

                    {/* Decorative line */}
                    <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="h-px w-48 mx-auto bg-gradient-to-r from-transparent via-violet-500 to-transparent mb-8"
                    />

                    {/* Message */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                    >
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                            Oops! Page Not Found
                        </h2>
                        <p className="text-gray-400 max-w-md mx-auto mb-8 text-lg">
                            The page you&apos;re looking for doesn&apos;t exist or has been moved.
                            Let&apos;s get you back on track.
                        </p>
                    </motion.div>

                    {/* Action buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.6 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center"
                    >
                        <Link href="/">
                            <Button size="lg" className="group">
                                <svg
                                    className="w-5 h-5 mr-2 transition-transform group-hover:-translate-x-1"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Back to Home
                            </Button>
                        </Link>
                        <Link href="/events">
                            <Button variant="secondary" size="lg">
                                <svg
                                    className="w-5 h-5 mr-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Browse Events
                            </Button>
                        </Link>
                    </motion.div>

                    {/* Quick links */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.8 }}
                        className="mt-16 flex flex-wrap gap-6 justify-center text-sm"
                    >
                        <Link href="/venues" className="text-gray-500 hover:text-violet-400 transition-colors">
                            Venues
                        </Link>
                        <Link href="/brands" className="text-gray-500 hover:text-violet-400 transition-colors">
                            Brands
                        </Link>
                        <Link href="/create" className="text-gray-500 hover:text-violet-400 transition-colors">
                            Create
                        </Link>
                        <Link href="/dashboard" className="text-gray-500 hover:text-violet-400 transition-colors">
                            Dashboard
                        </Link>
                    </motion.div>
                </motion.div>

                {/* Floating particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(6)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute w-2 h-2 bg-violet-500/30 rounded-full"
                            style={{
                                left: `${15 + i * 15}%`,
                                top: `${20 + (i % 3) * 25}%`,
                            }}
                            animate={{
                                y: [0, -30, 0],
                                opacity: [0.3, 0.6, 0.3],
                            }}
                            transition={{
                                duration: 3 + i * 0.5,
                                repeat: Infinity,
                                delay: i * 0.4,
                                ease: "easeInOut",
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
