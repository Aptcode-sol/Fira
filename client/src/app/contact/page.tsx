import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { SUPPORT_EMAIL } from '@/lib/siteConfig';

export const metadata: Metadata = {
    title: 'Contact Us - FIRA',
    description: 'Get in touch with the FIRA team via email.',
    alternates: { canonical: '/contact' },
};

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-violet-500/30">
            <PartyBackground />
            <Navbar />

            <main className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8 md:p-12">
                    <h1 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        Contact Us
                    </h1>

                    <p className="text-gray-300 leading-relaxed mb-6">
                        Have a question or need help? Reach out to us via email and we'll get back to you as soon as possible.
                    </p>

                    <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                        <p className="text-sm text-gray-400 mb-2">Email</p>
                        <a
                            href={`mailto:${SUPPORT_EMAIL}`}
                            className="text-cyan-400 hover:text-cyan-300 text-lg font-medium transition-colors"
                        >
                            {SUPPORT_EMAIL}
                        </a>
                    </div>
                </div>
            </main>
        </div>
    );
}
