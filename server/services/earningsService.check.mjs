// ponytail check for earningsService.computePayeeGross (design Property 13/14,
// Requirement 8). No framework, no fixtures — run with:
//   node server/services/earningsService.check.mjs
// The formal fast-check property tests are separate tasks (1.4, 1.5); this is
// the single runnable check that fails if the attribution logic breaks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const earningsService = require('./earningsService.js');
const { computePayeeGross } = earningsService;

// Shared constants exist and match the recorded status vocabulary.
assert.equal(earningsService.PAID, 'success');
assert.equal(earningsService.REFUNDED, 'refunded');
assert.deepEqual(earningsService.PENDING_PAYOUT, ['pending', 'processing']);
assert.equal(earningsService.COMPLETED_PAYOUT, 'completed');

// platform bearer → full listed price (platform absorbs the discount)
assert.deepEqual(computePayeeGross({ listedPrice: 1000, discountAmount: 200, discountBearer: 'platform' }), { gross: 1000 });
// owner bearer → listedPrice − discountAmount
assert.deepEqual(computePayeeGross({ listedPrice: 1000, discountAmount: 200, discountBearer: 'owner' }), { gross: 800 });
// null bearer → full listed price
assert.deepEqual(computePayeeGross({ listedPrice: 1000, discountAmount: 0, discountBearer: null }), { gross: 1000 });
// absent bearer (undefined) treated as no discount
assert.deepEqual(computePayeeGross({ listedPrice: 1000 }), { gross: 1000 });
// full discount by owner → exactly zero, never negative
assert.deepEqual(computePayeeGross({ listedPrice: 500, discountAmount: 500, discountBearer: 'owner' }), { gross: 0 });
// Math.round semantics mirror calculateBilling/processPayout (halves up)
assert.deepEqual(computePayeeGross({ listedPrice: 100.5, discountAmount: 0, discountBearer: 'platform' }), { gross: 101 });

// --- invalid inputs are excluded with an error indication, never negative ---
// owner discount greater than listedPrice
assert.deepEqual(computePayeeGross({ listedPrice: 100, discountAmount: 250, discountBearer: 'owner' }), { error: 'discountAmount is missing, negative, or exceeds listedPrice', field: 'discountAmount' });
// owner negative discount
assert.equal(computePayeeGross({ listedPrice: 100, discountAmount: -5, discountBearer: 'owner' }).field, 'discountAmount');
// owner missing discount
assert.equal(computePayeeGross({ listedPrice: 100, discountBearer: 'owner' }).field, 'discountAmount');
// unknown bearer
assert.equal(computePayeeGross({ listedPrice: 100, discountAmount: 0, discountBearer: 'buyer' }).field, 'discountBearer');
// non-numeric listedPrice fails closed rather than producing NaN
assert.equal(computePayeeGross({ discountBearer: 'platform' }).field, 'listedPrice');

// no valid result is ever negative
for (const p of [
    { listedPrice: 500, discountAmount: 500, discountBearer: 'owner' },
    { listedPrice: 0, discountBearer: null },
    { listedPrice: 1000, discountAmount: 0, discountBearer: 'platform' },
]) {
    const r = computePayeeGross(p);
    assert.ok('gross' in r && r.gross >= 0, `gross must be non-negative for ${JSON.stringify(p)}`);
}

console.log('earningsService.computePayeeGross check: all assertions passed');

// --- maskAccountNumber (design Property 6, Requirement 2.5 / 11.5) ---
const { maskAccountNumber } = earningsService;

// last four preserved, preceding digits masked, length preserved
assert.equal(maskAccountNumber('123456789012'), '********9012');
assert.equal(maskAccountNumber('123456789012').length, '123456789012'.length);
// exactly five characters: only the first is masked
assert.equal(maskAccountNumber('12345'), '*2345');
// non-digit separators preceding the tail are preserved, digits masked
assert.equal(maskAccountNumber('12-34-5678'), '**-**-5678');
// strings of length <= 4 have nothing to mask
assert.equal(maskAccountNumber('1234'), '1234');
assert.equal(maskAccountNumber('12'), '12');
assert.equal(maskAccountNumber(''), '');
// defensive: non-string / absent input yields '' rather than throwing
assert.equal(maskAccountNumber(null), '');
assert.equal(maskAccountNumber(undefined), '');
assert.equal(maskAccountNumber(123456789012), '');

