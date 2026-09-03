/**
 * One-shot: wipe all dummy money records so every revenue figure reads 0.
 *
 * Deletes Payment, Payout, and Settlement. The dashboard's totalRevenue also
 * sums Ticket.price and Booking.totalAmount, so those are zeroed too - otherwise
 * "Platform Revenue" would still show the seeded ticket/booking totals even with
 * no Payment records. Run once: `node scripts/wipePaymentData.js`.
 *
 * Safe to re-run (deleteMany on an empty collection is a no-op). Intended for
 * clearing seed/test data before going live, never as a routine operation.
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not set');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected.');

    const Payment = require('../models/Payment');
    const Payout = require('../models/Payout');
    const Settlement = require('../models/Settlement');
    const Ticket = require('../models/Ticket');
    const Booking = require('../models/Booking');

    const [pay, pout, settle] = await Promise.all([
        Payment.deleteMany({}),
        Payout.deleteMany({}),
        Settlement.deleteMany({}),
    ]);

    // Zero the revenue the dashboard derives from tickets/bookings, without
    // deleting the tickets/bookings themselves (those are attendance records).
    const [tix, bk] = await Promise.all([
        Ticket.updateMany({}, { $set: { price: 0 } }),
        Booking.updateMany({}, { $set: { totalAmount: 0 } }),
    ]);

    console.log(`Deleted: ${pay.deletedCount} payments, ${pout.deletedCount} payouts, ${settle.deletedCount} settlements.`);
    console.log(`Zeroed: ${tix.modifiedCount} ticket prices, ${bk.modifiedCount} booking amounts.`);
    console.log('Platform revenue is now 0.');

    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
