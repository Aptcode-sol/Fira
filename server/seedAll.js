require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Venue = require('./models/Venue');
const Event = require('./models/Event');
const BrandProfile = require('./models/BrandProfile');
const Ticket = require('./models/Ticket');
const Booking = require('./models/Booking');
const Post = require('./models/Post');
const Notification = require('./models/Notification');
const VerificationRequest = require('./models/VerificationRequest');

const MONGODB_URI = process.env.MONGODB_URI;

// ===========================================
// IMAGE COLLECTIONS (Free Unsplash Images)
// ===========================================

const avatarImages = [
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200'
];

const venueImages = [
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
    'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
    'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
    'https://images.unsplash.com/photo-1496337589254-7e19d01cec44?w=800',
    'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800',
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800'
];

const eventImages = [
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800',
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
    'https://images.unsplash.com/photo-1459749411177-05be25405904?w=800',
    'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800',
    'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800',
    'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800'
];

const brandCoverImages = [
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200',
    'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=1200',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200',
    'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=1200',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200'
];

// ===========================================
// USER SEED DATA
// ===========================================

const regularUsers = [
    { name: 'Rahul Sharma', email: 'rahul.sharma@fira.test', phone: '+91 9876543210', city: 'Mumbai' },
    { name: 'Priya Patel', email: 'priya.patel@fira.test', phone: '+91 9876543211', city: 'Delhi' },
    { name: 'Arjun Reddy', email: 'arjun.reddy@fira.test', phone: '+91 9876543212', city: 'Bangalore' },
    { name: 'Sneha Gupta', email: 'sneha.gupta@fira.test', phone: '+91 9876543213', city: 'Pune' },
    { name: 'Vikram Singh', email: 'vikram.singh@fira.test', phone: '+91 9876543214', city: 'Chennai' },
    { name: 'Ananya Iyer', email: 'ananya.iyer@fira.test', phone: '+91 9876543215', city: 'Hyderabad' },
    { name: 'Rohan Kumar', email: 'rohan.kumar@fira.test', phone: '+91 9876543216', city: 'Kolkata' },
    { name: 'Kavya Nair', email: 'kavya.nair@fira.test', phone: '+91 9876543217', city: 'Kochi' },
    { name: 'Aditya Joshi', email: 'aditya.joshi@fira.test', phone: '+91 9876543218', city: 'Goa' },
    { name: 'Meera Menon', email: 'meera.menon@fira.test', phone: '+91 9876543219', city: 'Ahmedabad' }
];

const venueOwners = [
    { name: 'Rajesh Sharma', email: 'rajesh.venues@fira.test', businessName: 'Premium Events Pvt Ltd' },
    { name: 'Sunita Patel', email: 'sunita.venues@fira.test', businessName: 'Royal Venues' },
    { name: 'Mahesh Agarwal', email: 'mahesh.venues@fira.test', businessName: 'EventSpace Solutions' },
    { name: 'Lakshmi Iyer', email: 'lakshmi.venues@fira.test', businessName: 'Southern Celebrations' },
    { name: 'Amit Kapoor', email: 'amit.venues@fira.test', businessName: 'Urban Venues Inc' }
];