console.log('earningsService.maskAccountNumber check: all assertions passed');

// --- buildOverview: reconciliation identity + fail-closed (task 2.1) ---
// design Property 9 / Requirements 1.7, 4.3, 4.4, 4.5, 10.4, 10.5. Pure assembly
// of already-aggregated sums, exercised here without a DB.
const { buildOverview } = earningsService;

// netPayable identity and reconciliation block from a representative scope.
{
    const dto = buildOverview({
        grossCollected: 1000,
        gstCollected: 90,
        platformCommissionEarned: 50,
        refundedTotal: 0,
        paidOut: 0,
        pendingPayout: 860,
    });
    // netPayable = gross − commission − gst
    assert.equal(dto.netPayable, 1000 - 50 - 90);
    // platformRetained = commission + gst
    assert.equal(dto.reconciliation.platformRetained, 140);
    // payeeAttributed = netPayable + paidOut
    assert.equal(dto.reconciliation.payeeAttributed, 860 + 0);
    // residual = gross − (platformRetained + payeeAttributed + refundedTotal)
    assert.equal(dto.reconciliation.residual, 1000 - (140 + 860 + 0));
    assert.equal(dto.reconciliation.discrepancy, false);
    // headline figures are carried through verbatim
    assert.equal(dto.grossCollected, 1000);
    assert.equal(dto.paidOut, 0);
    assert.equal(dto.pendingPayout, 860);
    assert.equal(dto.refundedTotal, 0);
}

// discrepancy flips true once |residual| exceeds 0.01, and category totals are
// retained unchanged alongside the flag (Requirement 4.5).
{
    const dto = buildOverview({
        grossCollected: 1000,
        gstCollected: 90,
        platformCommissionEarned: 50,
        refundedTotal: 25,
        paidOut: 0,
        pendingPayout: 860,
    });
    assert.equal(dto.reconciliation.residual, 1000 - (140 + 860 + 25)); // -25
    assert.equal(dto.reconciliation.discrepancy, true);
    assert.equal(dto.reconciliation.platformRetained, 140); // unchanged
    assert.equal(dto.reconciliation.payeeAttributed, 860);  // unchanged
}

// empty scope → all zeros, no discrepancy
{
    const dto = buildOverview({
        grossCollected: 0, gstCollected: 0, platformCommissionEarned: 0,
        refundedTotal: 0, paidOut: 0, pendingPayout: 0,
    });
    assert.equal(dto.netPayable, 0);
    assert.equal(dto.reconciliation.residual, 0);
    assert.equal(dto.reconciliation.discrepancy, false);
}

// fail closed: a non-finite aggregate throws rather than returning a partial DTO
for (const bad of [NaN, undefined, null, 'x', Infinity]) {
    assert.throws(() => buildOverview({
        grossCollected: bad, gstCollected: 0, platformCommissionEarned: 0,
        refundedTotal: 0, paidOut: 0, pendingPayout: 0,
    }), /finite/);
}

console.log('earningsService.buildOverview check: all assertions passed');

// --- buildRecipientBreakdown: partition, netPayable identity, masking,
// readyToPayTotal, fail-closed (task 3.1) ---
// design Property 5 / Requirements 2.1, 2.2, 2.3, 2.4, 2.6. Pure assembly of
// already-grouped, recipient-joined sums, exercised here without a DB.
const { buildRecipientBreakdown, hasBankDetails } = earningsService;

// hasBankDetails: complete record only (all four non-empty)
assert.equal(hasBankDetails({ accountName: 'A', accountNumber: '123456789', ifscCode: 'IFSC0001', bankName: 'B' }), true);
assert.equal(hasBankDetails({ accountName: 'A', accountNumber: '123456789', ifscCode: '', bankName: 'B' }), false);
assert.equal(hasBankDetails({ accountName: null, accountNumber: null, ifscCode: null, bankName: null }), false);
assert.equal(hasBankDetails(null), false);
assert.equal(hasBankDetails(undefined), false);

