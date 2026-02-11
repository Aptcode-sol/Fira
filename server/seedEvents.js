require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Venue = require('./models/Venue');
const Event = require('./models/Event');
const BrandProfile = require('./models/BrandProfile');

const MONGODB_URI = process.env.MONGODB_URI;

// Shared terms and conditions template
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
• Excessive intoxication may result in removal from the venue.

6. MEDIA CONSENT
• By attending, you consent to being photographed or recorded.
• Images may be used for promotional purposes.
• If you do not wish to be photographed, please inform staff.

7. CANCELLATION POLICY
• The organizer reserves the right to cancel or postpone the event.
• In case of cancellation, ticket holders will be notified via email.
• Refund policies will be communicated in case of cancellation.`;

// Dummy venues data
const dummyVenues = [
    {
        name: 'Skyline Rooftop',
        description: 'Premium rooftop venue with panoramic city views.',
        images: ['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'],
        capacity: { min: 50, max: 500 },
        pricing: { basePrice: 50000, currency: 'INR' },
        amenities: ['DJ Setup', 'Bar', 'Lighting', 'Sound System'],
        location: { type: 'Point', coordinates: [72.8777, 19.0760] },
        address: { street: 'Worli Sea Face', city: 'Mumbai', state: 'Maharashtra', pincode: '400018' },
        status: 'approved'
    },
    {
        name: 'The Grand Ballroom',
        description: 'Elegant ballroom for grand celebrations.',
        images: ['https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800'],
        capacity: { min: 100, max: 800 },
        pricing: { basePrice: 100000, currency: 'INR' },
        amenities: ['AC', 'Stage', 'Catering', 'Valet Parking'],
        location: { type: 'Point', coordinates: [77.2090, 28.6139] },
        address: { street: 'Connaught Place', city: 'Delhi', state: 'Delhi', pincode: '110001' },
        status: 'approved'
    },
    {
        name: 'Beach Club Paradise',
        description: 'Beachfront venue perfect for sunset parties.',
        images: ['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800'],
        capacity: { min: 100, max: 600 },
        pricing: { basePrice: 75000, currency: 'INR' },
        amenities: ['Beach Access', 'Pool', 'Bar', 'DJ Console'],
        location: { type: 'Point', coordinates: [73.7684, 15.2993] },
        address: { street: 'Baga Beach Road', city: 'Goa', state: 'Goa', pincode: '403516' },
        status: 'approved'
    },
    {
        name: 'Industrial Warehouse',
        description: 'Raw industrial space for underground events.',
        images: ['https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800'],
        capacity: { min: 200, max: 1000 },
        pricing: { basePrice: 40000, currency: 'INR' },
        amenities: ['High Ceilings', 'Loading Dock', 'Generator'],
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: { street: 'Whitefield', city: 'Bangalore', state: 'Karnataka', pincode: '560066' },
        status: 'approved'
    },
    {
        name: 'Garden Estate',
        description: 'Lush garden venue for outdoor celebrations.',
        images: ['https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800'],
        capacity: { min: 150, max: 500 },
        pricing: { basePrice: 60000, currency: 'INR' },
        amenities: ['Lawn', 'Gazebo', 'Fountain', 'Parking'],
        location: { type: 'Point', coordinates: [73.8567, 18.5204] },
        address: { street: 'Koregaon Park', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
        status: 'approved'
    }
];

// Brand names from seedBrands.js to fetch existing users
const brandNames = [
    'Neon Horizon',
    'The Midnight Club',
    'SoundWave Festivals',
    'Electric Dreams',
    'PixelPerfect',
    'Lunar Tides',
    'CityLights',
    'Groove Collective',
    'Artisan Market',
    'Summit Series'
];

// Dummy events data with lengthy descriptions and T&C
const dummyEvents = [
    {
        name: 'Neon Nights Festival',
        description: `Get ready for an electrifying night of music, lights, and unforgettable experiences at Neon Nights Festival!

Join us for an immersive journey through electronic dance music featuring world-class DJs spinning the hottest tracks from around the globe. Our state-of-the-art sound system and carefully curated lineup ensure every moment is pure magic.

🎵 WHAT TO EXPECT:
• World-class DJs from the global EDM scene
• Stunning visual displays and neon art installations
• Multiple stages with different music genres (House, Techno, Trance, Dubstep)
• Premium bars with signature cocktails
• Gourmet food stalls featuring local and international cuisine
• Interactive art installations and photo zones
• VIP lounge with exclusive amenities

🎪 THE EXPERIENCE:
Whether you're a seasoned raver or new to the scene, Neon Nights promises an experience that will leave you breathless. Our immersive environment features floor-to-ceiling LED panels, laser shows, and pyrotechnics that will transport you to another dimension.

The venue has been specially designed to maximize your experience, with multiple zones catering to different music tastes and crowd preferences. From the high-energy main stage to the intimate underground room, there's something for everyone.

📍 VENUE INFORMATION:
Doors open at 9 PM. We highly recommend arriving early to explore the art installations, grab the best spots, and take in the atmosphere before the DJs take the stage. The venue has ample parking facilities (charges apply) and is well-connected by public transport.

