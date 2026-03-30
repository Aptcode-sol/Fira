const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../models/User');
const BrandProfile = require('../models/BrandProfile');
const Venue = require('../models/Venue');
const Event = require('../models/Event');

async function seed() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        // 1. CLEAR EXISTING TEST DATA (Optional, but helps resetting)
        // We'll just delete specific emails to avoid dup errors
        await Event.deleteMany({ name: { $in: ['Test Today Event', 'Test Weekend Event', 'Test Following Event'] } });
        await Venue.deleteMany({ name: 'Test Featured Venue' });
        await BrandProfile.deleteMany({ name: 'Test Brand Creator' });
        await User.deleteMany({ email: { $in: ['testuser@firaa.com', 'testcreator@firaa.com'] } });
        console.log('Cleared previous seed data.');

        // 2. CREATE TEST USERS
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        const testUser = await User.create({
            name: 'Test Setup User',
            email: 'testuser@firaa.com',
            password: hashedPassword,
            role: 'user',
            isVerified: true,
            emailVerified: true,
        });

        const testCreatorUser = await User.create({
            name: 'Test Creator',
            email: 'testcreator@firaa.com',
            password: hashedPassword,
            role: 'user',
            isVerified: true,
            emailVerified: true,
            verificationBadge: 'brand'
        });
        console.log('Created test users.');

        // 3. CREATE BRAND PROFILE
        const testBrand = await BrandProfile.create({
            user: testCreatorUser._id,
            name: 'Test Brand Creator',
            type: 'brand',
            bio: 'This is a test brand for following feed.',
        });
        console.log('Created test brand.');

        // Make Test User follow Test Brand (used for Following Feed, if backend supports it later)
        testUser.followingBrands.push(testBrand._id);
        await testUser.save();

        // 4. CREATE FEATURED VENUE
        const testVenue = await Venue.create({
            name: 'Test Featured Venue',
            owner: testUser._id, // Assign to whoever
            description: 'A fantastic test venue.',
            address: {
                street: '123 Main St',
                city: 'Test City',
                state: 'Test State',
                pincode: '123456',
                country: 'India'
            },
            location: {
                type: 'Point',
                coordinates: [77.5946, 12.9716] // Longitude, Latitude
            },
            status: 'approved',
            capacity: {
                max: 500
            },
            pricing: {
                basePrice: 50000
            },
            venueType: 'club',
            images: ['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800']
        });
        console.log('Created test venue.');

        // 5. HELPER DATE FUNCTIONS
        const now = new Date();
        
        // Today (in the future)
        const todayStart = new Date(now);
        todayStart.setHours(todayStart.getHours() + 1); // 1 hour from now
        const todayEnd = new Date(todayStart);
        todayEnd.setHours(todayStart.getHours() + 3);

        // This Weekend (Friday 6 PM or Saturday depending on current day)
        const thisWeekendStart = new Date(now);
        const dayOfWeek = now.getDay();
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
        // If it's already weekend, just push it to Saturday noon to guarantee its "weekend"
        if (daysUntilFriday === 0 && now.getHours() >= 18) {
            thisWeekendStart.setDate(thisWeekendStart.getDate() + 1); // Sat
            thisWeekendStart.setHours(12, 0, 0, 0);
        } else if (daysUntilFriday === 0) {
            thisWeekendStart.setHours(18, 0, 0, 0); // Fri 6 PM
        } else {
            thisWeekendStart.setDate(thisWeekendStart.getDate() + daysUntilFriday);
            thisWeekendStart.setHours(18, 0, 0, 0);
        }
        const thisWeekendEnd = new Date(thisWeekendStart);
        thisWeekendEnd.setHours(thisWeekendStart.getHours() + 4);

        // General Future Date
        const futureStart = new Date(now);
        futureStart.setDate(futureStart.getDate() + 14);
        const futureEnd = new Date(futureStart);
        futureEnd.setHours(futureStart.getHours() + 2);

        // 6. CREATE EVENTS
        const baseEventData = {
            organizer: testCreatorUser._id,
            venue: testVenue._id,
            category: 'music',
            ticketType: 'paid',
            status: 'approved', // Critical for visibility
            isActive: true, // Critical for visibility
            eventType: 'public',
            maxAttendees: 100,
            images: ['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800']
        };

        // Ready-to-go Event (Today)
        await Event.create({
            ...baseEventData,
            name: 'Test Today Event',
            description: 'This is a test event for today.',
            startDateTime: todayStart,
            endDateTime: todayEnd,
            customVenue: { isCustom: false },
            adminApproval: { status: 'approved' },
            venueApproval: { status: 'approved' }
        });

        // Weekend Event (This Weekend)
        await Event.create({
            ...baseEventData,
            name: 'Test Weekend Event',
            description: 'This is a test event for the upcoming weekend.',
            startDateTime: thisWeekendStart,
            endDateTime: thisWeekendEnd,
            customVenue: { isCustom: false },
            adminApproval: { status: 'approved' },
            venueApproval: { status: 'approved' }
        });

        // Following Feed Event (General Future Event by Creator)
        await Event.create({
            ...baseEventData,
            name: 'Test Following Event',
            description: 'This is a test event by a followed brand.',
            startDateTime: futureStart,
            endDateTime: futureEnd,
            customVenue: { isCustom: false },
            adminApproval: { status: 'approved' },
            venueApproval: { status: 'approved' }
        });
        
        console.log('Created test events successfully.');
        console.log('\n--- SEED COMPLETE ---');
        console.log('Login Email:', 'testuser@firaa.com');
        console.log('Login Password:', 'password123');

        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();