const organizers = [
    // === DJs ===
    { 
        name: 'DJ Cosmic', 
        email: 'dj.cosmic@fira.test', 
        brandName: 'Cosmic Events',
        brandType: 'dj',
        verificationBadge: 'organizer',
        bio: 'Premier DJ and event organizer. Known for explosive EDM sets and unforgettable party vibes. 10+ years in the industry.'
    },
    { 
        name: 'DJ Pulse', 
        email: 'dj.pulse@fira.test', 
        brandName: 'Pulse Beats',
        brandType: 'dj',
        verificationBadge: 'brand',
        bio: 'Underground techno specialist. Bringing deep bass and hypnotic rhythms to the dancefloor.'
    },

    // === BANDS ===
    { 
        name: 'Rhythm Masters', 
        email: 'rhythm.masters@fira.test', 
        brandName: 'Rhythm Masters Band',
        brandType: 'band',
        verificationBadge: 'band',
        bio: 'Fusion band blending classical Indian music with contemporary beats. Perfect for weddings and corporate events.'
    },
    { 
        name: 'The Midnight Echo', 
        email: 'midnight.echo@fira.test', 
        brandName: 'The Midnight Echo',
        brandType: 'band',
        verificationBadge: 'band',
        bio: 'Alternative rock band known for high-energy performances and chart-topping hits. Available for festivals and private gigs.'
    },
    {
        name: 'Soulful Strings',
        email: 'soulful.strings@fira.test',
        brandName: 'Soulful Strings Quartet',
        brandType: 'band',
        verificationBadge: 'band',
        bio: 'Elegant string quartet for luxury events and intimate gatherings. Classical repertoire mixed with modern pop covers.'
    },

    // === PLANNERS ===
    { 
        name: 'Sarah Creative', 
        email: 'sarah.creative@fira.test', 
        brandName: 'Creative Events Co.',
        brandType: 'planner',
        verificationBadge: 'organizer',
        bio: 'Full-service event planning and management. From intimate gatherings to grand celebrations, we make your vision reality.'
    },
    {
        name: 'Elite Weddings',
        email: 'elite.weddings@fira.test',
        brandName: 'Elite Wedding Planners',
        brandType: 'planner',
        verificationBadge: 'organizer',
        bio: 'Luxury wedding planning service. We turn your dream wedding into a breathtaking reality.'
    },

    // === PHOTOGRAPHERS ===
    { 
        name: 'Lens Master', 
        email: 'lens.master@fira.test', 
        brandName: 'LensMaster Photography',
        brandType: 'photographer',
        verificationBadge: 'brand',
        bio: 'Award-winning event photography and videography. Capturing moments that last a lifetime.'
    },

    // === CATERERS ===
    { 
        name: 'Spice Route', 
        email: 'spice.route@fira.test', 
        brandName: 'Spice Route Catering',
        brandType: 'caterer',
        verificationBadge: 'brand',
        bio: 'Premium catering services featuring multi-cuisine options. From street food to fine dining, we cater to all tastes.'
    },

    // === BRANDS ===
    {
        name: 'Red Bull Music',
        email: 'rb.music@fira.test',
        brandName: 'Red Bull Music',
        brandType: 'brand',
        verificationBadge: 'brand',
        bio: 'Celebrating music, culture, and innovation. Hosting events that push boundaries and inspire creativity.'
    },
    {
        name: 'Coke Studio',
        email: 'coke.studio@fira.test',
        brandName: 'Coke Studio Live',
        brandType: 'brand',
        verificationBadge: 'brand',
        bio: 'Bringing the magic of Coke Studio to live audiences. Fusion music, incredible artists, and unforgettable experiences.'
    },
    {
        name: 'Spotify LIVE',
        email: 'spotify.live@fira.test',
        brandName: 'Spotify LIVE',
        brandType: 'brand',
        verificationBadge: 'brand',
        bio: 'Exclusive live sessions and concerts from your favorite Spotify artists. Discover music like never before.'
    },

    // === ORGANIZERS ===
    {
        name: 'Sunburn Festival',
        email: 'sunburn@fira.test',
        brandName: 'Sunburn Festival',
        brandType: 'organizer',
        verificationBadge: 'organizer',
        bio: 'Asia\'s biggest electronic music festival. bringing top international DJs and massive productions to India.'
    },
    {
        name: 'NH7 Weekender',
        email: 'nh7@fira.test',
        brandName: 'NH7 Weekender',
        brandType: 'organizer',
        verificationBadge: 'organizer',
        bio: 'The happiest music festival. Multi-genre, multi-city festival featuring the best independent music and art.'
    },
    {
        name: 'Boiler Room',
        email: 'boiler.room@fira.test',
        brandName: 'Boiler Room India',
        brandType: 'organizer',
        verificationBadge: 'organizer',
    }
];

const pendingCreators = [
    {
        name: 'Pending Artist',
        email: 'pending.artist@fira.test',
        brandName: 'Pending Artist Project',
        brandType: 'band', // Changed to valid enum
        verificationBadge: 'none', // Not verified yet
        bio: 'Aspiring artist waiting for verification.'
    },
    {
        name: 'Pending Brand',
        email: 'pending.brand@fira.test',
        brandName: 'Pending Brand Co.',
        brandType: 'brand',
        verificationBadge: 'none',
        bio: 'New brand applying for verification.'
    }
];

// ===========================================
// VENUE SEED DATA
// ===========================================

