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

export default function HostAgreement() {
    return (
        <LegalShell
            title="Host Agreement"
            meta={[
                'Terms for Venue Owners listing a space on letsfira.com',
                `Effective Date: ${LEGAL_EFFECTIVE_DATE} | Version ${LEGAL_VERSION}`,
            ]}
            note="This Agreement is supplementary to, and forms part of, FIRA's main Terms & Conditions. In case of conflict, this Agreement governs for the matters it specifically covers."
        >
            <section>
                <h2 className={legalSectionHeadingClass}>1. Who This Agreement Is For</h2>
                <p className={legalParagraphClass}>
                    This Agreement applies to you if you list a Venue — a property, hall, rooftop, farmhouse, or similar
                    space — for booking on FIRA. It sits alongside FIRA&apos;s main{' '}
                    <a href="/terms" className={legalLinkClass}>Terms &amp; Conditions</a>, and covers the specifics of
                    listing, payouts, and cancellations as a Host.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>2. Listing Your Venue</h2>
                <ul className={legalListClass}>
                    <li>Your listing (photos, amenities, house rules, capacity, pricing) must be accurate and kept up to date.</li>
                    <li>You confirm you are the legal owner of the property, or have valid authority to list and rent it out.</li>
                    <li>The property must be safe, clean, and compliant with applicable fire, electrical, and structural safety standards, and any local requirements such as police intimation or noise-control rules that apply to your property.</li>
                    <li>Any CCTV in common areas must be disclosed in your listing; surveillance in private areas is not permitted.</li>
                </ul>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>3. How a Booking Works</h2>
                <p className={legalParagraphClass}>
                    When a Guest books your Venue, they pay 10% of the booking value upfront to confirm the date, with
                    the balance due on the schedule set out in FIRA&apos;s{' '}
                    <a href="/terms" className={legalLinkClass}>Terms &amp; Conditions</a> (Section 9.2). You do not need
                    to do anything to collect this — FIRA handles payment collection on your behalf.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>4. Payout Policy</h2>

                <h3 className={legalSubHeadingClass}>4.1 When you get paid</h3>
                <p className={legalParagraphClass}>
                    Your payout for a booking is released only once both of the following are true:
                </p>
                <ul className={legalListClass}>
                    <li>The booked date has passed — i.e., the event or check-in period is complete; and</li>
                    <li>There is no unresolved issue on the booking — no open damage claim, guest complaint, or dispute under review.</li>
                </ul>
                <p className={legalParagraphClass}>
                    Once both conditions are met, your payout is processed within 3–4 business days of the booked date.
                </p>

                <h3 className={legalSubHeadingClass}>4.2 What you receive</h3>
                <p className={legalParagraphClass}>
                    Your payout is the amount collected from the Guest, less FIRA&apos;s platform fee (see Section 6) and
                    any tax deducted at source or other statutory deduction required by law. A payout summary is
                    available in your Host dashboard for every booking.
                </p>

                <h3 className={legalSubHeadingClass}>4.3 If a claim is raised</h3>
                <p className={legalParagraphClass}>
                    If a damage claim or complaint is raised against a booking, your payout for that booking is held
                    until the matter is resolved through FIRA&apos;s grievance process. FIRA&apos;s decision on the
                    release of held funds is final, as set out in the main Terms &amp; Conditions.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>5. Guest Cancellations</h2>
                <p className={legalParagraphClass}>
                    Guests may cancel under the refund policy in FIRA&apos;s{' '}
                    <a href="/terms" className={legalLinkClass}>Terms &amp; Conditions</a> (Section 9.2) — a full refund
                    48+ hours before the booking, 50% refund 24–48 hours before, and no refund inside 24 hours. Where a
                    cancellation results in an amount not being refunded to the Guest, that amount goes to you as
                    compensation for holding your date, less FIRA&apos;s platform fee, on the same payout schedule as a
                    completed booking.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>6. Fees</h2>
                <p className={legalParagraphClass}>
                    FIRA charges a platform fee on each booking, deducted before payout. The applicable rate is shown in
                    your Host dashboard before you publish a listing, and does not change after a booking is confirmed.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>7. Ending Your Listing</h2>
                <p className={legalParagraphClass}>
                    You may unpublish or remove your Venue at any time for future dates; existing confirmed bookings must
                    still be honoured. FIRA may remove a listing or suspend a Host account for inaccurate listings,
                    repeated guest complaints, safety violations, or breach of this Agreement or FIRA&apos;s Terms &amp;
                    Conditions.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>8. Liability &amp; Governing Terms</h2>
                <p className={legalParagraphClass}>
                    As set out in FIRA&apos;s{' '}
                    <a href="/terms" className={legalLinkClass}>Terms &amp; Conditions</a>, a booking creates a direct
                    contract between you and the Guest; FIRA&apos;s role is limited to operating the marketplace,
                    collecting payment, and processing payout on your behalf. Liability, dispute resolution, and
                    governing law follow the corresponding sections of FIRA&apos;s main Terms &amp; Conditions, which
                    this Agreement does not repeat.
                </p>
            </section>

            <section>
                <h2 className={legalSectionHeadingClass}>9. Acceptance</h2>
                <p className={legalParagraphClass}>
                    By publishing a Venue listing on FIRA, you confirm that you have read and agree to this Host
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
