'use client';

import Navbar from '@/components/Navbar';

import PartyBackground from '@/components/PartyBackground';

export default function RefundPolicy() {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-violet-500/30">
            <PartyBackground />
            <Navbar />

            <main className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8 md:p-12">
                    <h1 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                        Refund & Cancellation Policy
                    </h1>

                    <div className="space-y-8 text-gray-300 leading-relaxed">
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">1. Overview</h2>
                            <p>
                                At FIRA, we strive to ensure a fair and transparent experience for both organizers and attendees.
                                This policy outlines the terms for refunds and cancellations of event tickets and venue bookings.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">2. Event Ticket Refunds</h2>
                            <p className="mb-4">
                                Refund policies for event tickets are set by the individual Event Organizers. Please check the specific
                                event page for determining the refund policy before purchasing a ticket. Generally:
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Full Refund:</strong> If an event is cancelled by the organizer or FIRA.</li>
                                <li><strong>No Refund:</strong> For "No Show" or if you simply change your mind, unless stated otherwise by the organizer.</li>
                                <li><strong>Processing Fees:</strong> Platform fees and payment processing fees are generally non-refundable.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">3. Venue Booking Cancellations</h2>
                            <p className="mb-4">
                                A 10% non-refundable advance payment is required to secure any venue booking through FIRA. For the remaining balance, the cancellation policy is determined by the Venue Owner. Common policies include:
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Flexible:</strong> Full refund of balance 24 hours prior to booking.</li>
                                <li><strong>Moderate:</strong> Full refund of balance 5 days prior to booking.</li>
                                <li><strong>Strict:</strong> 50% refund of balance up until 1 week prior to booking.</li>
                            </ul>
                            <p className="mt-4">
                                The specific policy applicable to your booking will be displayed during the checkout process. Please note that the initial 10% advance payment processed via Razorpay is strictly non-refundable in the event of a cancellation by the user.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">4. How to Request a Refund</h2>
                            <p>
                                To request a refund, please go to your Dashboard &gt; My Tickets (or My Bookings) and select the specific
                                item. If a refund is applicable, you will see a "Cancel & Refund" button. For disputes, please contact
                                our support team.
                            </p>
                            <p className="mt-4">
                                <strong>Refund Processing Time:</strong> Once a refund is approved by the Event Organizer or Venue Owner, FIRA will initiate the refund via our payment gateway partner, Razorpay. The refunded amount will be credited back to your original method of payment within 5-7 business days, depending on your bank's processing timelines.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">5. Contact Us</h2>
                            <p className="mb-2">
                                If you have issues with a refund or believe a charge was made in error, please contact us at:
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Email:</strong> <a href="mailto:support@letsfira.com" className="text-green-400 hover:text-green-300">support@letsfira.com</a></li>
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