const venues = [
    {
        name: 'The Grand Ballroom',
        description: 'A majestic ballroom featuring crystal chandeliers, marble floors, and capacity for up to 1000 guests. Perfect for weddings, corporate galas, and high-profile events.',
        images: [venueImages[0], venueImages[1]],
        capacity: { min: 100, max: 1000 },
        pricing: { basePrice: 250000, pricePerHour: 30000, currency: 'INR' },
        venueType: 'banquet',
        amenities: ['Chandeliers', 'Stage', 'Green Room', 'Valet Parking', 'AC', 'DJ Equipment', 'Catering Kitchen', 'Bridal Suite'],
        rules: ['No outside caterers', 'Event ends by midnight', 'Security deposit required'],
        location: { type: 'Point', coordinates: [72.8777, 19.0760] },
        address: { street: 'Nariman Point', city: 'Mumbai', state: 'Maharashtra', pincode: '400021', country: 'India' },
        ownerIndex: 0
    },
    {
        name: 'Skyline Rooftop Lounge',
        description: 'Stunning rooftop venue with panoramic city views. Open-air setting with retractable canopy, perfect for cocktail parties and sunset events.',
        images: [venueImages[2], venueImages[3]],
        capacity: { min: 50, max: 300 },
        pricing: { basePrice: 85000, pricePerHour: 12000, currency: 'INR' },
        venueType: 'rooftop',
        amenities: ['City Views', 'Bar', 'Lounge Seating', 'Fire Pits', 'DJ Setup', 'Heaters'],
        rules: ['Smart casual dress code', 'No loud music after 10 PM'],
        location: { type: 'Point', coordinates: [77.2090, 28.6139] },
        address: { street: 'Connaught Place', city: 'Delhi', state: 'Delhi', pincode: '110001', country: 'India' },
        ownerIndex: 1
    },
    {
        name: 'Beachside Paradise',
        description: 'Private beach venue with 200 feet of shoreline. Bohemian vibes, bonfire zones, and stunning sunsets. Ideal for beach weddings and festivals.',
        images: [venueImages[4], venueImages[5]],
        capacity: { min: 100, max: 500 },
        pricing: { basePrice: 150000, pricePerHour: 20000, currency: 'INR' },
        venueType: 'outdoor',
        amenities: ['Beach Access', 'Bonfire Zone', 'Cabanas', 'Beach Bar', 'Sound System', 'Parking'],
        rules: ['No glass on beach', 'Music curfew 11 PM', 'Beach cleanup mandatory'],
        location: { type: 'Point', coordinates: [73.7684, 15.2993] },
        address: { street: 'Calangute Beach', city: 'Goa', state: 'Goa', pincode: '403516', country: 'India' },
        ownerIndex: 2
    },
    {
        name: 'Industrial Warehouse',
        description: 'Raw industrial space with exposed brick, high ceilings, and flexible layout. Perfect for concerts, art exhibitions, and underground parties.',
        images: [venueImages[6], venueImages[7]],
        capacity: { min: 200, max: 1200 },
        pricing: { basePrice: 75000, pricePerHour: 10000, currency: 'INR' },
        venueType: 'club',
        amenities: ['High Ceilings', 'Loading Dock', 'Rigging Points', 'Power Supply', 'Green Rooms'],
        rules: ['Fire safety compliance', 'No structural modifications'],
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: { street: 'Whitefield', city: 'Bangalore', state: 'Karnataka', pincode: '560066', country: 'India' },
        ownerIndex: 3
    },
    {
        name: 'Heritage Garden Estate',
        description: 'Colonial-era property with 2 acres of landscaped gardens. Multiple event spaces including grand lawn, rose garden, and heritage verandah.',
        images: [venueImages[8], venueImages[9]],
        capacity: { min: 100, max: 600 },
        pricing: { basePrice: 200000, pricePerHour: 25000, currency: 'INR' },
        venueType: 'resort',
        amenities: ['Gardens', 'Fountain', 'Bridal Suite', 'Catering', 'Parking', 'Vintage Decor'],
        rules: ['Heritage guidelines apply', 'No fireworks', 'Event ends by 11 PM'],
        location: { type: 'Point', coordinates: [73.8567, 18.5204] },
        address: { street: 'Koregaon Park', city: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'India' },
        ownerIndex: 4
    },
    {
        name: 'Convention Center Hall A',
        description: 'State-of-the-art convention center with modular spaces, cutting-edge AV, and comprehensive event support. Ideal for conferences and exhibitions.',
        images: [venueImages[0], venueImages[2]],
        capacity: { min: 500, max: 3000 },
        pricing: { basePrice: 350000, pricePerHour: 45000, currency: 'INR' },
        venueType: 'hall',
        amenities: ['Multiple Halls', 'AV Equipment', 'WiFi', 'Food Court', 'Exhibition Space', 'Loading Bay'],
        rules: ['Advance booking required', 'Security clearance for large events'],
        location: { type: 'Point', coordinates: [77.0688, 28.4595] },
        address: { street: 'Aerocity', city: 'Delhi', state: 'Delhi', pincode: '110037', country: 'India' },
        ownerIndex: 0
    },
    {
        name: 'Poolside Paradise',
        description: 'Luxury poolside venue perfect for day parties, pool parties, and brunches. Features infinity pool, cabanas, and tropical landscaping.',
        images: [venueImages[4], venueImages[6]],
        capacity: { min: 50, max: 250 },
        pricing: { basePrice: 100000, pricePerHour: 15000, currency: 'INR' },
        venueType: 'resort',
        amenities: ['Infinity Pool', 'Cabanas', 'Bar', 'BBQ Area', 'Changing Rooms', 'DJ Booth'],
        rules: ['Swimwear required for pool', 'No glass near pool', 'Lifeguard on duty'],
        location: { type: 'Point', coordinates: [72.8296, 18.9944] },
        address: { street: 'Lonavala', city: 'Pune', state: 'Maharashtra', pincode: '410401', country: 'India' },
        ownerIndex: 1
    },
    {
        name: 'The Art Gallery Space',
        description: 'Minimalist white-cube gallery space perfect for art exhibitions, product launches, and intimate gatherings. Natural lighting with floor-to-ceiling windows.',
        images: [venueImages[2], venueImages[8]],
        capacity: { min: 30, max: 150 },
        pricing: { basePrice: 45000, pricePerHour: 6000, currency: 'INR' },
        venueType: 'hall',
        amenities: ['Natural Light', 'Projector', 'Sound System', 'Kitchen Access', 'WiFi'],
        rules: ['No food in gallery area', 'Art handling guidelines apply'],
        location: { type: 'Point', coordinates: [72.8347, 18.9388] },
        address: { street: 'Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', country: 'India' },
        ownerIndex: 2
    }
];

