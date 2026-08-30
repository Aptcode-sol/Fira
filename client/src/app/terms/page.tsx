'use client';

import LegalShell from '../LegalShell';
import {
    LEGAL_EFFECTIVE_DATE,
    LEGAL_JURISDICTION_CITY,
    LEGAL_SUPPORT_EMAIL,
    LEGAL_VERSION,
    legalFooterNoteClass,
    legalLinkClass,
    legalListClass,
    legalParagraphClass,
    legalSectionHeadingClass,
    legalSubHeadingClass,
    legalTableClass,
    legalTableWrapClass,
    legalTdClass,
    legalThClass,
} from '../legalStyles';

const definitions: [string, string][] = [
    ['Platform', 'The FIRA website (letsfira.com), mobile application, and related services.'],
    ['User', 'Any person using the Platform — an Attendee, Organiser, Host, or Creator.'],
    ['Attendee', 'A person who buys a ticket or attends an Event booked through FIRA.'],
    ['Organiser', 'A person or entity that lists an Event and sells tickets through FIRA.'],
    ['Host', 'A person or entity that lists a Venue for booking through FIRA.'],
    ['Creator', "An artist, DJ, band, comedian, planner, photographer, or similar professional listed on FIRA's Creator Marketplace."],
    ['Ticket', 'A digital QR-coded pass granting entry to an Event.'],
    ['Venue', 'Any physical space listed by a Host for booking.'],
    ['Booking Enquiry', "A message sent from an Organiser to a Creator through FIRA's in-app messaging."],
    ['Platform Fee', 'The service fee FIRA charges on a transaction, disclosed before payment (see Section 8).'],
];

const contactRows: [string, string][] = [
    ['Platform', 'letsfira.com'],
    ['Owned & operated by', 'Sure Phanindra Kumar (Proprietor)'],
    ['Based in', 'Narasaraopet, Andhra Pradesh, India'],
    ['Customer support', LEGAL_SUPPORT_EMAIL],
    ['Grievance / legal', LEGAL_SUPPORT_EMAIL],
];