{
    const complete = { accountName: 'Asha', accountNumber: '123456789012', ifscCode: 'HDFC0001', bankName: 'HDFC' };
    const out = buildRecipientBreakdown([
        // event organizer with complete bank details and money owed now
        { type: 'event_tickets', recipientId: 'r1', name: 'Org One', bankDetails: complete, grossEarnings: 1000, commissionDeducted: 50, owedNow: 950 },
        // venue owner, no bank details → excluded from readyToPayTotal
        { type: 'venue_booking', recipientId: 'r2', name: 'Venue Two', bankDetails: null, grossEarnings: 400, commissionDeducted: 20, owedNow: 380 },
        // venue owner, complete details but nothing pending → owedNow 0
        { type: 'venue_booking', recipientId: 'r3', name: 'Venue Three', bankDetails: complete, grossEarnings: 200, commissionDeducted: 10, owedNow: 0 },
    ]);

    // partitioned into exactly the section named by Payout.type
    assert.equal(out.event_tickets.length, 1);
    assert.equal(out.venue_booking.length, 2);
    assert.equal(out.event_tickets[0].recipientId, 'r1');

    // netPayable = grossEarnings − commissionDeducted (Requirement 2.1)
    assert.equal(out.event_tickets[0].netPayable, 950);
    assert.equal(out.venue_booking[0].netPayable, 380);

    // account number masked; only last four visible
    assert.equal(out.event_tickets[0].bankDetails.accountNumberMasked, '********9012');
    assert.equal(out.event_tickets[0].bankDetails.ifscCode, 'HDFC0001');

    // missing bank details → flag set, bankDetails null, excluded from ready total
    assert.equal(out.venue_booking[0].bankDetailsMissing, true);
    assert.equal(out.venue_booking[0].bankDetails, null);

    // readyToPayTotal sums owedNow over ONLY recipients with complete bank
    // details: r1 (950) + r3 (0); r2 excluded despite owing 380 (Requirement 2.6)
    assert.equal(out.readyToPayTotal, 950);

    // all monetary values non-negative
    for (const row of [...out.event_tickets, ...out.venue_booking]) {
        for (const f of ['grossEarnings', 'commissionDeducted', 'netPayable', 'owedNow']) {
            assert.ok(row[f] >= 0, `${f} must be non-negative`);
        }
    }
}

// empty input → empty sections, zero ready total
{
    const out = buildRecipientBreakdown([]);
    assert.deepEqual(out.event_tickets, []);
    assert.deepEqual(out.venue_booking, []);
    assert.equal(out.readyToPayTotal, 0);
}

// fail closed: a non-finite grouped sum throws rather than returning a partial breakdown
for (const bad of [NaN, undefined, null, 'x', Infinity]) {
    assert.throws(() => buildRecipientBreakdown([
        { type: 'event_tickets', recipientId: 'r1', bankDetails: null, grossEarnings: bad, commissionDeducted: 0, owedNow: 0 },
    ]), /finite/);
}

// fail closed: an unknown Payout type is corrupt data, not a silent drop
assert.throws(() => buildRecipientBreakdown([
    { type: 'mystery', recipientId: 'r1', bankDetails: null, grossEarnings: 0, commissionDeducted: 0, owedNow: 0 },
]), /unknown Payout type/);

console.log('earningsService.buildRecipientBreakdown check: all assertions passed');

// --- buildPayoutRow: status→field rules + refund flag (task 4.1) ---
// design Property 7/17 / Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 7.5. Pure
// projection of a recorded Payout, exercised here without a DB.
const { buildPayoutRow } = earningsService;

const baseAmounts = { grossAmount: 1000, platformCommission: 50, platformCommissionPercentage: 5, netAmount: 950 };