// ===========================================
// EVENT SEED DATA
// ===========================================

const defaultTerms = `1. TICKET POLICY
• All tickets are non-refundable unless the event is cancelled.
• Tickets must be presented at entry (digital or printed).
• Lost tickets will not be replaced.

2. AGE RESTRICTIONS
• This event is for attendees 18+ unless otherwise specified.
• Valid ID required for entry.

3. VENUE RULES
• No outside food or beverages.
• No weapons or illegal substances.
• Follow all staff instructions.

4. SAFETY & LIABILITY
• Organizers are not responsible for personal injury or lost items.
• Emergency exits must remain clear.`;

const events = [
    {
        name: 'Electro Pulse Festival 2025',
        description: `🎉 THE BIGGEST EDM FESTIVAL OF THE YEAR! 🎉

Get ready for an electrifying experience featuring:
🎵 International headliners
💡 Stunning laser shows and pyrotechnics
🎪 Multiple stages with House, Techno, Trance
🍹 Premium food and beverage zones
🌟 12 hours of non-stop music

This is the party you've been waiting for!`,
        images: [eventImages[0], eventImages[1]],
        daysFromNow: 14,
        startTime: '18:00',
        endTime: '06:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 2500,
        maxAttendees: 2000,
        category: 'festival',
        isFeatured: true,
        venueIndex: 3,
        organizerIndex: 0
    },
    {
        name: 'Sunset Acoustic Sessions',
        description: `🎸 An intimate evening of soulful acoustic music as the sun paints the sky golden.

Featured artists include indie-folk singers, classical guitarists, and singer-songwriters.

✨ THE EXPERIENCE:
• Rooftop setting with city views
• Premium cocktails
• Gourmet appetizers
• Meet the artists

Perfect for couples and music lovers.`,
        images: [eventImages[2], eventImages[12]],
        daysFromNow: 3,
        startTime: '17:00',
        endTime: '22:00',
        eventType: 'public',
        ticketType: 'free',
        ticketPrice: 0,
        maxAttendees: 150,
        category: 'music',
        isFeatured: false,
        venueIndex: 1,
        organizerIndex: 1
    },
    {
        name: 'Beach Party Weekend',
        description: `🏖️ Feel the sand between your toes at our legendary beach party!

🌅 THE VIBE:
• Sunset DJ sets
• Fire dancers
• Fresh seafood BBQ
• Signature cocktails
• Bonfire zone

Dress code: Beach chic 🌊`,
        images: [eventImages[3], eventImages[4]],
        daysFromNow: 7,
        startTime: '15:00',
        endTime: '01:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 1800,
        maxAttendees: 400,
        category: 'party',
        isFeatured: true,
        venueIndex: 2,
        organizerIndex: 0
    },
    {
        name: 'Underground Techno Night',
        description: `Enter the depths of electronic music at Underground Techno Night.

🎧 THE SOUND:
Driving basslines, hypnotic rhythms, and mind-bending soundscapes on our Funktion-One sound system.

This is techno in its purest form. No mainstream - just authentic underground vibes.`,
        images: [eventImages[10], eventImages[5]],
        daysFromNow: 5,
        startTime: '22:00',
        endTime: '06:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 1000,
        maxAttendees: 500,
        category: 'clubbing',
        isFeatured: false,
        venueIndex: 3,
        organizerIndex: 0
    },
    {
        name: 'Corporate Innovation Summit 2025',
        description: `Join industry leaders at the Corporate Innovation Summit!

📊 AGENDA:
• Keynote speeches from Fortune 500 executives
• Panel discussions on AI and digital transformation
• Startup pitch competition
• Networking sessions with 500+ professionals

🎯 WHO SHOULD ATTEND:
CEOs, CTOs, entrepreneurs, and innovation enthusiasts.`,
        images: [eventImages[6], eventImages[7]],
        daysFromNow: 21,
        startTime: '09:00',
        endTime: '18:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 5000,
        maxAttendees: 600,
        category: 'corporate',
        isFeatured: true,
        venueIndex: 5,
        organizerIndex: 2
    },
    {
        name: 'Garden Wedding Celebration',
        description: `💍 A magical garden wedding featuring:
• Traditional ceremonies amid rose gardens
• Multi-cuisine gourmet dinner
• Live orchestra and dance floor
• Fireworks spectacular

This is a private event - invitation code required.`,
        images: [eventImages[8], eventImages[9]],
        daysFromNow: 30,
        startTime: '17:00',
        endTime: '23:00',
        eventType: 'private',
        ticketType: 'free',
        ticketPrice: 0,
        maxAttendees: 300,
        category: 'wedding',
        isFeatured: false,
        venueIndex: 4,
        organizerIndex: 2
    },
    {
        name: 'Jazz & Wine Evening',
        description: `🎷 An elegant evening of smooth jazz and fine wines.

🍷 INCLUSIONS:
• 3 hours of live jazz
• Wine tasting (5 varieties)
• Cheese and charcuterie board
• Meet the musicians

Smart casual dress code. Limited seating for an intimate experience.`,
        images: [eventImages[11], eventImages[12]],
        daysFromNow: 10,
        startTime: '19:00',
        endTime: '22:30',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 2200,
        maxAttendees: 80,
        category: 'music',
        isFeatured: false,
        venueIndex: 4,
        organizerIndex: 1
    },
    {
        name: 'Pool Party Brunch',
        description: `🍾 The ultimate daytime party experience!

☀️ WHAT'S INCLUDED:
• Unlimited brunch buffet
• Pool access with cabanas
• Live DJ sets
• Signature cocktails
• Games and activities

Come for the food, stay for the vibes!`,
        images: [eventImages[3], eventImages[4]],
        daysFromNow: 2,
        startTime: '11:00',
        endTime: '17:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 2500,
        maxAttendees: 200,
        category: 'party',
        isFeatured: true,
        venueIndex: 6,
        organizerIndex: 0
    },
    {
        name: 'Art Exhibition Opening',
        description: `🎨 Exclusive opening night for "Visions of Tomorrow" - a contemporary art exhibition.

Featuring works from 15 emerging artists exploring themes of technology, nature, and human connection.

🍷 Champagne reception included.`,
        images: [eventImages[7], eventImages[8]],
        daysFromNow: 8,
        startTime: '18:00',
        endTime: '22:00',
        eventType: 'public',
        ticketType: 'free',
        ticketPrice: 0,
        maxAttendees: 100,
        category: 'other',
        isFeatured: false,
        venueIndex: 7,
        organizerIndex: 3
    },
    {
        name: 'Fitness Festival',
        description: `💪 The ultimate fitness experience!

🏃 ACTIVITIES:
• Yoga sessions at sunrise
• CrossFit workshops
• Zumba masterclass
• Nutrition talks
• Fitness brand expo

All fitness levels welcome!`,
        images: [eventImages[6], eventImages[9]],
        daysFromNow: 15,
        startTime: '06:00',
        endTime: '18:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 1500,
        maxAttendees: 500,
        category: 'fitness',
        isFeatured: false,
        venueIndex: 2,
        organizerIndex: 2
    },
    {
        name: 'Bollywood Night',
        description: `💃 Dance the night away to the biggest Bollywood hits!

🎬 FEATURING:
• Live Bollywood band
• Professional dancers
• Themed photo booths
• Bollywood costume contest
• Unlimited dinner buffet

Get your groove on!`,
        images: [eventImages[0], eventImages[5]],
        daysFromNow: 12,
        startTime: '20:00',
        endTime: '02:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 1800,
        maxAttendees: 600,
        category: 'dance',
        isFeatured: true,
        venueIndex: 0,
        organizerIndex: 1
    },
    {
        name: 'Stand-up Comedy Night',
        description: `😂 Laugh out loud with the best comedians in town!

🎤 LINEUP:
• 5 nationally acclaimed comedians
• 2 hours of non-stop laughter
• Open mic segment for newcomers

Food and drinks available at the venue bar.`,
        images: [eventImages[10], eventImages[11]],
        daysFromNow: 6,
        startTime: '19:30',
        endTime: '22:30',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 800,
        maxAttendees: 200,
        category: 'other',
        isFeatured: false,
        venueIndex: 7,
        organizerIndex: 2
    }
];

