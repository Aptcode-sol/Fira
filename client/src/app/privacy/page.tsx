'use client';

import Navbar from '@/components/Navbar';

import PartyBackground from '@/components/PartyBackground';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-violet-500/30">
            <PartyBackground />
            <Navbar />

            <main className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8 md:p-12">
                    <h1 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                        Privacy Policy
                    </h1>

                    <div className="space-y-8 text-gray-300 leading-relaxed">
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">1. Introduction</h2>
                            <p>
                                Welcome to FIRA. We respect your privacy and are committed to protecting your personal data.
                                This privacy policy will inform you as to how we look after your personal data when you visit our
                                website and tell you about your privacy rights and how the law protects you.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">2. Data We Collect</h2>
                            <p className="mb-4">
                                We may collect, use, store and transfer different kinds of personal data about you which we have grouped together follows:
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Identity Data:</strong> includes first name, last name, username or similar identifier.</li>
                                <li><strong>Contact Data:</strong> includes billing address, delivery address, email address and telephone numbers.</li>
                                <li><strong>Financial Data:</strong> includes bank account and payment card details.</li>
                                <li><strong>Transaction Data:</strong> includes details about payments to and from you and other details of products and services you have purchased from us.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">3. How We Use Your Data</h2>
                            <p>
                                We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mt-4">
                                <li>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
                                <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
                                <li>Where we need to comply with a legal or regulatory obligation.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">4. Data Security</h2>
                            <p>
                                We have put in place appropriate security measures to prevent your personal data from being accidentally lost,
                                used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal
                                data to those employees, agents, contractors and other third parties who have a business need to know.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">5. Contact Us</h2>
                            <p>
                                If you have any questions about this privacy policy or our privacy practices, please contact us at:
                                <a href="mailto:support@letsfira.com" className="text-violet-400 hover:text-violet-300 ml-1">support@letsfira.com</a>
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
