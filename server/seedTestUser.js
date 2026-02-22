require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Venue = require('./models/Venue');
const Event = require('./models/Event');
const BrandProfile = require('./models/BrandProfile');

const MONGODB_URI = process.env.MONGODB_URI;

// ===================================
// TEST USER CREDENTIALS
// ===================================
// Email: testuser@fira.com
// Password: Test@123
// ===================================

const TEST_USER_EMAIL = 'testuser@fira.com';
const TEST_USER_PASSWORD = 'Test@123';

// Default terms and conditions
const defaultTerms = `1. TICKET POLICY
• All tickets are non-refundable and non-transferable unless otherwise specified.
• Tickets must be presented at the venue entrance (digital or printed).
• Lost or stolen tickets will not be replaced.
• Management reserves the right to refuse entry without refund.

2. AGE RESTRICTIONS
• This event is for attendees 18 years and above unless otherwise specified.
• Valid government-issued photo ID is required for entry.
• Minors must be accompanied by a guardian where permitted.

3. VENUE RULES
• No outside food or beverages are allowed.
• No weapons, illegal substances, or hazardous materials.
• Photography and videography may be restricted in certain areas.
• Attendees must follow all venue staff instructions.

4. SAFETY & LIABILITY
• The organizers are not responsible for personal injury or lost/stolen items.
• By attending, you assume all risks associated with the event.
• Emergency exits must be kept clear at all times.
• In case of emergency, follow staff instructions immediately.

5. CODE OF CONDUCT
• Harassment, discrimination, or inappropriate behavior will result in removal.
• Respect fellow attendees, performers, and staff.
• Smoking is only permitted in designated areas.
• Excessive intoxication may result in removal from the venue.`;