🍹 BARS & FOOD:
Multiple bars will be operational throughout the venue serving premium spirits, craft beers, and signature cocktails. Food stalls will offer a variety of options from quick bites to full meals. Cashless payment is encouraged.

Don't miss this once-in-a-lifetime experience. Get your tickets now before they sell out!`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800'],
        daysFromNow: 7,
        startTime: '21:00',
        endTime: '04:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 1500,
        maxAttendees: 500,
        currentAttendees: 342,
        category: 'party',
        isFeatured: true,
        venueIndex: 0,
        brandIndex: 0
    },
    {
        name: 'Acoustic Sunset Sessions',
        description: `Experience the magic of live acoustic music as the sun paints the sky in golden hues at our Acoustic Sunset Sessions.

This intimate gathering brings together some of the most talented acoustic artists for an evening of soulful performances. Set against the stunning backdrop of the city skyline, this event offers a unique blend of natural beauty and musical excellence.

🎸 THE LINEUP:
Our carefully curated lineup features indie-folk artists, singer-songwriters, and acoustic covers of popular hits. Each artist brings their unique style, creating a diverse musical tapestry that appeals to all tastes.

🌅 THE SETTING:
The rooftop venue provides breathtaking panoramic views of the city. As the sun sets and the stars appear, the atmosphere transforms into something truly magical. Comfortable seating arrangements ensure everyone has a great view while enjoying premium cocktails and finger foods.

✨ WHAT MAKES IT SPECIAL:
• Intimate setting with limited capacity
• Sunset views that will take your breath away
• Unplugged, raw acoustic performances
• Premium food and beverage options
• Perfect for couples and music enthusiasts

This is not just a concert – it's an experience that connects you with music on a deeper level. The acoustic format strips away the production and leaves only pure, authentic artistry.

Bring your friends, bring your loved ones, and join us for an evening you'll never forget.`,
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
        isFeatured: true,
        venueIndex: 0,
        brandIndex: 5
    },
    {
        name: 'Retro Beach Party',
        description: `Step back in time and dance your way through the greatest hits of the 80s and 90s at our legendary Retro Beach Party!

Feel the sand between your toes, the ocean breeze in your hair, and the iconic beats of classic retro hits as we transform the beachfront into a throwback paradise. This is more than a party – it's a celebration of an era that defined pop culture.

🎶 THE MUSIC:
Our DJs will be spinning non-stop hits from Michael Jackson, Madonna, Prince, Bon Jovi, Whitney Houston, and many more icons of the era. From synth-pop to rock ballads, from disco beats to classic R&B – we've got it all covered.

👗 DRESS CODE:
Go all out with your 80s and 90s fashion! Think neon colors, leg warmers, denim jackets, oversized sunglasses, and big hair. Best dressed attendees will win exciting prizes!

🏖️ BEACH VIBES:
The party starts in the afternoon and goes on till the early hours. Catch the sunset, enjoy beach volleyball, participate in fun games, and dance under the stars. The venue features:
• Multiple beach bars with tropical cocktails
• BBQ stations with fresh seafood and grills
• Bonfire zones for late-night hangouts
• Chill zones with bean bags and hammocks
• Photo booths with retro props

🎉 SPECIAL ACTIVITIES:
• Retro costume contest with prizes
• Dance-offs to classic hits
• Live performances by tribute bands
• Silent disco zone
• Retro arcade games

This is the ultimate beach party experience. Gather your squad, dust off your retro outfits, and get ready to party like it's 1989!`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800'],
        daysFromNow: 10,
        startTime: '16:00',
        endTime: '01:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 999,
        maxAttendees: 400,
        currentAttendees: 287,
        category: 'party',
        isFeatured: true,
        venueIndex: 2,
        brandIndex: 7
    },
    {
        name: 'Techno Underground',
        description: `Descend into the depths of electronic music at Techno Underground – where raw, industrial beats meet pure, unfiltered energy.

This is not your typical club night. Hosted in an authentic industrial warehouse, this event brings together the most innovative techno artists for an immersive journey into the heart of underground electronic music.

🎧 THE SOUND:
Expect driving basslines, hypnotic rhythms, and mind-bending soundscapes that will keep you moving until sunrise. Our Funktion-One sound system delivers crisp, powerful audio that lets you feel every beat in your bones.

🏭 THE VENUE:
The Industrial Warehouse provides the perfect setting for this event. High ceilings, exposed brick, and raw concrete create an atmosphere that perfectly complements the music. The space has been transformed with:
• State-of-the-art lighting and lasers
• Fog machines for that authentic club atmosphere
• Multiple rooms with different techno sub-genres
• Chill-out zone for when you need a break

🌙 THE NIGHT:
Gates open at 11 PM, and the party goes until 6 AM. This is a marathon, not a sprint – pace yourself and enjoy the journey. The lineup features a mix of established names and rising stars from the techno scene.

⚡ WHAT TO BRING:
• Comfortable shoes for dancing
• Ear protection if you're sensitive to loud music
• An open mind and positive energy

This is techno in its purest form. No gimmicks, no mainstream – just music for people who truly understand the genre.`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=800'],
        daysFromNow: 5,
        startTime: '23:00',
        endTime: '06:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 800,
        maxAttendees: 600,
        currentAttendees: 412,
        category: 'party',
        isFeatured: false,
        venueIndex: 3,
        brandIndex: 1
    },
    {
        name: 'New Year\'s Eve Gala 2025',
        description: `Ring in 2025 with unparalleled style and elegance at the most anticipated celebration of the year – the New Year's Eve Gala!

This exclusive event brings together the city's elite for a night of sophistication, entertainment, and unforgettable memories. Hosted at the prestigious Grand Ballroom, this gala sets the standard for New Year's celebrations.

🥂 THE EVENING:
The night begins with a champagne reception at 8 PM, followed by a gourmet multi-course dinner prepared by award-winning chefs. As midnight approaches, join the countdown with a glass of premium champagne as fireworks light up the sky.

🎭 ENTERTAINMENT:
• Live orchestra performing classics and contemporary hits
• International DJ taking over post-midnight
• Surprise celebrity performances
• Casino tables and entertainment lounges
• Magic and mentalism shows

👔 DRESS CODE:
Black tie/formal attire required. This is a sophisticated affair – dress to impress!

🍾 INCLUSIONS:
• Welcome champagne
• 5-course gourmet dinner with wine pairing
• Unlimited premium bar access
• Midnight champagne toast
• Party favors and confetti
• Breakfast service at 3 AM

🎁 VIP PACKAGES:
Upgrade to VIP for exclusive benefits including private seating, dedicated servers, premium spirit service, and a gift hamper to take home.

Start your new year in the most memorable way possible. This event sells out every year – secure your spot now!`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800'],
        daysFromNow: 12,
        startTime: '20:00',
        endTime: '05:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 5000,
        maxAttendees: 800,
        currentAttendees: 650,
        category: 'party',
        isFeatured: true,
        venueIndex: 1,
        brandIndex: 2
    },
    {
        name: 'Indie Music Showcase',
        description: `Discover the future of music at our Indie Music Showcase – a platform for independent artists to share their craft with appreciative audiences.

This event celebrates the spirit of independent music, featuring emerging bands and solo artists who are pushing creative boundaries. If you're tired of mainstream music and crave something authentic, this is your event.

🎤 THE LINEUP:
We've curated an eclectic mix of indie rock, alternative, folk-pop, and experimental artists. Each performer brings something unique to the stage, offering a diverse musical experience throughout the evening.

🎸 WHY ATTEND:
• Support independent artists directly
• Discover your new favorite band before they go mainstream
• Intimate venue setting with great acoustics
• Meet the artists after their sets
• Exclusive merchandise only available at the event

📍 THE VENUE:
The Industrial Warehouse provides an intimate yet spacious setting perfect for live music. With a capacity limited to ensure everyone gets a great view and sound experience.

✨ COMMUNITY:
This event is more than music – it's a celebration of the indie community. Connect with fellow music lovers, share recommendations, and be part of a movement that values artistry over algorithms.

All proceeds from ticket sales go directly to supporting the performing artists.`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1501612780327-45045538702b?w=800'],
        daysFromNow: 8,
        startTime: '18:00',
        endTime: '23:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 500,
        maxAttendees: 200,
        currentAttendees: 156,
        category: 'concert',
        isFeatured: false,
        venueIndex: 3,
        brandIndex: 3
    },
    {
        name: 'Corporate Tech Summit',
        description: `Join industry leaders, innovators, and visionaries at the Corporate Tech Summit – the premier gathering for technology professionals and business leaders.

This full-day summit brings together the brightest minds in technology to discuss trends, share insights, and explore opportunities that will shape the future of business and society.

📊 AGENDA HIGHLIGHTS:
• Keynote presentations from Fortune 500 executives
• Panel discussions on AI, blockchain, and emerging technologies
• Hands-on workshops and masterclasses
• Networking sessions with industry peers
• Startup pitch competition
• Exhibition hall featuring latest tech innovations

🎯 WHO SHOULD ATTEND:
• CTOs, CIOs, and technology leaders
• Startup founders and entrepreneurs
• Developers and engineers
• Product managers
• Investors and VCs
• Anyone passionate about technology

🤝 NETWORKING:
The summit includes dedicated networking breaks, a power lunch with assigned seating to facilitate connections, and an evening cocktail reception. Our matchmaking app helps you identify and connect with valuable contacts.

📱 WHAT'S INCLUDED:
• Full-day access to all sessions
• Gourmet lunch and refreshments
• Digital goodie bag with exclusive resources
• Certificate of attendance
• Access to recorded sessions post-event

This summit is essential for anyone looking to stay ahead in the rapidly evolving tech landscape.`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'],
        daysFromNow: 14,
        startTime: '09:00',
        endTime: '18:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 2000,
        maxAttendees: 300,
        currentAttendees: 234,
        category: 'corporate',
        isFeatured: false,
        venueIndex: 1,
        brandIndex: 9
    },
    {
        name: 'Garden Wedding Reception',
        description: `You are cordially invited to celebrate love, joy, and new beginnings at this beautiful garden wedding reception.

Set in the enchanting Garden Estate, surrounded by manicured lawns, blooming flowers, and old-world charm, this celebration promises to be a magical evening under the stars.

💒 THE CELEBRATION:
Join us as we celebrate the union of two souls in a ceremony that blends tradition with contemporary elegance. The evening will feature:
• Traditional welcome ceremony
• Exchange of vows in the rose garden
• Multi-course dinner under the stars
• Live band and DJ entertainment
• Dance floor under the fairy-light canopy

🌸 THE VENUE:
The Garden Estate provides a romantic backdrop with its:
• Sprawling manicured lawns
• Heritage gazebo for the ceremony
• Ancient banyan tree with fairy lights
• Koi pond and waterfall features
• Indoor backup in case of weather

🍽️ THE FEAST:
Our award-winning catering team has prepared a multi-cuisine menu featuring both traditional and international dishes. Special dietary requirements can be accommodated with advance notice.

This is a private, invitation-only event. Please use your access code to confirm your attendance.`,
        termsAndConditions: `PRIVATE EVENT TERMS:
• This is an invitation-only event
• Access code required for entry
• Photography is encouraged but professional equipment requires permission
• The couple requests no live social media posting during the ceremony
• Gifts are optional; the couple prefers no boxed gifts
• Dress code: Semi-formal/Cocktail attire
• Children are welcome and supervised play area is available`,
        images: ['https://images.unsplash.com/photo-1519741497674-611481863552?w=800'],
        daysFromNow: 21,
        startTime: '17:00',
        endTime: '23:00',
        eventType: 'private',
        ticketType: 'free',
        ticketPrice: 0,
        maxAttendees: 300,
        currentAttendees: 0,
        category: 'wedding',
        isFeatured: false,
        venueIndex: 4,
        brandIndex: 8
    },
    {
        name: 'Bollywood Nights',
        description: `Get ready to groove to the biggest Bollywood hits at the most happening desi night in the city – Bollywood Nights!

From classic melodies to the latest chartbusters, our DJs will take you on a musical journey through the golden era of Bollywood to the modern bangers that rule the dance floors.

🎬 THE MUSIC:
Expect a perfect mix of:
• 90s classics that never get old
• Shah Rukh Khan era romantic hits
• Punjabi beats and Honey Singh bangers
• Latest Bollywood chartbusters
• Regional favorites and remix anthems

💃 DRESS CODE:
Channel your inner Bollywood star! Whether it's dapper indo-western, glamorous lehengas, or contemporary party wear – dress to steal the spotlight.

🏆 SPECIAL ACTIVITIES:
• Best dressed competition with prizes
• Dance-off challenges
• Filmi dialogue contests
• Photo booth with Bollywood props
• Surprise celebrity performances

🍸 THE EXPERIENCE:
The iconic Skyline Rooftop transforms into a Bollywood set for the night, complete with themed decorations and photo ops. Multiple bars will serve desi-inspired cocktails alongside premium spirits.

Whether you're a hardcore Bollywood fan or just love a great party, this is THE night to let loose and dance like no one's watching!`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800'],
        daysFromNow: 4,
        startTime: '21:00',
        endTime: '03:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 700,
        maxAttendees: 400,
        currentAttendees: 298,
        category: 'party',
        isFeatured: true,
        venueIndex: 0,
        brandIndex: 6
    },
    {
        name: 'Open Mic Comedy Night',
        description: `Prepare for an evening of non-stop laughter at our Open Mic Comedy Night – where both seasoned comedians and fresh talent take the stage!

This is your chance to witness the comedy stars of tomorrow honing their craft, alongside established performers testing new material. It's raw, it's real, and it's absolutely hilarious.

🎤 THE FORMAT:
The evening features:
• Warm-up acts by upcoming comedians (5 min each)
• Featured performances by established names (15 min each)
• Surprise drop-ins (you never know who might show up!)
• Open mic slots for brave souls wanting to try stand-up

🤣 WHAT TO EXPECT:
Comedy topics range from relatable everyday observations to sharp social commentary. Our performers cover a variety of styles including observational comedy, storytelling, one-liners, and crowd work.

🍻 THE VIBE:
The intimate setting ensures every seat feels like front row. Enjoy craft beers, cocktails, and bar snacks while you laugh the night away. The casual atmosphere encourages audience interaction – but beware, front row seats might get you involved in the act!

📝 WANT TO PERFORM?
We reserve some slots for first-time performers. If you've always wanted to try stand-up, this is your chance! Contact us to register for an open mic slot.

Warning: Some content may be for mature audiences. Please be advised!`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=800'],
        daysFromNow: 2,
        startTime: '19:00',
        endTime: '22:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 300,
        maxAttendees: 100,
        currentAttendees: 89,
        category: 'other',
        isFeatured: false,
        venueIndex: 3,
        brandIndex: 4
    },
    {
        name: 'Sunrise Yoga Festival',
        description: `Begin your day with purpose at the Sunrise Yoga Festival – a transformative experience that combines yoga, meditation, and wellness in a stunning beachfront setting.

As the sun rises over the horizon, join hundreds of practitioners in a collective journey towards inner peace and physical well-being.

🌅 THE EXPERIENCE:
• 5:30 AM - Gather on the beach as dawn breaks
• 5:45 AM - Guided meditation to center your mind
• 6:00 AM - 90-minute sunrise yoga session
• 7:30 AM - Pranayama and breathing exercises
• 8:00 AM - Healthy breakfast and community connection

🧘 WHO IT'S FOR:
• All levels welcome – from beginners to advanced practitioners
• Modifications provided for every pose
• Specially designed sessions for different experience levels
• Mats provided (or bring your own)

🌿 THE SETTING:
The beachfront location provides the perfect backdrop for this spiritual experience. The sound of waves, the feel of sand, and the golden sunrise create an atmosphere that enhances every aspect of your practice.

✨ INCLUDED:
• 3+ hours of guided instruction
• Yoga mat and props
• Healthy breakfast buffet
• Herbal tea and coconut water
• Wellness goodie bag
• Post-event chill zone access

This free event is made possible by our wellness sponsors. Registration required due to limited capacity.`,
        termsAndConditions: `WELLNESS EVENT TERMS:
• Arrive at least 15 minutes before start time
• Wear comfortable clothing suitable for movement
• Avoid heavy meals before the session
• Inform instructors of any injuries or limitations
• Stay hydrated before and during the event
• Practice at your own pace and listen to your body
• Photography permitted but no flash during meditation
• Please maintain a peaceful environment for all participants`,
        images: ['https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=800'],
        daysFromNow: 6,
        startTime: '05:30',
        endTime: '09:00',
        eventType: 'public',
        ticketType: 'free',
        ticketPrice: 0,
        maxAttendees: 200,
        currentAttendees: 145,
        category: 'festival',
        isFeatured: false,
        venueIndex: 2,
        brandIndex: 5
    },
    {
        name: 'Hip Hop Block Party',
        description: `The streets come alive at the Hip Hop Block Party – where beats, rhymes, and urban culture collide in an explosion of energy!

This is where real hip hop lives. Raw, unfiltered, and authentic. From old-school classics to the latest trap bangers, we celebrate the culture that changed music forever.

🎤 THE LINEUP:
• DJ battles showcasing scratch masters
• MC cyphers and freestyle sessions
• B-boy/B-girl dance competitions
• Local rappers showcase
• Surprise headliner announcement night of event

🎨 CULTURE:
The party embraces all four elements of hip hop:
• DJing - Multiple turntable setups
• MCing - Open mic for rappers
• B-boying - Dance floor dedicated to breaking
• Graffiti - Live art creation throughout the night

👕 WHAT TO WEAR:
Streetwear is the vibe. Fresh kicks, snapbacks, jerseys, chains – represent the culture however you feel comfortable.

🛹 ACTIVITIES:
• Sneaker swap meet
• Streetwear vendor market
• Basketball shoot-out competition
• Gaming lounge with classic games
• Photo booth with graffiti backdrop

This is more than a party – it's a celebration of hip hop culture. Real recognize real.`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800'],
        daysFromNow: 9,
        startTime: '18:00',
        endTime: '02:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 600,
        maxAttendees: 350,
        currentAttendees: 267,
        category: 'party',
        isFeatured: false,
        venueIndex: 3,
        brandIndex: 7
    },
    {
        name: 'Classical Music Evening',
        description: `Immerse yourself in the timeless beauty of classical music at this elegant evening concert featuring world-class musicians.

This sophisticated evening brings together master performers for an unforgettable journey through the greatest compositions in classical music history.

🎻 THE PROGRAM:
• First Half: Chamber music featuring string quartet
• Intermission: Champagne reception
• Second Half: Full orchestra performance
• Pieces by Mozart, Beethoven, Tchaikovsky, and more

🎼 THE PERFORMERS:
Our ensemble brings together musicians from prestigious orchestras, trained at the finest conservatories worldwide. Their passion and technical excellence create performances that move the soul.

🏛️ THE VENUE:
The Grand Ballroom's stunning acoustics and elegant ambiance provide the perfect setting for classical music. The ornate chandeliers, high ceilings, and plush seating create an atmosphere befitting the grandeur of the music.

👔 DRESS CODE:
Smart casual to formal attire recommended. This is an elegant affair celebrating high culture.

🍾 INCLUSIONS:
• Reserved seating
• Program booklet with composer notes
• Champagne during intermission
• Meet the artists opportunity after the show

Experience music as it was meant to be heard – live, intimate, and transcendent.`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800'],
        daysFromNow: 11,
        startTime: '18:30',
        endTime: '21:30',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 1200,
        maxAttendees: 150,
        currentAttendees: 112,
        category: 'concert',
        isFeatured: false,
        venueIndex: 1,
        brandIndex: 3
    },
    {
        name: 'Kids Birthday Extravaganza',
        description: `Create magical birthday memories at the Kids Birthday Extravaganza – a fun-filled celebration designed especially for young ones!

This private party transforms the beautiful garden venue into a wonderland of games, entertainment, and endless fun for children and families alike.

🎈 ENTERTAINMENT:
• Professional mascot characters
• Magic show with interactive tricks
• Face painting and balloon art
• Treasure hunt across the garden
• Puppet show and storytelling
• Dance party with kids' DJ

🍰 THE FEAST:
• Pizza, burgers, and kid-friendly favorites
• Fresh fruit and healthy snacks
• Custom birthday cake
• Ice cream bar with toppings
• Sugar-free options available
• Supervised snack stations

🎮 ACTIVITIES:
• Bouncy castle and inflatable slides
• Arts and crafts corner
• Outdoor games and races
• Photo booth with props
• Goodie bag station

👨‍👩‍👧‍👦 FOR PARENTS:
While kids enjoy supervised activities, parents can relax in the dedicated parent zone with beverages and entertainment. Our trained staff ensure safety and fun for all children.

This is an invitation-only event. Access code required for entry.`,
        termsAndConditions: `KIDS EVENT TERMS:
• Adult supervision required for all children
• Parents must remain on premises
• Dietary restrictions must be communicated 48 hours in advance
• No outside food or gifts unless pre-approved
• Photography is encouraged for personal use
• Play areas are supervised but parents remain responsible
• Shoes required in all areas except designated play zones
• Event ends promptly at stated time`,
        images: ['https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800'],
        daysFromNow: 15,
        startTime: '14:00',
        endTime: '18:00',
        eventType: 'private',
        ticketType: 'free',
        ticketPrice: 0,
        maxAttendees: 50,
        currentAttendees: 0,
        category: 'birthday',
        isFeatured: false,
        venueIndex: 4,
        brandIndex: 8
    },
    {
        name: 'Food & Music Festival',
        description: `Indulge your senses at the Food & Music Festival – a celebration of culinary excellence and musical talent that brings together the best of both worlds!

Spread across the beautiful Garden Estate, this festival offers an entire day of gastronomic adventures and live entertainment that will leave you satisfied in every way.

🍕 THE FOOD:
Over 40 food stalls featuring:
• International cuisines (Italian, Mexican, Thai, Japanese)
• Indian regional specialties
• Street food favorites
• Gourmet burgers and artisanal pizzas
• Vegan and vegetarian options
• Dessert paradise with local and international sweets
• Craft beverages and cocktail bars

🎵 THE MUSIC:
Multiple stages featuring:
• Main Stage - Popular band performances
• Acoustic Corner - Singer-songwriter sessions
• DJ Deck - Electronic and dance music
• Cultural Stage - Traditional and folk performances

🎪 EXPERIENCE:
• All-day festival from noon to night
• Family-friendly environment
• Kids' zone with entertainment
• Sunset cocktail hours
• Night market opens at 6 PM
• Fireworks finale at 9 PM

📱 FESTIVAL FEATURES:
• Cashless payment system
• Festival app for schedules and ordering
• Ample seating areas
• Clean rest rooms and baby changing facilities

This festival celebrates the joy of eating well and listening to great music in beautiful surroundings. Bring your appetite!`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800'],
        daysFromNow: 13,
        startTime: '12:00',
        endTime: '22:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 250,
        maxAttendees: 1000,
        currentAttendees: 678,
        category: 'festival',
        isFeatured: true,
        venueIndex: 4,
        brandIndex: 2
    },
    {
        name: 'Silent Disco',
        description: `Experience dancing like never before at our Silent Disco – where the music is in your head and the vibe is on the floor!

Put on your wireless headphones and choose your channel – three DJs go head to head, and YOU decide who wins by switching between them. It's interactive, it's hilarious, and it's incredibly fun!

🎧 HOW IT WORKS:
Each attendee receives premium wireless headphones with three channels. Each channel plays a different genre:
• Channel RED - Pop & Commercial Hits
• Channel GREEN - Hip Hop & R&B
• Channel BLUE - Electronic & House

The headphones glow in the color of your chosen channel, creating a visual spectacle of color as people dance to their preferred music. The DJ with the most listeners wins!

✨ WHAT MAKES IT SPECIAL:
• Perfect for late-night parties (no noise complaints!)
• See people dancing to different beats next to each other
• Ultra-high-quality sound directly in your ears
• Complete control over your music and volume
• Hilarious when you take off the headphones

🎉 THE EXPERIENCE:
The rooftop transforms into a party where two people next to each other might be dancing to completely different songs. Sing along to your track while your friend can't hear a thing – it's comedy gold!

Warning: Side effects may include uncontrollable dancing and laughing at your friends singing songs you can't hear!`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800'],
        daysFromNow: 1,
        startTime: '20:00',
        endTime: '01:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 450,
        maxAttendees: 200,
        currentAttendees: 187,
        category: 'party',
        isFeatured: false,
        venueIndex: 0,
        brandIndex: 1
    },
    {
        name: 'Rock Band Championship',
        description: `Witness the ultimate battle for rock supremacy at the Rock Band Championship – where the city's best bands compete for glory!

This high-energy competition brings together the most talented rock bands in the region for an evening of incredible performances, fierce competition, and pure rock 'n' roll energy.

🎸 THE COMPETITION:
• 8 bands competing in knockout rounds
• Each band performs a 20-minute set
• Original compositions and cover songs
• Special guest judges from the music industry
• Audience voting influences final scores
• Grand prize: Recording contract + ₹1 Lakh cash

🤘 MUSIC STYLES:
Expect a diverse range of rock sub-genres:
• Classic Rock
• Alternative/Indie Rock
• Hard Rock/Metal
• Progressive Rock
• Punk Rock

🎤 THE BANDS:
Each competing band has been carefully selected from hundreds of applicants. These are the best musicians in the region, hungry to prove themselves on the biggest rock stage.

🏆 PRIZES:
• 1st Place: Recording deal + ₹1 Lakh
• 2nd Place: ₹50,000 + studio time
• 3rd Place: ₹25,000 + gear package
• Audience Choice: ₹10,000

If you love rock music, this is the must-attend event of the year!`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=800'],
        daysFromNow: 16,
        startTime: '17:00',
        endTime: '23:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 400,
        maxAttendees: 300,
        currentAttendees: 234,
        category: 'concert',
        isFeatured: false,
        venueIndex: 3,
        brandIndex: 3
    },
    {
        name: 'Startup Pitch Night',
        description: `Witness innovation in action at Startup Pitch Night – where the next big ideas compete for investment and recognition!

This exciting evening brings together ambitious founders, keen investors, and curious observers for an evening of groundbreaking pitches and networking opportunities.

💡 THE FORMAT:
• 10 pre-selected startups pitch their ideas
• Each pitch: 5 minutes presentation + 5 minutes Q&A
• Expert panel provides feedback
• Audience participates through live voting
• Networking session follows pitches
• Winners announced at close

🧑‍💼 THE JUDGES:
Our panel includes:
• Venture capitalists from top firms
• Successful entrepreneurs and exits
• Corporate innovation heads
• Angel investors

🚀 STARTUP CATEGORIES:
• FinTech
• HealthTech
• EdTech
• B2B SaaS
• Consumer Tech
• Sustainability

🤝 NETWORKING:
Post-pitch networking is where the real magic happens. Founders connect with investors, corporate partners explore collaborations, and like-minded individuals find their next co-founder.

✨ FREE ENTRY INCLUDES:
• Access to all pitches
• Networking reception
• Light refreshments
• Startup ecosystem directory
• Investor meeting facilitation

Whether you're a founder, investor, or simply curious about innovation, this is the evening to be at!`,
        termsAndConditions: `PITCH EVENT TERMS:
• No recording of pitches without permission
• Confidentiality expected for shared ideas
• Networking etiquette applies
• No aggressive solicitation
• Investment discussions are private and non-binding
• Organizers are not liable for investment decisions
• Press attendance by invitation only`,
        images: ['https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800'],
        daysFromNow: 18,
        startTime: '18:00',
        endTime: '21:00',
        eventType: 'public',
        ticketType: 'free',
        ticketPrice: 0,
        maxAttendees: 150,
        currentAttendees: 98,
        category: 'corporate',
        isFeatured: false,
        venueIndex: 3,
        brandIndex: 9
    },
    {
        name: 'Tropical Pool Party',
        description: `Escape to paradise without leaving the city at our Tropical Pool Party – where summer vibes meet poolside luxury!

Transform your afternoon into a tropical vacation with crystal-clear pools, island-inspired cocktails, and the best poolside DJ sets money can't buy. This is summer party perfection.

🏊 THE VENUE:
Beach Club Paradise transforms into a tropical oasis featuring:
• Multiple pool areas
• Private cabanas (limited, book in advance)
• Daybed lounging areas
• Beach volleyball court
• Swim-up bar

🌴 THE VIBE:
• Tropical house and summer anthems
• Palm trees and beach décor
• Tropical cocktail menu
• Fresh seafood BBQ
• Coconuts and beach blankets

👗 DRESS CODE:
Swimwear, resort wear, and beach attire. Bring your best poolside looks – there will be best dressed prizes!

☀️ WHAT'S INCLUDED:
• Pool access all day
• Beach towel and locker
• Welcome drink
• Access to all DJ sets
• Sunset champagne toast

🍹 PREMIUM EXPERIENCE:
Upgrade to VIP for:
• Private cabana access
• Bottle service
• Premium food menu
• Fast-track entry
• Exclusive VIP pool area

Beat the heat and join the party. This sells out every year – secure your spot now!`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1560807707-8cc77767d783?w=800'],
        daysFromNow: 20,
        startTime: '14:00',
        endTime: '20:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 1200,
        maxAttendees: 200,
        currentAttendees: 156,
        category: 'party',
        isFeatured: true,
        venueIndex: 2,
        brandIndex: 0
    },
    {
        name: 'Jazz Under the Stars',
        description: `Experience the magic of live jazz in an enchanting garden setting at Jazz Under the Stars – an evening of sophistication and soul.

As twilight fades and stars emerge, some of the finest jazz musicians take the stage for intimate performances that transport you to the golden age of jazz clubs.

🎷 THE MUSIC:
• Smooth jazz standards
• Original compositions
• Bebop classics
• Latin jazz influences
• Vocal jazz performances

🎹 THE PERFORMERS:
Our ensemble features:
• Award-winning saxophonist
• Piano virtuoso
• Upright bass and drums
• Special guest vocalists
• All veterans of the jazz scene

🌙 THE SETTING:
The Garden Estate transforms into an outdoor jazz lounge:
• Candle-lit tables on the lawn
• Fairy lights creating a magical atmosphere
• Full bar with jazz-era cocktails
• Gourmet appetizers and desserts
• Cozy seating under the ancient banyan tree

👔 DRESS CODE:
Smart casual to elegant. This is a sophisticated evening – dress accordingly.

✨ SPECIAL FEATURES:
• Two sets with intermission
• Afterglow sessions with musicians
• Vinyl records available for purchase
• Complimentary bourbon tasting

For lovers of good music, great ambiance, and timeless elegance – this evening promises memories that will last a lifetime.`,
        termsAndConditions: defaultTerms,
        images: ['https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800'],
        daysFromNow: 22,
        startTime: '19:00',
        endTime: '23:00',
        eventType: 'public',
        ticketType: 'paid',
        ticketPrice: 800,
        maxAttendees: 150,
        currentAttendees: 89,
        category: 'concert',
        isFeatured: false,
        venueIndex: 4,
        brandIndex: 5
    }
];