// completed → status verbatim, processedAt exposed, no failureReason
{
    const at = new Date('2024-01-02T03:04:05.000Z');
    const row = buildPayoutRow({ _id: 'p1', status: 'completed', processedAt: at, failureReason: null, ...baseAmounts });
    assert.equal(row.status, 'completed');
    assert.equal(row.processedAt, at);
    assert.ok(!('failureReason' in row));
    assert.ok(!('refundAfterCompleted' in row)); // absent when no refund
    // amounts carried through verbatim
    assert.equal(row.grossAmount, 1000);
    assert.equal(row.platformCommission, 50);
    assert.equal(row.platformCommissionPercentage, 5);
    assert.equal(row.netAmount, 950);
}

// completed + refund → refundAfterCompleted true, row otherwise unchanged
{
    const row = buildPayoutRow({ _id: 'p1', status: 'completed', processedAt: new Date(), ...baseAmounts }, true);
    assert.equal(row.refundAfterCompleted, true);
    assert.equal(row.netAmount, 950); // unchanged
}

// failed → failureReason exposed, processedAt omitted (Requirement 3.4)
{
    const row = buildPayoutRow({ _id: 'p2', status: 'failed', processedAt: new Date(), failureReason: 'bank rejected', ...baseAmounts });
    assert.equal(row.status, 'failed');
    assert.equal(row.failureReason, 'bank rejected');
    assert.ok(!('processedAt' in row));
    assert.ok(!('refundAfterCompleted' in row)); // never set on non-completed
}

// pending / processing → no processedAt, no failureReason, amounts present
for (const s of ['pending', 'processing']) {
    const row = buildPayoutRow({ _id: 'p3', status: s, ...baseAmounts });
    assert.equal(row.status, s);
    assert.ok(!('processedAt' in row));
    assert.ok(!('failureReason' in row));
    assert.equal(row.netAmount, 950);
}

// absent / invalid status → 'unknown', remaining fields still exposed (Req 3.5)
for (const bad of [undefined, null, '', 'settled', 'COMPLETED']) {
    const row = buildPayoutRow({ _id: 'p4', status: bad, ...baseAmounts });
    assert.equal(row.status, 'unknown');
    assert.equal(row.grossAmount, 1000);
    assert.equal(row.platformCommission, 50);
    assert.equal(row.platformCommissionPercentage, 5);
    assert.equal(row.netAmount, 950);
    // refund flag never set for a non-completed (here unknown) status
    assert.ok(!('refundAfterCompleted' in row));
}

// refund flag is ignored for a non-completed status even if passed true
{
    const row = buildPayoutRow({ _id: 'p5', status: 'pending', ...baseAmounts }, true);
    assert.ok(!('refundAfterCompleted' in row));
}

console.log('earningsService.buildPayoutRow check: all assertions passed');

// --- buildEventEarnings: netEarnings identity + payout-status fallback (task 5.1) ---
// design Property 10/11 / Requirements 5.2, 5.3, 5.4, 5.6, 10.4. Pure assembly of
// already-aggregated sums, exercised here without a DB.
const { buildEventEarnings } = earningsService;

// representative scope: net = gross − commission − gst; payout status passthrough
{
    const dto = buildEventEarnings(
        { grossTicketSales: 1000, platformCommissionDeducted: 50, gst: 9 },
        'processing',
    );
    assert.equal(dto.netEarnings, 1000 - 50 - 9);
    assert.equal(dto.grossTicketSales, 1000);        // verbatim
    assert.equal(dto.platformCommissionDeducted, 50); // verbatim
    assert.equal(dto.gst, 9);                          // verbatim
    assert.equal(dto.payoutStatus, 'processing');      // referencing Payout's status
}

// each valid payout status passes through unchanged (Requirement 5.3)
for (const s of ['pending', 'processing', 'completed', 'failed']) {
    const dto = buildEventEarnings({ grossTicketSales: 100, platformCommissionDeducted: 5, gst: 1 }, s);
    assert.equal(dto.payoutStatus, s);
}

// no referencing payout (null/undefined) → 'not yet initiated' (Requirement 5.4)
for (const none of [null, undefined]) {
    const dto = buildEventEarnings({ grossTicketSales: 0, platformCommissionDeducted: 0, gst: 0 }, none);
    assert.equal(dto.payoutStatus, 'not yet initiated');
}

