'use client';

import LegalShell from '../LegalShell';
import {
    LEGAL_EFFECTIVE_DATE,
    LEGAL_SUPPORT_EMAIL,
    LEGAL_VERSION,
    legalFooterNoteClass,
    legalLinkClass,
    legalListClass,
    legalParagraphClass,
    legalSectionHeadingClass,
    legalSubHeadingClass,
} from '../legalStyles';

export default function OrganiserAgreement() {
    return (
        <LegalShell
            title="Organiser Agreement"
            meta={[
                'Terms for Organisers hosting a ticketed event on letsfira.com',
                `Effective Date: ${LEGAL_EFFECTIVE_DATE} | Version ${LEGAL_VERSION}`,
            ]}
            note="This Agreement is supplementary to, and forms part of, FIRA's main Terms & Conditions. In case of conflict, this Agreement governs for the matters it specifically covers."
        >
            <section>
                <h2 className={legalSectionHeadingClass}>1. Who This Agreement Is For</h2>
                <p className={legalParagraphClass}>
                    This Agreement applies to you if you list a ticketed Event on FIRA. It sits alongside FIRA&apos;s
                    main{' '}
                    <a href="/terms" className={legalLinkClass}>Terms &amp; Conditions</a>, and covers the specifics of
                    ticket revenue, payout, and cancellation as an Organiser.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>2. Listing Your Event</h2>
                <ul className={legalListClass}>
                    <li>Your event listing — performer/artist details, venue, date, time, ticket tiers, and any age or entry restrictions — must be accurate and complete.</li>
                    <li>You are solely responsible for obtaining any permissions, licences, or NOCs your event legally requires — police permission, fire safety clearance, music licensing, and so on.</li>
                    <li>You must notify FIRA immediately of any change to your event, and notify Attendees at least 24 hours in advance wherever possible.</li>
                </ul>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>3. Ticket Revenue &amp; Escrow</h2>
                <p className={legalParagraphClass}>
                    All amounts collected from ticket sales are held by FIRA and are not released to you while the event
                    is still upcoming. You have no claim over these funds until the event has taken place and been
                    verified as completed. This protects Attendees in case an event doesn&apos;t go ahead as planned, and
                    is standard practice on ticketing platforms generally.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>4. Payout Policy</h2>

                <h3 className={legalSubHeadingClass}>4.1 When you get paid</h3>
                <p className={legalParagraphClass}>
                    Once your event is complete, FIRA verifies attendance and checks for any unresolved Attendee
                    complaints. Provided there are none outstanding, your payout is processed within 3–5 business days
                    after the event&apos;s completion.
                </p>

                <h3 className={legalSubHeadingClass}>4.2 What you receive</h3>
                <p className={legalParagraphClass}>
                    Your payout is your gross ticket sales, less FIRA&apos;s platform fee (see Section 6), less any tax
                    deducted at source or other statutory deduction required by law, and less any refunds already issued
                    to Attendees on your event. A full breakdown is available in your Organiser dashboard.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>5. If You Cancel Your Event</h2>

                <h3 className={legalSubHeadingClass}>5.1 Attendee refunds</h3>
                <p className={legalParagraphClass}>
                    If you cancel your event, every Attendee who purchased a ticket is refunded the full ticket price
                    automatically. The convenience/platform fee charged at checkout is not refunded to the Attendee, in
                    line with FIRA&apos;s Terms &amp; Conditions.
                </p>

                <h3 className={legalSubHeadingClass}>5.2 Cancellation fine</h3>
                <p className={legalParagraphClass}>
                    In addition to Attendee refunds, you are liable to pay FIRA a flat cancellation fine of ₹50,000,
                    regardless of the size of the event or the number of tickets sold. This may be deducted from any
                    pending payout or invoiced to you separately if no payout is due.
                </p>

                <h3 className={legalSubHeadingClass}>5.3 Repeated cancellations</h3>
                <p className={legalParagraphClass}>
                    Repeated cancellations may result in suspension of your account and restriction from listing future
                    events on FIRA.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>6. Fees</h2>
                <p className={legalParagraphClass}>
                    FIRA charges a platform fee on ticket sales, deducted before payout. The applicable rate is shown in
                    your Organiser dashboard before your event goes live, and is reflected in the final price shown to
                    Attendees at checkout.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>7. Ending Your Listing</h2>
                <p className={legalParagraphClass}>
                    FIRA may remove an event listing at its discretion if it is unsuitable, unsafe, or in breach of this
                    Agreement or FIRA&apos;s Terms &amp; Conditions.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>8. Liability &amp; Governing Terms</h2>
                <p className={legalParagraphClass}>
                    As set out in FIRA&apos;s{' '}
                    <a href="/terms" className={legalLinkClass}>Terms &amp; Conditions</a>, a ticket purchase creates a
                    direct contract between you and the Attendee; FIRA&apos;s role is limited to operating the
                    marketplace, collecting payment, and processing payout on your behalf. Liability, dispute
                    resolution, and governing law follow the corresponding sections of FIRA&apos;s main Terms &amp;
                    Conditions, which this Agreement does not repeat.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>9. Acceptance</h2>
                <p className={legalParagraphClass}>
                    By publishing an Event listing on FIRA, you confirm that you have read and agree to this Organiser
                    Agreement and to FIRA&apos;s main{' '}
                    <a href="/terms" className={legalLinkClass}>Terms &amp; Conditions</a>. Questions about this
                    Agreement can go to{' '}
                    <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`} className={legalLinkClass}>{LEGAL_SUPPORT_EMAIL}</a>.
                </p>
            </section>

            <div className={legalFooterNoteClass}>
                Version {LEGAL_VERSION} · Effective {LEGAL_EFFECTIVE_DATE}
            </div>
        </LegalShell>
    );
}
