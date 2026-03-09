'use client';

import Navbar from '@/components/Navbar';

import PartyBackground from '@/components/PartyBackground';

export default function CommunityGuidelines() {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-violet-500/30">
            <PartyBackground />
            <Navbar />

            <main className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8 md:p-12">
                    <h1 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
                        Community Guidelines
                    </h1>

                    <div className="space-y-8 text-gray-300 leading-relaxed">
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">1. Our Values</h2>
                            <p>
                                FIRA is built on the values of inclusivity, respect, and safety. We are committed to creating a
                                platform where everyone feels welcome and can connect with others through events and experiences.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">2. Respectful Communication</h2>
                            <p className="mb-4">
                                We encourage open and respectful communication between users, organizers, and venue owners.
                                Harassment, hate speech, bullying, or abusive language will not be tolerated.
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Be kind:</strong> Treat others with respect and kindness.</li>
                                <li><strong>No hate speech:</strong> We have zero tolerance for hate speech or discrimination.</li>
                                <li><strong>Keep it clean:</strong> Avoid using sexually explicit or violent language.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">3. Prohibited Content</h2>
                            <p>
                                You may not post or share content that is illegal, harmful, threatening, abusive, harassing,
                                defamatory, vulgar, obscene, libelous, invasive of another's privacy, hateful, or racially,
                                ethnically or otherwise objectionable.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">4. Safety First</h2>
                            <p>
                                Your safety is our top priority. If you encounter any behavior that makes you feel unsafe or
                                uncomfortable, please report it to us immediately. This includes offline behavior at events
                                organized through FIRA.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">5. Reporting Violations</h2>
                            <p>
                                If you see something that violates these guidelines, please report it. We take all reports seriously
                                and will take appropriate action, which may include warning the user, removing content, or banning
                                the user from our platform.
                            </p>
                            <p className="mt-4">
                                Contact us at:
                                <a href="mailto:support@letsfira.com" className="text-pink-400 hover:text-pink-300 ml-1">support@letsfira.com</a>
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