// empty event (no paid payments) → all-zero figures, not-yet-initiated (Req 5.2)
{
    const dto = buildEventEarnings({ grossTicketSales: 0, platformCommissionDeducted: 0, gst: 0 }, null);
    assert.equal(dto.grossTicketSales, 0);
    assert.equal(dto.netEarnings, 0);
    assert.equal(dto.payoutStatus, 'not yet initiated');
}

// fail closed: a non-finite aggregate throws rather than returning a partial DTO
for (const bad of [NaN, undefined, null, 'x', Infinity]) {
    assert.throws(() => buildEventEarnings(
        { grossTicketSales: bad, platformCommissionDeducted: 0, gst: 0 }, null,
    ), /finite/);
}

console.log('earningsService.buildEventEarnings check: all assertions passed');

// --- buildVenueBookingRow / buildVenueEarnings: netPayable identity,
//     outstanding-balance detection, payout fallback, DTO shape (task 5.4) ---
// design Property 10/11/12 / Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 10.4. Pure
// assembly of already-aggregated sums, exercised here without a DB.
const { buildVenueBookingRow, buildVenueEarnings } = earningsService;

// representative booking: net = advancePaid − commission; partial advance is
// outstanding (0 < advancePaid < grossBookingAmount); payout status passthrough
{
    const row = buildVenueBookingRow(
        { bookingId: 'b1', grossBookingAmount: 1000, advancePaid: 100, commissionDeducted: 5 },
        'processing',
    );
    assert.equal(row.bookingId, 'b1');
    assert.equal(row.grossBookingAmount, 1000);
    assert.equal(row.advancePaid, 100);
    assert.equal(row.commissionDeducted, 5);
    assert.equal(row.netPayable, 95);
    assert.equal(row.balanceOutstanding, true);
    assert.equal(row.payoutStatus, 'processing');
}

// fully paid (advancePaid === grossBookingAmount) → not outstanding (Property 12)
{
    const row = buildVenueBookingRow(
        { bookingId: 'b2', grossBookingAmount: 1000, advancePaid: 1000, commissionDeducted: 50 },
        'completed',
    );
    assert.equal(row.balanceOutstanding, false);
    assert.equal(row.netPayable, 950);
}

// no paid Payment → all-zero figures, not outstanding, 'not yet initiated' (Req 6.6)
for (const none of [null, undefined]) {
    const row = buildVenueBookingRow(
        { bookingId: 'b3', grossBookingAmount: 1000, advancePaid: 0, commissionDeducted: 0 },
        none,
    );
    assert.equal(row.advancePaid, 0);
    assert.equal(row.commissionDeducted, 0);
    assert.equal(row.netPayable, 0);
    assert.equal(row.balanceOutstanding, false); // 0 is not > 0
    assert.equal(row.payoutStatus, 'not yet initiated');
}

// each valid payout status passes through unchanged (Requirement 6.5)
for (const s of ['pending', 'processing', 'completed', 'failed']) {
    const row = buildVenueBookingRow({ bookingId: 'b4', grossBookingAmount: 100, advancePaid: 10, commissionDeducted: 1 }, s);
    assert.equal(row.payoutStatus, s);
}

// fail closed: a non-finite aggregate throws rather than returning a partial row
for (const bad of [NaN, undefined, null, 'x', Infinity]) {
    assert.throws(() => buildVenueBookingRow(
        { bookingId: 'b5', grossBookingAmount: bad, advancePaid: 0, commissionDeducted: 0 }, null,
    ), /finite/);
}

// buildVenueEarnings assembles the { venueId, bookings } DTO verbatim
{
    const rows = [buildVenueBookingRow({ bookingId: 'b1', grossBookingAmount: 100, advancePaid: 10, commissionDeducted: 1 }, null)];
    const dto = buildVenueEarnings('v1', rows);
    assert.equal(dto.venueId, 'v1');
    assert.equal(dto.bookings.length, 1);
    assert.equal(dto.bookings[0].bookingId, 'b1');
    // empty venue → empty bookings array
    assert.deepEqual(buildVenueEarnings('v2', []), { venueId: 'v2', bookings: [] });
}

console.log('earningsService.buildVenueEarnings check: all assertions passed');
