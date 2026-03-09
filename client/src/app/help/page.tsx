'use client';

import Navbar from '@/components/Navbar';

import PartyBackground from '@/components/PartyBackground';
import Link from 'next/link';

export default function HelpSupport() {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-violet-500/30">
            <PartyBackground />
            <Navbar />

            <main className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8 md:p-12">
                    <h1 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        Help & Support
                    </h1>

                    <div className="space-y-8 text-gray-300 leading-relaxed">
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">1. Frequently Asked Questions</h2>
                            <div className="space-y-4">
                                <details className="group bg-white/5 rounded-xl p-4 cursor-pointer">
                                    <summary className="font-medium text-white flex items-center justify-between">
                                        How do I create an account?
                                        <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </summary>
                                    <p className="mt-2 text-sm text-gray-400">
                                        You can create an account by clicking on the "Sign Up" button in the top right corner.
                                        Fill in your details, verify your email, and you're good to go!
                                    </p>
                                </details>

                                <details className="group bg-white/5 rounded-xl p-4 cursor-pointer">
                                    <summary className="font-medium text-white flex items-center justify-between">
                                        How can I list my venue?
                                        <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </summary>
                                    <p className="mt-2 text-sm text-gray-400">
                                        To list your venue, go to the Venue Portal link in the footer or menu, create a venue owner account,
                                        and follow the steps to add your venue details and photos.
                                    </p>
                                </details>

                                <details className="group bg-white/5 rounded-xl p-4 cursor-pointer">
                                    <summary className="font-medium text-white flex items-center justify-between">
                                        What payment methods are accepted?
                                        <svg className="w-5 h-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </summary>
                                    <p className="mt-2 text-sm text-gray-400">
                                        We accept all major credit/debit cards, UPI, and net banking through our secure payment gateway.
                                    </p>
                                </details>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">2. Contact Support</h2>
                            <p className="mb-6">
                                Can't find what you're looking for? Our support team is available 24/7 to assist you.
                            </p>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-white/5 p-6 rounded-xl border border-white/10 hover:border-cyan-500/50 transition-colors">
                                    <h3 className="text-lg font-medium text-white mb-2">Email Support</h3>
                                    <p className="text-sm text-gray-400 mb-4">For general inquiries and account help.</p>
                                    <a href="mailto:support@letsfira.com" className="text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-2">
                                        support@letsfira.com
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </a>
                                </div>

                                <div className="bg-white/5 p-6 rounded-xl border border-white/10 hover:border-blue-500/50 transition-colors">
                                    <h3 className="text-lg font-medium text-white mb-2">Partner Support</h3>
                                    <p className="text-sm text-gray-400 mb-4">For venue owners and event organizers.</p>
                                    <a href="mailto:support@letsfira.com" className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-2">
                                        support@letsfira.com
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">3. Report an Issue</h2>
                            <p>
                                If you encounter a technical issue or bug, please report it to our engineering team at
                                <a href="mailto:support@letsfira.com" className="text-cyan-400 hover:text-cyan-300 ml-1">support@letsfira.com</a>.
                            </p>
                        </section>

                        <div className="pt-8 border-t border-white/10 text-sm text-gray-500">
                            Last updated: February 2026
                        </div>
                    </div>
                </div>
            </main>


        </div>
    );
}
