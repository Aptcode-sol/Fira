'use client';

import Navbar from '@/components/Navbar';

import PartyBackground from '@/components/PartyBackground';

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-violet-500/30">
            <PartyBackground />
            <Navbar />

            <main className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8 md:p-12">
                    <h1 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        Terms of Service
                    </h1>

                    <div className="space-y-8 text-gray-300 leading-relaxed">
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">1. Agreement to Terms</h2>
                            <p>
                                By accessing or using our website, you agree to be bound by these Terms of Service. If you disagree
                                with any part of the terms, then you may not access the Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">2. Use License</h2>
                            <p className="mb-4">
                                Permission is granted to temporarily download one copy of the materials (information or software) on
                                FIRA's website for personal, non-commercial transitory viewing only. This is the grant of a license,
                                not a transfer of title, and under this license you may not:
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Modify or copy the materials;</li>
                                <li>Use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
                                <li>Attempt to decompile or reverse engineer any software contained on FIRA's website;</li>
                                <li>Remove any copyright or other proprietary notations from the materials; or</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">3. User Accounts</h2>
                            <p>
                                When you create an account with us, you must provide us information that is accurate, complete, and
                                current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate
                                termination of your account on our Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">4. Intellectual Property</h2>
                            <p>
                                The Service and its original content, features and functionality are and will remain the exclusive
                                property of FIRA and its licensors. The Service is protected by copyright, trademark, and other
                                laws of both the India and foreign countries.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">5. Termination</h2>
                            <p>
                                We may terminate or suspend your account immediately, without prior notice or liability, for any
                                reason whatsoever, including without limitation if you breach the Terms. Upon termination, your
                                right to use the Service will immediately cease.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">6. Contact Us</h2>
                            <p>
                                If you have any questions about these Terms, please create a support ticket or contact us at:
                                <a href="mailto:support@letsfira.com" className="text-blue-400 hover:text-blue-300 ml-1">support@letsfira.com</a>
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