// ===========================================
// MAIN SEED FUNCTION
// ===========================================

async function seedAll() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        console.log('\n' + '═'.repeat(60));
        console.log('🌱 FIRA COMPREHENSIVE SEED SCRIPT');
        console.log('═'.repeat(60) + '\n');

        // Step 1: Clean existing test data
        console.log('🗑️  Cleaning existing seed data...');
        await User.deleteMany({ email: /@fira\.test$/ });
        await Venue.deleteMany({});
        await Event.deleteMany({});
        await BrandProfile.deleteMany({});
        await Ticket.deleteMany({});
        await Booking.deleteMany({});
        await Post.deleteMany({});
        console.log('   ✓ Cleaned existing data\n');

        const hashedPassword = await bcrypt.hash('Test@123', 10);

        // Step 2.1: Create Admin User
        console.log('👑 Creating admin user...');
        const adminUser = await User.create({
            name: 'Super Admin',
            email: 'admin@fira.test',
            password: hashedPassword,
            phone: '+91 9999999999',
            avatar: avatarImages[0],
            role: 'admin',
            isVerified: true,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            isActive: true
        });
        console.log(`   ✓ Created Admin: admin@fira.test / Test@123\n`);

        // Step 2.2: Create Regular Users
        console.log('👤 Creating regular users...');
        const createdRegularUsers = [];
        for (let i = 0; i < regularUsers.length; i++) {
            const userData = regularUsers[i];
            const user = await User.create({
                name: userData.name,
                email: userData.email,
                password: hashedPassword,
                phone: userData.phone,
                avatar: avatarImages[i % avatarImages.length],
                role: 'user',
                isVerified: true,
                emailVerified: true,
                emailVerifiedAt: new Date(),
                isActive: true
            });
            createdRegularUsers.push(user);
            console.log(`   ✓ ${userData.name}`);
        }
        console.log(`   Total: ${createdRegularUsers.length} regular users\n`);

        // Step 3: Create Venue Owners
        console.log('🏢 Creating venue owners...');
        const createdVenueOwners = [];
        for (let i = 0; i < venueOwners.length; i++) {
            const ownerData = venueOwners[i];
            const owner = await User.create({
                name: ownerData.name,
                email: ownerData.email,
                password: hashedPassword,
                phone: `+91 98765${43220 + i}`,
                avatar: avatarImages[(i + 5) % avatarImages.length],
                role: 'venue_owner',
                isVerified: true,
                emailVerified: true,
                emailVerifiedAt: new Date(),
                isActive: true
            });
            createdVenueOwners.push(owner);
            console.log(`   ✓ ${ownerData.name} (${ownerData.businessName})`);
        }
        console.log(`   Total: ${createdVenueOwners.length} venue owners\n`);

        // Step 4: Create Organizers with Brand Profiles
        console.log('🎭 Creating organizers and brands...');
        const createdOrganizers = [];
        for (let i = 0; i < organizers.length; i++) {
            const orgData = organizers[i];
            const organizer = await User.create({
                name: orgData.name,
                email: orgData.email,
                password: hashedPassword,
                phone: `+91 98765${43230 + i}`,
                avatar: avatarImages[(i + 2) % avatarImages.length],
                coverPhoto: brandCoverImages[i % brandCoverImages.length],
                role: 'user',
                isVerified: true,
                emailVerified: true,
                emailVerifiedAt: new Date(),
                verificationBadge: orgData.verificationBadge,
                isActive: true
            });
            
            // Create Brand Profile
            await BrandProfile.create({
                user: organizer._id,
                name: orgData.brandName,
                type: orgData.brandType,
                bio: orgData.bio,
                coverPhoto: brandCoverImages[i % brandCoverImages.length],
                profilePhoto: avatarImages[(i + 2) % avatarImages.length],
                location: { type: 'Point', coordinates: [72.8777 + i * 0.5, 19.0760 + i * 0.3] },
                address: 'Mumbai, Maharashtra',
                socialLinks: {
                    instagram: `https://instagram.com/${orgData.brandName.toLowerCase().replace(/\s/g, '')}`,
                    website: `https://${orgData.brandName.toLowerCase().replace(/\s/g, '')}.com`
                },
                stats: { followers: 1000 * (i + 1), events: 10 + i * 5, views: 5000 * (i + 1) },
                status: 'approved', // explicit approved status
                isActive: true
            });
            
            createdOrganizers.push(organizer);
            console.log(`   ✓ ${orgData.name} → ${orgData.brandName}`);
        }
        console.log(`   Total: ${createdOrganizers.length} organizers with brands\n`);

        // Step 5: Create Venues
        console.log('🏛️  Creating venues...');
        const createdVenues = [];
        for (const venueData of venues) {
            const venue = await Venue.create({
                owner: createdVenueOwners[venueData.ownerIndex]._id,
                name: venueData.name,
                description: venueData.description,
                images: venueData.images,
                capacity: venueData.capacity,
                pricing: venueData.pricing,
                venueType: venueData.venueType,
                amenities: venueData.amenities,
                rules: venueData.rules,
                location: venueData.location,
                address: venueData.address,
                status: 'approved',
                rating: { average: 4 + Math.random(), count: Math.floor(Math.random() * 200) + 50 },
                isActive: true
            });
            createdVenues.push(venue);
            console.log(`   ✓ ${venueData.name}`);
        }
        console.log(`   Total: ${createdVenues.length} venues\n`);

        // Step 6: Create Events
        console.log('🎉 Creating events...');
        const createdEvents = [];
        for (const eventData of events) {
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

            const currentAttendees = Math.floor(Math.random() * eventData.maxAttendees * 0.7);

            const event = await Event.create({
                organizer: createdOrganizers[eventData.organizerIndex]._id,
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
                currentAttendees: currentAttendees,
                privateCode: eventData.eventType === 'private' ? 'INVITE2025' : null,
                category: eventData.category,
                termsAndConditions: defaultTerms,
                isFeatured: eventData.isFeatured,
                status: 'approved', // Changed from upcoming to approved
                venueApproval: {
                    status: 'approved',
                    respondedAt: new Date(),
                    respondedBy: createdVenueOwners[0]._id // System or dummy
                },
                adminApproval: {
                    status: 'approved',
                    respondedAt: new Date(),
                    respondedBy: adminUser._id
                }
            });
            createdEvents.push(event);
            console.log(`   ✓ ${eventData.name} (${currentAttendees}/${eventData.maxAttendees} attendees)`);
        }
        console.log(`   Total: ${createdEvents.length} events\n`);

        // Step 7: Create Tickets
        console.log('🎫 Creating tickets...');
        let ticketCount = 0;
        for (const event of createdEvents) {
            if (event.currentAttendees > 0) {
                const numTickets = Math.min(event.currentAttendees, createdRegularUsers.length);
                for (let i = 0; i < numTickets; i++) {
                    const user = createdRegularUsers[i % createdRegularUsers.length];
                    const quantity = Math.floor(Math.random() * 3) + 1;
                    
                    const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                    await Ticket.create({
                        ticketId: ticketId,
                        user: user._id,
                        event: event._id,
                        quantity: quantity,
                        ticketType: 'general',
                        price: event.ticketPrice * quantity,
                        status: 'active',
                        qrCode: `QR-${ticketId}`,
                        purchaseDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
                    });
                    ticketCount++;
                }
            }
        }
        console.log(`   ✓ Created ${ticketCount} tickets\n`);

        // Step 8: Create Bookings
        console.log('📅 Creating venue bookings...');
        let bookingCount = 0;
        for (let i = 0; i < 5; i++) {
            const venue = createdVenues[i % createdVenues.length];
            const user = createdOrganizers[i % createdOrganizers.length];
            const bookingDate = new Date();
            bookingDate.setDate(bookingDate.getDate() + 10 + i * 5);
            
            await Booking.create({
                venue: venue._id,
                user: user._id,
                event: createdEvents[i]._id,
                bookingType: 'event',
                bookingDate: bookingDate,
                startTime: '10:00',
                endTime: '22:00',
                purpose: 'Seed booking for testing purposes',
                expectedGuests: 200,
                totalAmount: venue.pricing.basePrice,
                status: ['pending', 'accepted', 'accepted', 'pending', 'accepted'][i],
                paymentStatus: ['pending', 'paid', 'paid', 'pending', 'paid'][i]
            });
            bookingCount++;
        }
        console.log(`   ✓ Created ${bookingCount} bookings\n`);

        // Step 9: Create Posts for Brands
        console.log('📝 Creating brand posts...');
        let postCount = 0;
        const brandPosts = [
            { content: '🎉 Excited to announce our next big event! Stay tuned for details.', image: eventImages[0] },
            { content: 'Thank you all for making last nights show incredible! 🙌', image: eventImages[1] },
            { content: 'Behind the scenes at todays setup. The venue looks amazing! ✨', image: eventImages[2] },
            { content: 'New merchandise dropping soon! Who wants a sneak peek? 👀', image: eventImages[3] },
            { content: 'Early bird tickets are selling fast! Grab yours now 🎫', image: eventImages[4] }
        ];
        
        const brands = await BrandProfile.find({}).populate('user');
        for (let i = 0; i < brands.length; i++) {
            const brand = brands[i];
            const numPosts = Math.floor(Math.random() * 3) + 1;
            for (let j = 0; j < numPosts; j++) {
                const postData = brandPosts[(i + j) % brandPosts.length];
                await Post.create({
                    brand: brand._id,
                    author: brand.user._id,
                    content: postData.content,
                    images: [postData.image],
                    likes: [],
                    comments: []
                });
                postCount++;
            }
        }
        console.log(`   ✓ Created ${postCount} posts\n`);

        // Step 6b: Create Pending Creators & Requests
        console.log('⏳ Creating pending verification requests...');
        const createdPendingUsers = [];
        
        for (const creatorData of pendingCreators) {
            const hashedPassword = await bcrypt.hash('Test@123', 10);
            const user = await User.create({
                name: creatorData.name,
                email: creatorData.email,
                password: hashedPassword,
                role: 'user',
                isVerified: false,
                emailVerified: true,
                verificationBadge: 'none',
                ownerName: creatorData.name,
            });
            createdPendingUsers.push(user);

            // Create Verification Request
            await VerificationRequest.create({
                user: user._id,
                type: creatorData.brandType,
                name: creatorData.brandName,
                description: creatorData.bio,
                documents: [{ name: 'ID Proof', url: 'https://example.com/doc.pdf', type: 'id_proof' }],
                socialLinks: { instagram: `https://instagram.com/${creatorData.brandName.replace(/\s/g, '')}` },
                portfolio: [{ title: 'Sample Work', url: 'https://example.com/portfolio', description: 'My best work' }],
                status: 'pending'
            });

            // Also create a "Pending Event" for an existing approved organizer (e.g., the first one) to test Event Approval
            if (creatorData === pendingCreators[0]) {
                 const organizer = createdOrganizers[0]; 
                 // Create a pending event
                 await Event.create({
                    name: 'Pending Approval Concert',
                    date: new Date(Date.now() + 86400000 * 20), // 20 days later
                    startTime: '20:00',
                    endTime: '23:00',
                    venue: createdVenues[0]._id, // Use first venue
                    organizer: organizer._id,
                    description: 'This event is waiting for admin approval.',
                    images: [eventImages[0]],
                    maxAttendees: 500,
                    ticketPrice: 999,
                    category: 'Music',
                    status: 'upcoming', // Not approved yet
                    isFeatured: false,
                    adminApproval: {
                        status: 'pending',
                        respondedAt: null,
                        respondedBy: null
                    },
                     venueApproval: {
                        status: 'approved',
                        respondedAt: new Date(),
                        respondedBy: createdVenues[0].ownerIndex 
                    }
                });
            }
        }
        console.log(`   ✓ Created ${createdPendingUsers.length} pending requests\n`);

        // Summary
        console.log('═'.repeat(60));
        console.log('✅ SEED COMPLETED SUCCESSFULLY!');
        console.log('═'.repeat(60));
        console.log('\n📊 SEEDED DATA SUMMARY:');
        console.log('─'.repeat(40));
        console.log(`   👤 Regular Users:    ${createdRegularUsers.length}`);
        console.log(`   🏢 Venue Owners:     ${createdVenueOwners.length}`);
        console.log(`   🎭 Organizers:       ${createdOrganizers.length}`);
        console.log(`   🏷️  Brand Profiles:   ${createdOrganizers.length}`);
        console.log(`   🏛️  Venues:           ${createdVenues.length}`);
        console.log(`   🎉 Events:           ${createdEvents.length}`);
        console.log(`   🎫 Tickets:          ${ticketCount}`);
        console.log(`   📅 Bookings:         ${bookingCount}`);
        console.log(`   📝 Posts:            ${postCount}`);
        console.log('─'.repeat(40));
        
        console.log('\n🔑 TEST CREDENTIALS (Password: Test@123):');
        console.log('─'.repeat(40));
        console.log('   Regular User:   rahul.sharma@fira.test');
        console.log('   Venue Owner:    rajesh.venues@fira.test');
        console.log('   Organizer:      dj.cosmic@fira.test');
        console.log('   Pending User:   pending.artist@fira.test');
        console.log('   Pending Brand:  pending.brand@fira.test');
        console.log('─'.repeat(40));
        console.log('\n🚀 Ready to test! Visit http://localhost:3000\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error during seeding:', error);
        process.exit(1);
    }
}

seedAll();