async function seedEvents() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing events
        await Event.deleteMany({});
        console.log('Cleared existing events');

        // Fetch existing brand users
        const brandUsers = [];
        for (const brandName of brandNames) {
            const brandProfile = await BrandProfile.findOne({ name: brandName }).populate('user');
            if (brandProfile && brandProfile.user) {
                brandUsers.push(brandProfile.user);
                console.log(`Found brand user: ${brandName}`);
            } else {
                console.log(`Brand not found: ${brandName}, using first available`);
                brandUsers.push(null);
            }
        }

        // Get first valid user as fallback
        const fallbackUser = brandUsers.find(u => u !== null) || await User.findOne({});
        if (!fallbackUser) {
            console.error('No users found in database. Please run seedBrands.js first.');
            process.exit(1);
        }

        // Create venues if not exist
        const venues = [];
        for (const venueData of dummyVenues) {
            let venue = await Venue.findOne({ name: venueData.name });
            if (!venue) {
                venue = await Venue.create({ ...venueData, owner: fallbackUser._id });
                console.log(`Created venue: ${venueData.name}`);
            } else {
                console.log(`Venue exists: ${venueData.name}`);
            }
            venues.push(venue);
        }

        // Create events
        for (const eventData of dummyEvents) {
            const eventDate = new Date();
            eventDate.setDate(eventDate.getDate() + eventData.daysFromNow);

            // Create proper startDateTime and endDateTime
            const [startHour, startMin] = eventData.startTime.split(':').map(Number);
            const [endHour, endMin] = eventData.endTime.split(':').map(Number);
            
            const startDateTime = new Date(eventDate);
            startDateTime.setHours(startHour, startMin, 0, 0);
            
            const endDateTime = new Date(eventDate);
            endDateTime.setHours(endHour, endMin, 0, 0);
            
            // If end time is before start time, it means the event goes past midnight
            if (endDateTime <= startDateTime) {
                endDateTime.setDate(endDateTime.getDate() + 1);
            }

            const organizer = brandUsers[eventData.brandIndex] || fallbackUser;

            const event = await Event.create({
                organizer: organizer._id,
                venue: venues[eventData.venueIndex]._id,
                name: eventData.name,
                description: eventData.description,
                termsAndConditions: eventData.termsAndConditions,
                images: eventData.images,
                startDateTime: startDateTime,
                endDateTime: endDateTime,
                eventType: eventData.eventType,
                ticketType: eventData.ticketType,
                ticketPrice: eventData.ticketPrice,
                maxAttendees: eventData.maxAttendees,
                currentAttendees: eventData.currentAttendees,
                category: eventData.category,
                tags: [],
                status: 'approved',
                venueApproval: {
                    status: 'approved',
                    respondedAt: new Date(),
                    respondedBy: 'system'
                },
                adminApproval: {
                    status: 'approved',
                    respondedAt: new Date(),
                    respondedBy: 'system'
                },
                isFeatured: eventData.isFeatured
            });
            console.log(`Created event: ${event.name} (by ${organizer.name})`);
        }

        console.log('\n✅ Seeding complete! Created 20 events with detailed descriptions and T&C.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding events:', error);
        process.exit(1);
    }
}

seedEvents();
