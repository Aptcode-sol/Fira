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
                            <h2 className="text-xl font-semibold text-white mb-4">4. Payments and Bookings</h2>
                            <p>
                                All payments for event tickets and venue bookings on FIRA are processed securely through our third-party payment gateway, Razorpay. By making a transaction, you agree to Razorpay's terms of service.
                            </p>
                            <p className="mt-4">
                                <strong>Venue Bookings:</strong> To secure a venue booking, a 10% non-refundable advance payment is required at the time of booking. The remaining balance must be settled with the venue owner as per their specific terms.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">5. Intellectual Property</h2>
                            <p>
                                The Service and its original content, features and functionality are and will remain the exclusive
                                property of FIRA and its licensors. The Service is protected by copyright, trademark, and other
                                laws of both the India and foreign countries.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">6. Termination</h2>
                            <p>
                                We may terminate or suspend your account immediately, without prior notice or liability, for any
                                reason whatsoever, including without limitation if you breach the Terms. Upon termination, your
                                right to use the Service will immediately cease.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">7. Shipping and Delivery Policy</h2>
                            <p>
                                FIRA provides digital services (event tickets and venue booking confirmations). Upon successful payment processing through Razorpay, your digital ticket or booking confirmation will be delivered immediately to your registered email address and will be instantly accessible on our platform via your Dashboard. No physical goods are shipped or delivered.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">8. Contact Us</h2>
                            <p className="mb-2">
                                For any questions, grievances, or support requests regarding these Terms, please contact us at:
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Email:</strong> <a href="mailto:support@letsfira.com" className="text-blue-400 hover:text-blue-300">support@letsfira.com</a></li>
                                <li><strong>Phone:</strong> +91 93468 63962</li>
                                <li><strong>Registered Address:</strong> Vellore Institute of Technology (VIT) AP University, Amaravati - 522237, Andhra Pradesh, India</li>
                            </ul>
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