export default function TermsAndConditions() {
    return (
        <LegalShell
            title="Terms & Conditions"
            meta={[
                `Platform: letsfira.com | Version ${LEGAL_VERSION}`,
                `Effective Date: ${LEGAL_EFFECTIVE_DATE}`,
                `Governed under Indian Law | Jurisdiction: ${LEGAL_JURISDICTION_CITY}, Andhra Pradesh`,
                `Support: ${LEGAL_SUPPORT_EMAIL} | letsfira.com`,
            ]}
        >
            <section>
                <h2 className={legalSectionHeadingClass}>1. Introduction &amp; Acceptance</h2>
                <p className={legalParagraphClass}>
                    Welcome to FIRA (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), an
                    online marketplace operated at letsfira.com and its mobile application, that helps people discover
                    and buy tickets for events, book venues for private and corporate gatherings, and discover creative
                    professionals such as artists, DJs, and event planners.
                </p>
                <p className={legalParagraphClass}>
                    By creating an account, browsing, or transacting on FIRA — whether as an Attendee, Organiser, Host,
                    or Creator — you confirm that you have read, understood, and agree to be legally bound by these
                    Terms and all policies referenced in them. If you do not agree, please discontinue use of the
                    Platform immediately.
                </p>
                <p className={legalParagraphClass}>
                    These Terms form a legally binding agreement under the Indian Contract Act, 1872, and are read
                    together with the Consumer Protection Act, 2019, the Information Technology Act, 2000, the Digital
                    Personal Data Protection Act, 2023, and the rules made under each of these.
                </p>
                <p className={legalParagraphClass}>
                    If you list an Event, the{' '}
                    <a href="/organiser-agreement" className={legalLinkClass}>Organiser Agreement</a>{' '}
                    also applies to you. If you list a Venue, the{' '}
                    <a href="/host-agreement" className={legalLinkClass}>Host Agreement</a>{' '}
                    also applies to you. Both form part of these Terms.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>2. Definitions</h2>
                <div className={legalTableWrapClass}>
                    <table className={legalTableClass}>
                        <thead>
                            <tr>
                                <th scope="col" className={legalThClass}>Term</th>
                                <th scope="col" className={legalThClass}>Meaning</th>
                            </tr>
                        </thead>
                        <tbody>
                            {definitions.map(([term, meaning]) => (
                                <tr key={term}>
                                    <th scope="row" className={`${legalTdClass} font-medium text-white whitespace-nowrap`}>
                                        {term}
                                    </th>
                                    <td className={legalTdClass}>{meaning}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>3. Eligibility &amp; Account Registration</h2>

                <h3 className={legalSubHeadingClass}>3.1 Who can use FIRA</h3>
                <p className={legalParagraphClass}>
                    You must be at least 18 years old and capable of entering into a binding contract under the Indian
                    Contract Act, 1872 to register on FIRA. If an Event permits attendance by a minor, a parent or legal
                    guardian must complete the booking and takes responsibility for that minor&apos;s attendance.
                </p>

                <h3 className={legalSubHeadingClass}>3.2 Account information</h3>
                <ul className={legalListClass}>
                    <li>You must provide accurate, current details — name, mobile number, and email — and keep them updated.</li>
                    <li>You are responsible for keeping your login credentials confidential and for all activity on your account.</li>
                    <li>
                        Report any unauthorised use to{' '}
                        <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`} className={legalLinkClass}>{LEGAL_SUPPORT_EMAIL}</a>{' '}
                        immediately.
                    </li>
                    <li>One person or entity may not hold more than one active account; duplicate accounts may be suspended.</li>
                </ul>

                <h3 className={legalSubHeadingClass}>3.3 Verification for Organisers, Hosts &amp; Creators</h3>
                <p className={legalParagraphClass}>
                    Before a listing goes live or a payout is released, we may ask for a government-issued photo ID, PAN
                    details, bank account information, and, where relevant, proof of ownership or authority over a
                    Venue. This is to keep the Platform trustworthy for everyone using it.
                </p>

                <h3 className={legalSubHeadingClass}>3.4 Suspension &amp; termination</h3>
                <p className={legalParagraphClass}>
                    We may suspend or terminate an account, without prior notice, for false information, fraud, breach
                    of these Terms, or activity that puts other users or the Platform at risk. Payouts due to a
                    terminated account may be held pending review.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>4. The Nature of the Platform</h2>
                <p className={legalParagraphClass}>
                    FIRA is a technology marketplace — it connects people who want to attend or host events with the
                    Organisers, Hosts, and Creators who make those events happen, in the same way a ride-hailing app
                    connects a rider with an independent driver, or a stay-booking platform connects a guest with a
                    property owner it does not itself own.
                </p>
                <p className={legalParagraphClass}>
                    When you buy a ticket, you are entering a contract with the Organiser for that Event. When you book
                    a Venue, you are entering a contract with the Host. When you engage a Creator, the terms of that
                    engagement are agreed directly between you and the Creator. FIRA is not a party to any of these
                    underlying agreements — our role is to provide the discovery, messaging, payment, and ticketing
                    infrastructure that makes the transaction possible.
                </p>
                <p className={legalParagraphClass}>
                    This means the quality, safety, legality, and delivery of an Event, Venue, or Creator&apos;s
                    services are the responsibility of the Organiser, Host, or Creator concerned. Section 12 sets out
                    what this means for FIRA&apos;s liability.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>5. Event Ticketing</h2>

                <h3 className={legalSubHeadingClass}>5.1 Buying a ticket</h3>
                <ul className={legalListClass}>
                    <li>Ticket prices are set by the Organiser and shown inclusive of applicable taxes unless stated otherwise.</li>
                    <li>A convenience fee may be added at checkout and will always be disclosed before payment.</li>
                    <li>A Ticket is confirmed only once payment succeeds; a confirmation with a QR code is sent to your registered email or mobile number.</li>
                </ul>

                <h3 className={legalSubHeadingClass}>5.2 Using a ticket</h3>
                <ul className={legalListClass}>
                    <li>Each Ticket is valid for one entry to the specified Event, date, time, and Venue.</li>
                    <li>Entry may be refused if a Ticket is invalid, duplicated, or tampered with.</li>
                    <li>Lost tickets can only be reissued if the original buyer&apos;s identity is verified.</li>
                    <li>Reselling tickets above face value is not permitted and may result in cancellation without refund.</li>
                    <li>Organisers may set additional entry conditions (age limits, dress code, ID proof); FIRA is not responsible for entry decisions made under an Organiser&apos;s own conditions.</li>
                </ul>

                <h3 className={legalSubHeadingClass}>5.3 Prohibited activity</h3>
                <p className={legalParagraphClass}>
                    Using stolen payment methods, bots or scripts to purchase tickets, reselling above face value,
                    duplicating tickets, or creating fake events to collect payments will result in account suspension
                    and may be reported to the appropriate authorities.
                </p>

                <h3 className={legalSubHeadingClass}>5.4 Organiser responsibilities</h3>
                <p className={legalParagraphClass}>
                    Organisers are responsible for the accuracy of their listing and for obtaining any permissions,
                    licences, or NOCs their Event legally requires — police permission, fire safety clearance, music
                    licensing, and so on. If a headline act is cancelled, the Event is shortened by more than 30%, or
                    the venue changes, Attendees are entitled to a refund under Section 9.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>6. Venue Marketplace</h2>

                <h3 className={legalSubHeadingClass}>6.1 How a booking works</h3>
                <p className={legalParagraphClass}>
                    A Venue booking creates a direct contract between you and the Host; FIRA facilitates the booking as
                    a technology intermediary. You should review photos, amenities, house rules, and the Host&apos;s
                    specific policies before booking — completing payment is a booking request subject to the
                    Host&apos;s confirmation.
                </p>

                <h3 className={legalSubHeadingClass}>6.2 Guest conduct</h3>
                <ul className={legalListClass}>
                    <li>Do not exceed the maximum guest capacity stated in the listing without the Host&apos;s written consent.</li>
                    <li>Follow the Venue&apos;s house rules — noise limits, timings, pet and parking policies.</li>
                    <li>You are responsible for the conduct of any guests you bring.</li>
                </ul>

                <h3 className={legalSubHeadingClass}>6.3 Host responsibilities</h3>
                <p className={legalParagraphClass}>
                    Hosts must be the legal owner of the property, or have authority to list it, and must keep listings,
                    availability, and safety compliance (fire, electrical, structural) accurate and up to date. CCTV in
                    common areas must be disclosed in the listing; surveillance in private areas is not permitted.
                </p>

                <h3 className={legalSubHeadingClass}>6.4 Special requests &amp; communication</h3>
                <p className={legalParagraphClass}>
                    Any special request or custom arrangement for your booking should be raised through FIRA&apos;s
                    in-app messaging with the Host before the booking is confirmed. A verbal or informal commitment made
                    outside this channel — over a call, in person, or on personal contact details — is not binding on
                    FIRA and can&apos;t be relied on later if something is disputed. Keeping it on-platform also means
                    you have a record to point to if you ever need one.
                </p>

                <h3 className={legalSubHeadingClass}>6.5 Legal compliance</h3>
                <p className={legalParagraphClass}>
                    Hosts remain responsible for complying with local law at their property — including police
                    intimation requirements where applicable, fire safety codes, food-service regulations, and noise
                    control rules. Use, possession, or supply of narcotic substances at any Venue booked through FIRA is
                    strictly prohibited and is an offence under the NDPS Act, 1985.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>7. Creator Marketplace</h2>
                <p className={legalParagraphClass}>
                    Any artist, DJ, band, comedian, planner, photographer, or similar professional may create a free
                    profile on FIRA&apos;s Creator Marketplace. Listing a Creator profile is always free, and FIRA does
                    not take a commission on bookings arranged directly between an Organiser and a Creator.
                </p>
                <p className={legalParagraphClass}>
                    Creators may optionally subscribe to a paid visibility feature that surfaces their profile more
                    prominently in search and discovery; current pricing for this is shown within the Creator dashboard
                    and is not fixed in these Terms. Subscribing does not guarantee bookings — unsubscribed Creators can
                    still be discovered and contacted.
                </p>
                <p className={legalParagraphClass}>
                    FIRA provides the messaging channel through which Organisers and Creators discuss availability,
                    pricing, and terms, but is not a party to the agreement they reach, and is not responsible for
                    disputes arising from arrangements made outside FIRA&apos;s own payment flow. Creators and
                    Organisers are encouraged to confirm key terms in writing within FIRA&apos;s messaging system.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>8. Payments</h2>

                <h3 className={legalSubHeadingClass}>8.1 Accepted methods</h3>
                <p className={legalParagraphClass}>
                    Payments on FIRA are processed through RBI-authorised payment gateway partners and may be made via
                    UPI, debit/credit cards, net banking, or other digital wallets shown at checkout. FIRA does not
                    accept cash or cheque, and does not store your card details.
                </p>

                <h3 className={legalSubHeadingClass}>8.2 Platform / service fee</h3>
                <p className={legalParagraphClass}>
                    FIRA charges a service fee on ticket sales and Venue bookings to keep the Platform running. This fee
                    varies by event category, Venue type, and booking value, and is disclosed to Organisers and Hosts
                    before their listing goes live, and reflected in the final price shown to Attendees and Guests at
                    checkout — there are no hidden charges added after you&apos;ve confirmed a booking.
                </p>

                <h3 className={legalSubHeadingClass}>8.3 Payment failure</h3>
                <p className={legalParagraphClass}>
                    If a payment fails, no booking or Ticket is confirmed. If an amount is debited without a
                    confirmation reaching you within 30 minutes, please write to{' '}
                    <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`} className={legalLinkClass}>{LEGAL_SUPPORT_EMAIL}</a> —
                    duplicate charges caused by a technical error are refunded in full within 5–7 business days.
                </p>
            </section>

            {/* id targets: /refund-policy, /community-guidelines and /privacy redirect
                to these three sections (see next.config.ts). scroll-mt clears the
                fixed navbar so the heading is not hidden under it on arrival. */}
            <section id="refunds" className="scroll-mt-28">
                <h2 className={legalSectionHeadingClass}>9. Refund &amp; Cancellation Policy</h2>

                <h3 className={legalSubHeadingClass}>9.1 Event tickets</h3>
                <ul className={legalListClass}>
                    <li>Refund rules for a Ticket are set by the Event&apos;s Organiser and shown on the event page before you buy — please check this before purchasing.</li>
                    <li>If FIRA or the Organiser cancels an Event, Attendees receive a full refund of the ticket price.</li>
                    <li>There is generally no refund for a no-show or a change of mind, unless the Organiser&apos;s own policy states otherwise.</li>
                    <li>Convenience fees and payment processing charges are non-refundable in all cases.</li>
                </ul>

                <h3 className={legalSubHeadingClass}>9.2 Venue bookings</h3>
                <p className={legalParagraphClass}>Payment schedule:</p>
                <ul className={legalListClass}>
                    <li>10% of the total booking value is due at the time of booking, to hold your date.</li>
                    <li>
                        If your event is more than 7 days away at the time of booking, the remaining 90% is due by 7 days
                        before the event. If it isn&apos;t paid by then, the booking is automatically cancelled and the
                        10% advance is forfeited — this is a missed payment deadline, not a cancellation, and the refund
                        tiers below do not apply to it.
                    </li>
                    <li>If your event is less than 7 days away at the time of booking, the full amount is due upfront at booking.</li>
                </ul>
                <p className={legalParagraphClass}>
                    Cancellation refunds: if you cancel a confirmed booking, your refund is calculated as a percentage
                    of the total booking value — not of how much you&apos;ve paid so far — based on how close to the
                    event the cancellation is made:
                </p>
                <ul className={legalListClass}>
                    <li>48 hours or more before the event: full refund.</li>
                    <li>Between 24 and 48 hours before the event: 50% refund of the total booking value.</li>
                    <li>Less than 24 hours before the event: no refund.</li>
                </ul>
                <p className={legalParagraphClass}>
                    Refunds are capped at whatever you&apos;ve actually paid — you&apos;ll never be asked to pay more
                    than you already have. All eligible refunds are verified against the booking and processed within
                    5–7 business days of approval, credited back to the original payment method.
                </p>

                <h3 className={legalSubHeadingClass}>9.3 Requesting a refund</h3>
                <p className={legalParagraphClass}>
                    Go to Dashboard &gt; My Tickets or My Bookings, select the item, and use the Cancel &amp; Refund
                    option where available. For anything that option doesn&apos;t cover, write to{' '}
                    <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`} className={legalLinkClass}>{LEGAL_SUPPORT_EMAIL}</a>.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>10. User Content &amp; Intellectual Property</h2>
                <p className={legalParagraphClass}>
                    Everything on the Platform — its design, software, branding, and text we&apos;ve written — belongs
                    to FIRA or its licensors, and may not be copied or reused without permission.
                </p>
                <p className={legalParagraphClass}>
                    When you post content on FIRA — event descriptions, photos, a Creator portfolio, reviews — you keep
                    ownership of it, but you give FIRA a non-exclusive, royalty-free licence to display, reproduce, and
                    promote it on the Platform and its marketing channels, for as long as your listing remains active.
                    You confirm that the content is your own, or that you have the right to use it, and that it
                    doesn&apos;t infringe anyone else&apos;s rights.
                </p>
            </section>

            <section id="conduct" className="scroll-mt-28">
                <h2 className={legalSectionHeadingClass}>11. Prohibited Conduct</h2>
                <p className={legalParagraphClass}>
                    The following will result in account suspension, and may be reported to the relevant authorities:
                </p>
                <ul className={legalListClass}>
                    <li>Providing false or fraudulent information in a listing, account, or transaction.</li>
                    <li>Payment fraud, chargeback abuse, or attempts to circumvent FIRA&apos;s payment system to transact off-platform with intent to avoid fees.</li>
                    <li>Hacking, scraping, or attempting to disrupt the Platform.</li>
                    <li>Fake reviews or ratings.</li>
                    <li>Any conduct that incites violence, harassment, or public disorder.</li>
                </ul>
                <p className={legalParagraphClass}>
                    Respectful communication, harassment, and safety at events are treated as part of this section —
                    conduct that makes another user unsafe on or off the Platform is a breach of these Terms.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>12. Disclaimers &amp; Limitation of Liability</h2>
                <p className={legalParagraphClass}>
                    The Platform is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; As explained in
                    Section 4, FIRA does not organise Events, does not own or manage Venues, and is not the employer of
                    any Organiser, Host, or Creator — our role is limited to operating the marketplace that connects
                    users to one another.
                </p>
                <p className={legalParagraphClass}>
                    Accordingly, FIRA is not liable for the conduct, safety standards, cancellations, or performance of
                    any Organiser, Host, or Creator, or for the accuracy of the information they list — the same way a
                    marketplace that connects riders with independent drivers is not the driver, and a platform that
                    connects guests with independently-owned stays is not the property owner. Where something goes wrong
                    with an Event, Venue, or Creator engagement itself, the responsibility sits with the Organiser,
                    Host, or Creator you transacted with, and FIRA will assist in good faith with mediation as set out
                    in Section 15.
                </p>
                <p className={legalParagraphClass}>
                    To the extent permitted under Indian law, FIRA&apos;s total liability to any user for a claim
                    relating to these Terms is limited to the amount paid by or to that user through FIRA in the three
                    months before the claim, and excludes indirect or consequential loss. Nothing here limits liability
                    that cannot be excluded by law, including for fraud or for death or personal injury caused by
                    FIRA&apos;s own negligence.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>13. Indemnification</h2>
                <p className={legalParagraphClass}>
                    You agree to indemnify and hold FIRA and its team harmless against claims, losses, or costs
                    (including reasonable legal fees) arising from your breach of these Terms, your failure to obtain a
                    permission or licence your Event or listing required, or any misrepresentation in your listing.
                </p>
            </section>

            <section id="data-protection" className="scroll-mt-28">
                <h2 className={legalSectionHeadingClass}>14. Data Protection &amp; Privacy</h2>
                <p className={legalParagraphClass}>
                    We collect the personal data needed to run the Platform — your name, mobile number, email, and
                    transaction history — and use it to create your account, confirm bookings and tickets, process
                    payments and refunds, provide support, and meet our legal obligations.
                </p>
                <p className={legalParagraphClass}>
                    You have the rights given to you by the Digital Personal Data Protection Act, 2023 — including the
                    right to access, correct, or request erasure of your data, and to withdraw consent at any time by
                    writing to{' '}
                    <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`} className={legalLinkClass}>{LEGAL_SUPPORT_EMAIL}</a>.
                </p>
                <p className={legalParagraphClass}>
                    We do not sell your personal data. It is shared only where needed to fulfil a booking (with the
                    relevant Organiser or Host), with our payment gateway partner to process a transaction, or where
                    required by law.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>15. Dispute Resolution &amp; Grievance Redressal</h2>
                <p className={legalParagraphClass}>
                    If something goes wrong, write to{' '}
                    <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`} className={legalLinkClass}>{LEGAL_SUPPORT_EMAIL}</a>{' '}
                    first — we aim to acknowledge every complaint within 24 hours and resolve it within 30 days. Where a
                    dispute involves funds held by FIRA (a payout or a security deposit), FIRA&apos;s decision on how
                    those funds are released is final.
                </p>
                <p className={legalParagraphClass}>
                    If a dispute cannot be resolved this way, it will be referred to arbitration under the Arbitration
                    and Conciliation Act, 1996, with a sole arbitrator, seated in {LEGAL_JURISDICTION_CITY}, and
                    conducted in English. This does not take away your right, as a consumer, to approach the
                    appropriate Consumer Disputes Redressal Commission under the Consumer Protection Act, 2019.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>16. Governing Law &amp; Jurisdiction</h2>
                <p className={legalParagraphClass}>
                    These Terms are governed by the laws of India. Subject to the arbitration clause above, the courts
                    of {LEGAL_JURISDICTION_CITY}, Andhra Pradesh shall have exclusive jurisdiction over any dispute
                    arising from these Terms.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>17. Amendments, Termination &amp; Miscellaneous</h2>

                <h3 className={legalSubHeadingClass}>17.1 Changes to these Terms</h3>
                <p className={legalParagraphClass}>
                    We may update these Terms from time to time. Material changes will be notified by email or in-app
                    notice at least 7 days before they take effect; continuing to use FIRA after that means you accept
                    the updated Terms.
                </p>

                <h3 className={legalSubHeadingClass}>17.2 Ending your account</h3>
                <p className={legalParagraphClass}>
                    You may close your account at any time through your settings, subject to completing any pending
                    bookings or payments. FIRA may suspend or end an account for the reasons set out in Section 3.4.
                </p>

                <h3 className={legalSubHeadingClass}>17.3 Severability &amp; entire agreement</h3>
                <p className={legalParagraphClass}>
                    If a court finds any part of these Terms unenforceable, the rest continues to apply. These Terms,
                    together with the{' '}
                    <a href="/organiser-agreement" className={legalLinkClass}>Organiser Agreement</a> and the{' '}
                    <a href="/host-agreement" className={legalLinkClass}>Host Agreement</a>, form the entire agreement
                    between you and FIRA.
                </p>

                <h3 className={legalSubHeadingClass}>17.4 Force Majeure</h3>
                <p className={legalParagraphClass}>
                    FIRA is not responsible for delays or failures caused by events beyond its reasonable control —
                    natural disasters, government orders, or internet or banking outages, among others.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>18. Contact Information</h2>
                <div className={legalTableWrapClass}>
                    <table className={legalTableClass}>
                        <caption className="sr-only">FIRA contact and ownership details</caption>
                        <tbody>
                            {contactRows.map(([label, value]) => (
                                <tr key={label}>
                                    <th scope="row" className={`${legalTdClass} font-medium text-white whitespace-nowrap`}>
                                        {label}
                                    </th>
                                    <td className={legalTdClass}>
                                        {value === LEGAL_SUPPORT_EMAIL ? (
                                            <a href={`mailto:${value}`} className={legalLinkClass}>{value}</a>
                                        ) : (
                                            value
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className={legalFooterNoteClass}>
                Version {LEGAL_VERSION} · Effective {LEGAL_EFFECTIVE_DATE}
            </div>
        </LegalShell>
    );
}
