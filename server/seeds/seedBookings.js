require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/Userr');
const Venue = require('../models/Venuee');
const Booking = require('../models/Bookingg');

const MONGODB_URI = process.env.MONGODB_URI;

// Test user email - this is the user you login with
const TEST_USER_EMAIL = 'testuser@fira.com';

// Venue owner emails (from seedVenues.js)
const VENUE_OWNER_EMAILS = [
    'rajesh.sharma@venues.com',
    'priya.patel@venues.com',
    'vikram.singh@venues.com',
    'ananya.gupta@venues.com'
];

async function seedBookings() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get test user
        const testUser = await User.findOne({ email: TEST_USER_EMAIL });
        if (!testUser) {
            console.error('❌ Test user not found! Run seedTestUser.js first.');
            process.exit(1);
        }
        console.log(`✅ Found test user: ${testUser.name} (${testUser.email})\n`);

        // Get venue owners
        const venueOwners = await User.find({ email: { $in: VENUE_OWNER_EMAILS } });
        if (venueOwners.length === 0) {
            console.error('❌ Venue owners not found! Run seedVenues.js first.');
            process.exit(1);
        }
        console.log(`✅ Found ${venueOwners.length} venue owners\n`);

        // Get venues owned by test user (for incoming requests)
        const testUserVenues = await Venue.find({ owner: testUser._id });
        console.log(`✅ Test user owns ${testUserVenues.length} venues\n`);

        // Get venues owned by other venue owners (for outgoing requests)
        const otherVenues = await Venue.find({ owner: { $in: venueOwners.map(o => o._id) } });
        console.log(`✅ Found ${otherVenues.length} venues from other owners\n`);

        // Clear existing bookings
        await Booking.deleteMany({});
        console.log('🗑️  Cleared existing bookings\n');

        const bookings = [];

        // ==========================================
        // 1. BOOKINGS TO TEST USER'S VENUES (Incoming)
        //    - These appear in your "Requests" tab
        //    - You can accept/reject these
        // ==========================================
        console.log('📥 Creating incoming booking requests to your venues...');
        
        if (testUserVenues.length > 0) {
            for (let i = 0; i < Math.min(venueOwners.length, 4); i++) {
                const venue = testUserVenues[i % testUserVenues.length];
                const requester = venueOwners[i];
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 10 + i * 3);

                const booking = await Booking.create({
                    user: requester._id,
                    venue: venue._id,
                    bookingDate: futureDate,
                    startTime: '10:00',
                    endTime: '18:00',
                    purpose: ['Corporate Event', 'Birthday Party', 'Product Launch', 'Wedding Reception'][i],
                    expectedGuests: 50 + (i * 30),
                    totalAmount: venue.pricing.basePrice + (8 * (venue.pricing.pricePerHour || 0)),
                    platformFee: Math.round((venue.pricing.basePrice) * 0.05),
                    status: 'pending', // Awaiting your approval
                    paymentStatus: 'pending'
                });
                bookings.push(booking);
                console.log(`   ✓ ${requester.name} → ${venue.name} (pending)`);
            }
        }

        // ==========================================
        // 2. BOOKINGS BY TEST USER - PENDING
        //    - Your requests waiting for approval
        // ==========================================
        console.log('\n📤 Creating your outgoing booking requests (pending)...');
        
        if (otherVenues.length > 0) {
            for (let i = 0; i < Math.min(2, otherVenues.length); i++) {
                const venue = otherVenues[i];
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 15 + i * 5);

                const booking = await Booking.create({
                    user: testUser._id,
                    venue: venue._id,
                    bookingDate: futureDate,
                    startTime: '14:00',
                    endTime: '22:00',
                    purpose: ['Music Event', 'Art Exhibition'][i],
                    expectedGuests: 100 + (i * 50),
                    totalAmount: venue.pricing.basePrice + (8 * (venue.pricing.pricePerHour || 0)),
                    platformFee: Math.round((venue.pricing.basePrice) * 0.05),
                    status: 'pending',
                    paymentStatus: 'pending'
                });
                bookings.push(booking);
                console.log(`   ✓ You → ${venue.name} (pending)`);
            }
        }

        // ==========================================
        // 3. BOOKINGS BY TEST USER - ACCEPTED (Pay Now!)
        //    - These have "Pay Now" button
        // ==========================================
        console.log('\n💳 Creating accepted bookings (ready for payment)...');
        
        if (otherVenues.length > 2) {
            for (let i = 2; i < Math.min(5, otherVenues.length); i++) {
                const venue = otherVenues[i];
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 20 + i * 3);

                const booking = await Booking.create({
                    user: testUser._id,
                    venue: venue._id,
                    bookingDate: futureDate,
                    startTime: '18:00',
                    endTime: '23:00',
                    purpose: ['Anniversary Party', 'Corporate Retreat', 'Charity Gala'][i - 2] || 'Private Event',
                    expectedGuests: 80 + (i * 20),
                    totalAmount: venue.pricing.basePrice + (5 * (venue.pricing.pricePerHour || 0)),
                    platformFee: Math.round((venue.pricing.basePrice) * 0.05),
                    status: 'accepted', // APPROVED - shows "Pay Now"
                    paymentStatus: 'pending',
                    ownerResponse: {
                        respondedAt: new Date()
                    }
                });
                bookings.push(booking);
                console.log(`   ✓ You → ${venue.name} (ACCEPTED - Pay Now!)`);
            }
        }

        // ==========================================
        // 4. BOOKINGS BY TEST USER - PAID (Completed)
        //    - These show as paid/confirmed
        // ==========================================
        console.log('\n✅ Creating paid/confirmed bookings...');
        
        if (otherVenues.length > 5) {
            const venue = otherVenues[5];
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 45);

            const booking = await Booking.create({
                user: testUser._id,
                venue: venue._id,
                bookingDate: futureDate,
                startTime: '17:00',
                endTime: '22:00',
                purpose: 'Engagement Party',
                expectedGuests: 150,
                totalAmount: venue.pricing.basePrice + (5 * (venue.pricing.pricePerHour || 0)),
                platformFee: Math.round((venue.pricing.basePrice) * 0.05),
                status: 'accepted',
                paymentStatus: 'paid', // Already paid
                ownerResponse: {
                    respondedAt: new Date(Date.now() - 86400000) // 1 day ago
                }
            });
            bookings.push(booking);
            console.log(`   ✓ You → ${venue.name} (PAID ✓)`);
        }

        console.log('\n' + '═'.repeat(50));
        console.log('✅ BOOKING SEED COMPLETED!');
        console.log('═'.repeat(50));
        console.log(`\n📊 CREATED ${bookings.length} TOTAL BOOKINGS:\n`);
        console.log('   YOUR BOOKINGS (My Bookings page):');
        console.log('   • Pending: 2 (waiting for venue owner approval)');
        console.log('   • Accepted: 3 (shows "💳 Pay Now" button!)');
        console.log('   • Paid: 1 (confirmed booking)');
        console.log('\n   INCOMING REQUESTS (Requests tab):');
        console.log('   • 4 requests from others to your venues');
        console.log('   • You can Accept/Reject these');
        console.log('═'.repeat(50));
        console.log('\n🚀 Login as testuser@fira.com / Test@123 to see bookings!\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding bookings:', error);
        process.exit(1);
    }
}

seedBookings();