// Test user's venues
const testUserVenues = [
    {
        name: 'Sunset Rooftop Lounge',
        description: 'An exclusive rooftop venue with stunning city views, perfect for intimate gatherings and corporate events. Features a panoramic view of the skyline, premium bar service, and state-of-the-art sound system.',
        images: [
            'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
            'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'
        ],
        capacity: { min: 50, max: 300 },
        pricing: { basePrice: 75000, pricePerHour: 10000, currency: 'INR' },
        amenities: ['Rooftop Bar', 'DJ Setup', 'Premium Sound System', 'LED Screens', 'Valet Parking', 'Private Lounge'],
        rules: ['No smoking indoors', 'Smart casual dress code', 'Management reserves right of admission'],
        location: { type: 'Point', coordinates: [72.8777, 19.0760] },
        address: { street: 'Bandra Kurla Complex', city: 'Mumbai', state: 'Maharashtra', pincode: '400051' },
        status: 'approved'
    },
    {
        name: 'The Grand Convention Hall',
        description: 'A versatile convention center ideal for large-scale events, conferences, and exhibitions. Equipped with modular spaces, cutting-edge AV equipment, and comprehensive event support services.',
        images: [
            'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
            'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800'
        ],
        capacity: { min: 200, max: 2000 },
        pricing: { basePrice: 200000, pricePerHour: 25000, currency: 'INR' },
        amenities: ['Multiple Halls', 'Green Room', 'Catering Kitchen', 'VIP Lounge', '500+ Parking', 'Stage & Truss', 'High-Speed WiFi'],
        rules: ['Prior permission for external catering', 'Security deposit required', 'Decoration guidelines apply'],
        location: { type: 'Point', coordinates: [77.2090, 28.6139] },
        address: { street: 'Pragati Maidan', city: 'New Delhi', state: 'Delhi', pincode: '110001' },
        status: 'approved'
    },
    {
        name: 'Beachside Paradise',
        description: 'A stunning beachfront venue perfect for destination weddings, beach parties, and sunset events. Features direct beach access, bohemian decor, and unforgettable ocean views.',
        images: [
            'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
            'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'
        ],
        capacity: { min: 100, max: 800 },
        pricing: { basePrice: 150000, pricePerHour: 20000, currency: 'INR' },
        amenities: ['Beach Access', 'Pool Area', 'Cabanas', 'Live BBQ Station', 'Bonfire Setup', 'Water Sports', 'Sunset View'],
        rules: ['Beach cleanup mandatory', 'Music curfew at 10 PM', 'No glass bottles on beach'],
        location: { type: 'Point', coordinates: [73.7684, 15.2993] },
        address: { street: 'Calangute Beach Road', city: 'Goa', state: 'Goa', pincode: '403516' },
        status: 'approved'
    },
    {
        name: 'Industrial Warehouse Space',
        description: 'Raw industrial aesthetic perfect for music events, art exhibitions, and experimental shows. High ceilings, exposed brick, and flexible layout for creative event designs.',
        images: [
            'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800'
        ],
        capacity: { min: 150, max: 1000 },
        pricing: { basePrice: 50000, pricePerHour: 8000, currency: 'INR' },
        amenities: ['High Ceilings', 'Loading Dock', 'Power Backup', 'Flexible Space', 'Green Room', 'Basic Sound'],
        rules: ['Fire safety compliance mandatory', 'Structural modifications not allowed'],
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: { street: 'Koramangala Industrial Area', city: 'Bangalore', state: 'Karnataka', pincode: '560034' },
        status: 'approved'
    },
    {
        name: 'Heritage Garden Estate',
        description: 'A picturesque heritage property with sprawling gardens, fountains, and colonial architecture. Perfect for weddings, corporate retreats, and upscale celebrations.',
        images: [
            'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800',
            'https://images.unsplash.com/photo-1496337589254-7e19d01cec44?w=800'
        ],
        capacity: { min: 100, max: 600 },
        pricing: { basePrice: 180000, pricePerHour: 22000, currency: 'INR' },
        amenities: ['Manicured Gardens', 'Vintage Gazebo', 'Fountain', 'Bridal Suite', 'Catering Hall', 'Ample Parking'],
        rules: ['Heritage guidelines apply', 'Fireworks not allowed', 'Event ends by midnight'],
        location: { type: 'Point', coordinates: [73.8567, 18.5204] },
        address: { street: 'Koregaon Park', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
        status: 'approved'
    }
];

// Test user's events
const testUserEvents = [
    {
        name: 'Electro Pulse Festival 2025',
        description: `🎉 THE BIGGEST EDM FESTIVAL OF THE YEAR 🎉

Get ready for an electrifying experience at Electro Pulse Festival 2025! This is not just an event – it's a journey into the heart of electronic dance music.

🎵 LINEUP HIGHLIGHTS:
• International headliners spinning the hottest tracks
• Local underground DJs showcasing emerging talent
• Multiple stages with House, Techno, Trance, and Bass music
• 12 hours of non-stop dancing

🎪 EXPERIENCE:
The venue transforms into a neon wonderland with:
• State-of-the-art Funktion-One sound system
• Laser shows and pyrotechnics
• Immersive art installations
• Premium food and beverage zones
• VIP areas with exclusive amenities

Don't miss the party of the decade!`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800'],
        daysFromNow: 14,
        startTime: '18:00',
        endTime: '06:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 2500,
        maxAttendees: 2000,
        currentAttendees: 1456,
        category: 'festival',
        isFeatured: true,
        venueIndex: 0
    },
    {
        name: 'Corporate Innovation Summit',
        description: `Join industry leaders and innovators at the Corporate Innovation Summit – your gateway to the future of business.

📊 AGENDA:
• Keynote speeches from Fortune 500 executives
• Panel discussions on AI, Web3, and digital transformation
• Startup pitch competition with ₹10 Lakh prize pool
• Networking sessions with 500+ professionals

🎯 WHO SHOULD ATTEND:
CEOs, CTOs, entrepreneurs, investors, and anyone passionate about innovation.

📱 INCLUSIONS:
• Full-day access to all sessions
• Gourmet lunch and refreshments
• Digital certificate of attendance
• Access to recorded sessions`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'],
        daysFromNow: 21,
        startTime: '09:00',
        endTime: '18:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 3500,
        maxAttendees: 500,
        currentAttendees: 312,
        category: 'corporate',
        isFeatured: true,
        venueIndex: 1
    },
    {
        name: 'Sunset Beach Vibes',
        description: `🌅 Experience magic as the sun meets the sea at our legendary beach party!

Sunset Beach Vibes brings you the perfect blend of chill vibes and pumping beats. Watch the golden hour unfold while sipping cocktails with sand between your toes.

🎶 MUSIC:
• Afternoon: Chillout & Deep House
• Evening: Tech House & Melodic Techno
• Night: High-energy Dance Music

🏖️ HIGHLIGHTS:
• Beachfront DJ stages
• Fire dancers and performers
• Fresh seafood BBQ
• Signature cocktails
• Bonfire zone
• Photo opportunities at every corner

Dress code: Beach chic 🌊`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800'],
        daysFromNow: 7,
        startTime: '15:00',
        endTime: '01:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 1800,
        maxAttendees: 600,
        currentAttendees: 423,
        category: 'party',
        isFeatured: true,
        venueIndex: 2
    },
    {
        name: 'Underground Techno Night',
        description: `Enter the depths of electronic music at Underground Techno Night.

This is where raw, industrial beats meet pure energy. Hosted in an authentic warehouse space, expect nothing but unfiltered techno.

🎧 THE SOUND:
Driving basslines, hypnotic rhythms, and mind-bending soundscapes. Our Funktion-One sound system delivers every beat with precision.

⚡ WHAT TO BRING:
• Comfortable shoes
• Ear protection
• Open mind
• Positive energy

This is techno in its purest form. No mainstream gimmicks – just authentic underground vibes.`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800'],
        daysFromNow: 5,
        startTime: '22:00',
        endTime: '06:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 800,
        maxAttendees: 400,
        currentAttendees: 287,
        category: 'party',
        isFeatured: false,
        venueIndex: 3
    },
    {
        name: 'Acoustic Sunset Sessions',
        description: `🎸 An intimate evening of soulful acoustic music as the sun paints the sky golden.

Featured artists include indie-folk singers, classical guitarists, and singer-songwriters performing original compositions and beloved covers.

✨ THE EXPERIENCE:
• Rooftop setting with city views
• Comfortable seating
• Premium cocktails
• Gourmet appetizers
• Meet the artists after performances

Perfect for couples, music lovers, and anyone seeking a peaceful evening escape.`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800'],
        daysFromNow: 3,
        startTime: '17:00',
        endTime: '21:00',
        eventType: 'public',
        ticketType: 'free',
        ticketPrice: 0,
        maxAttendees: 100,
        currentAttendees: 78,
        category: 'concert',
        isFeatured: false,
        venueIndex: 0
    },
    {
        name: 'Grand Wedding Celebration',
        description: `💍 You are cordially invited to celebrate love and new beginnings!

A magical garden wedding featuring:
• Traditional ceremonies amid rose gardens
• Multi-cuisine gourmet dinner
• Live orchestra and dance floor
• Fireworks spectacular

This private event requires an invitation code for entry.`,
        termsAndConditions: `PRIVATE EVENT TERMS:
• Invitation-only event - access code required
• Photography permitted for personal use
• No live social media during ceremony
• Dress code: Semi-formal/Cocktail attire
• Children welcome with supervised play area`,
        images: ['https://images.unsplash.com/photo-1519741497674-611481863552?w=800'],
        daysFromNow: 30,
        startTime: '17:00',
        endTime: '23:00',
        eventType: 'private',
        ticketType: 'free',
        ticketPrice: 0,
        maxAttendees: 400,
        currentAttendees: 0,
        category: 'wedding',
        isFeatured: false,
        venueIndex: 4
    },
    {
        name: 'Jazz & Wine Evening',
        description: `🎷 An elegant evening of smooth jazz and fine wines.

Experience the timeless charm of live jazz performed by acclaimed musicians, paired with carefully curated wines from around the world.

🍷 INCLUSIONS:
• 3 hours of live jazz
• Wine tasting (5 varieties)
• Cheese and charcuterie
• Meet the musicians

Smart casual dress code. Limited seating for an intimate experience.`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800'],
        daysFromNow: 10,
        startTime: '19:00',
        endTime: '22:30',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 2200,
        maxAttendees: 80,
        currentAttendees: 52,
        category: 'concert',
        isFeatured: false,
        venueIndex: 4
    },
    {
        name: 'New Year Eve Extravaganza 2025',
        description: `🎉 RING IN 2025 IN STYLE! 🎉

The most anticipated celebration of the year is here! Join us for an unforgettable New Year's Eve party featuring:

🥂 THE NIGHT:
• Grand champagne reception at 9 PM
• Gourmet 5-course dinner
• International DJ lineup
• Midnight champagne toast
• Fireworks spectacular
• Breakfast at 4 AM

🎁 VIP PACKAGE INCLUDES:
• Private table
• Premium spirits
• Personal host
• Gift hamper

Black tie/formal attire required. This event sells out every year – book now!`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800'],
        daysFromNow: 11,
        startTime: '21:00',
        endTime: '05:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 8000,
        maxAttendees: 1000,
        currentAttendees: 786,
        category: 'party',
        isFeatured: true,
        venueIndex: 1
    }
];

// Test user's brand profile
const testUserBrand = {
    name: 'Pulse Events Co.',
    type: 'organizer',
    bio: 'Premium event organizers specializing in unforgettable experiences. From intimate gatherings to large-scale festivals, we create moments that matter. With 10+ years of expertise and 500+ successful events, we bring your vision to life.',
    coverPhoto: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200',
    profilePhoto: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400',
    location: {
        type: 'Point',
        coordinates: [72.8777, 19.0760]
    },
    address: 'Lower Parel, Mumbai, Maharashtra',
    socialLinks: {
        instagram: 'https://instagram.com/pulseeventsco',
        twitter: 'https://twitter.com/pulseeventsco',
        facebook: 'https://facebook.com/pulseeventsco',
        website: 'https://pulseevents.co'
    },
    stats: {
        followers: 45000,
        events: 8,
        views: 125000
    },
    members: [
        { name: 'Rohan Sharma', role: 'Founder & CEO' },
        { name: 'Priya Mehta', role: 'Creative Director' },
        { name: 'Arjun Kapoor', role: 'Operations Head' },
        { name: 'Sneha Reddy', role: 'Marketing Lead' }
    ]
};

async function seedTestUser() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n🔄 Starting seed process for test user...\n');
        console.log('═'.repeat(50));

        // Delete existing test user data
        const existingUser = await User.findOne({ email: TEST_USER_EMAIL });
        if (existingUser) {
            console.log('🗑️  Cleaning up existing test user data...');
            await Event.deleteMany({ organizer: existingUser._id });
            await Venue.deleteMany({ owner: existingUser._id });
            await BrandProfile.deleteMany({ user: existingUser._id });
            await User.findByIdAndDelete(existingUser._id);
            console.log('   ✓ Existing data cleaned\n');
        }

        // Create test user with hashed password
        console.log('👤 Creating test user...');
        const hashedPassword = await bcrypt.hash(TEST_USER_PASSWORD, 10);
        const testUser = await User.create({
            email: TEST_USER_EMAIL,
            password: hashedPassword,
            name: 'Test User',
            description: 'This is a test account for development and testing purposes.',
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200',
            phone: '+91 9876543210',
            role: 'user',
            isVerified: true,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            verificationBadge: 'organizer',
            socialLinks: {
                instagram: 'https://instagram.com/testuser',
                twitter: 'https://twitter.com/testuser'
            },
            coverPhoto: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200',
            isActive: true
        });
        console.log(`   ✓ User created: ${testUser.email}\n`);

        // Create venues
        console.log('🏢 Creating venues...');
        const createdVenues = [];
        for (const venueData of testUserVenues) {
            const venue = await Venue.create({
                ...venueData,
                owner: testUser._id
            });
            createdVenues.push(venue);
            console.log(`   ✓ ${venue.name}`);
        }
        console.log(`   Total: ${createdVenues.length} venues created\n`);

        // Create events
        console.log('🎉 Creating events...');
        for (const eventData of testUserEvents) {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() + eventData.daysFromNow);
            const [startHour, startMin] = eventData.startTime.split(':').map(Number);
            startDate.setHours(startHour, startMin, 0, 0);

            const endDate = new Date(startDate);
            const [endHour, endMin] = eventData.endTime.split(':').map(Number);
            if (endHour < startHour) {
                endDate.setDate(endDate.getDate() + 1);
            }
            endDate.setHours(endHour, endMin, 0, 0);

            await Event.create({
                organizer: testUser._id,
                venue: createdVenues[eventData.venueIndex]._id,
                name: eventData.name,
                description: eventData.description,
                images: eventData.images,
                startDateTime: startDate,
                endDateTime: endDate,
                eventType: eventData.eventType,
                ticketType: eventData.ticketType,
                ticketPrice: eventData.ticketPrice,
                maxAttendees: eventData.maxAttendees,
                currentAttendees: eventData.currentAttendees,
                category: eventData.category,
                termsAndConditions: eventData.termsAndConditions,
                isFeatured: eventData.isFeatured,
                status: 'upcoming'
            });
            console.log(`   ✓ ${eventData.name}`);
        }
        console.log(`   Total: ${testUserEvents.length} events created\n`);

        // Create brand profile
        console.log('🏷️  Creating brand profile...');
        await BrandProfile.create({
            user: testUser._id,
            ...testUserBrand
        });
        console.log(`   ✓ ${testUserBrand.name}\n`);

        console.log('═'.repeat(50));
        console.log('\n✅ SEED COMPLETED SUCCESSFULLY!\n');
        console.log('═'.repeat(50));
        console.log('📧 TEST USER CREDENTIALS:');
        console.log('═'.repeat(50));
        console.log(`   Email:    ${TEST_USER_EMAIL}`);
        console.log(`   Password: ${TEST_USER_PASSWORD}`);
        console.log('═'.repeat(50));
        console.log('\n📊 SEEDED DATA SUMMARY:');
        console.log('═'.repeat(50));
        console.log(`   • 1 Test User (verified organizer)`);
        console.log(`   • ${createdVenues.length} Venues`);
        console.log(`   • ${testUserEvents.length} Events`);
        console.log(`   • 1 Brand Profile`);
        console.log('═'.repeat(50));
        console.log('\n🚀 You can now login and test the dashboard!\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error seeding test user:', error);
        process.exit(1);
    }
}

seedTestUser();
