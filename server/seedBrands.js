const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const User = require('./models/User');
const BrandProfile = require('./models/BrandProfile');
const Post = require('./models/Post');
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadImage = async (url, folder) => {
    try {
        const result = await cloudinary.uploader.upload(url, {
            folder: `firaa/${folder}`,
            resource_type: "image"
        });
        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary Upload Error:', error);
        return null; // Fallback or handle error
    }
};

const dummyBrands = [
    {
        name: 'Neon Horizon',
        type: 'band',
        bio: 'Synthwave duo bringing the future to the present. Known for high energy performances and retro visuals.',
        stats: { followers: 15420, events: 45 },
        sourceCover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
        socialLinks: {
            instagram: 'https://instagram.com/neonhorizon',
            spotify: 'https://spotify.com/artist/neonhorizon',
            youtube: 'https://youtube.com/neonhorizon'
        },
        members: [
            { name: 'Alex Glow', role: 'Synthesizer', photoUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=100&q=80' },
            { name: 'Max Retro', role: 'Vocals', photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80' }
        ],
        posts: [
            {
                content: "Can't wait for our next gig at The Grid! 🎹✨ #synthwave #livemusic",
                image: "https://images.unsplash.com/photo-1514525253440-b393452e8d26?auto=format&fit=crop&w=800&q=80"
            },
            {
                content: "New track 'Cyber Sunset' drops this Friday. Pre-save link in bio!",
                image: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    {
        name: 'The Midnight Club',
        type: 'organizer',
        bio: 'Exclusive tech-house and minimal techno events in undisclosed locations.',
        stats: { followers: 28000, events: 112 },
        sourceCover: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80',
        socialLinks: {
            instagram: 'https://instagram.com/midnightclub',
            website: 'https://midnightclub.events'
        },
        members: [],
        posts: [
            {
                content: "Secret location revealed 2 hours before the set. Are you on the list? 🤫🗝️",
                image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    {
        name: 'SoundWave Festivals',
        type: 'brand',
        bio: 'Organizers of the largest seaside music festivals in the country.',
        stats: { followers: 150000, events: 4 },
        sourceCover: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80',
        socialLinks: {
            facebook: 'https://facebook.com/soundwave',
            instagram: 'https://instagram.com/soundwavefest',
            website: 'https://soundwavefest.com'
        },
        posts: [
            {
                content: "Early bird tickets for Summer 2025 are SOLD OUT! 🌊☀️ General release coming soon.",
                image: "https://images.unsplash.com/photo-1459749411177-05be25405904?auto=format&fit=crop&w=800&q=80"
            },
            {
                content: "Reliving the magic of last year... who's ready to do it all again?",
                image: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?auto=format&fit=crop&w=800&q=80"
            },
            {
                content: "Artist announcement coming next week. Any guesses? 🤔",
                image: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    {
        name: 'Electric Dreams',
        type: 'band',
        bio: 'Indie rock band with a cult following. New album out now.',
        stats: { followers: 8900, events: 21 },
        sourceCover: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
        socialLinks: {
            spotify: 'https://open.spotify.com/artist/electricdreams',
            instagram: 'https://instagram.com/electricdreamsband'
        },
        members: [
            { name: 'Liam', role: 'Guitar/Vocals', photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80' },
            { name: 'Sarah', role: 'Drums', photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80' }
        ],
        posts: [
            {
                content: "Rehearsals going great! Can't wait to play the new album live for you guys. 🎸",
                image: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    {
        name: 'VibeCheck Events',
        type: 'organizer',
        bio: 'Weekly college parties and socials.',
        stats: { followers: 5000, events: 200 },
        sourceCover: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=400&q=80',
        socialLinks: {
            instagram: 'https://instagram.com/vibecheck'
        },
        posts: []
    },
    {
        name: 'Urban Beats',
        type: 'brand',
        bio: 'Streetwear brand sponsoring the hottest hip-hop gigs.',
        stats: { followers: 45000, events: 15 },
        sourceCover: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=80',
        socialLinks: {
            website: 'https://urbanbeats.com',
            instagram: 'https://instagram.com/urbanbeats'
        },
        posts: [
            {
                content: "New drop live on the site! Cop the limited edition hoodies before they're gone. 🔥",
                image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    {
        name: 'Solar Flare',
        type: 'band',
        bio: 'Psychedelic funk bringing the 70s vibe back.',
        stats: { followers: 12000, events: 30 },
        sourceCover: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
        posts: [
            {
                content: "Keep it groovy, baby. ✌️🌼",
                image: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    {
        name: 'TechNova',
        type: 'brand',
        bio: 'The future of gaming hardware and esports events.',
        stats: { followers: 85000, events: 10 },
        sourceCover: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1526045612212-70caf35c14df?auto=format&fit=crop&w=400&q=80',
        socialLinks: {
            twitter: 'https://twitter.com/technova',
            website: 'https://technova.gg',
            youtube: 'https://youtube.com/technova'
        },
        posts: [
            {
                content: "Introducing the new X-Series headset. Hear the difference. 🎧",
                image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80"
            },
            {
                content: "Major tournament announcement coming tomorrow! Stay tuned.",
                image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    {
        name: 'NightOwl Events',
        type: 'organizer',
        bio: 'Underground parties for the sleepless souls.',
        stats: { followers: 32000, events: 150 },
        sourceCover: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=400&q=80',
        posts: []
    },
    {
        name: 'Crimson Sky',
        type: 'band',
        bio: 'Alternative metal band with deep lyrics and heavy riffs.',
        stats: { followers: 41000, events: 55 },
        sourceCover: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
        posts: [
            {
                content: "Thank you [City Name]! That mosh pit was insane! 🤘",
                image: "https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    {
        name: 'EcoLife',
        type: 'brand',
        bio: 'Sustainable living and organic pop-up markets.',
        stats: { followers: 22000, events: 8 },
        sourceCover: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=400&q=80',
        posts: [
            {
                content: "Join us this Sunday for our zero-waste market! 🌿",
                image: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    {
        name: 'Rave Wave',
        type: 'organizer',
        bio: 'Just trance, laser lights, and good vibes.',
        stats: { followers: 67000, events: 80 },
        sourceCover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1496337589254-7e19d01cec44?auto=format&fit=crop&w=400&q=80',
        posts: []
    },
    {
        name: 'PixelPerfect',
        type: 'brand',
        bio: 'Design agency hosting creative workshops.',
        stats: { followers: 18000, events: 12 },
        sourceCover: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?auto=format&fit=crop&w=400&q=80',
        posts: []
    },
    {
        name: 'Lunar Tides',
        type: 'band',
        bio: 'Dream pop tunes for your late night drives.',
        stats: { followers: 9500, events: 18 },
        sourceCover: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?auto=format&fit=crop&w=400&q=80',
        posts: [
            {
                content: "Recording late into the night. 🌙✨",
                image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    {
        name: 'CityLights',
        type: 'organizer',
        bio: 'Rooftop jazz and cocktail soirees.',
        stats: { followers: 45000, events: 60 },
        sourceCover: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=400&q=80',
        posts: []
    },
    {
        name: 'Groove Collective',
        type: 'band',
        bio: 'Funk and soul fusion band, guaranteed to make you move.',
        stats: { followers: 18000, events: 35 },
        sourceCover: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
        posts: []
    },
    {
        name: 'Artisan Market',
        type: 'brand',
        bio: 'Showcasing local crafts and independent artists.',
        stats: { followers: 10000, events: 25 },
        sourceCover: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=400&q=80',
        posts: []
    },
    {
        name: 'Summit Series',
        type: 'organizer',
        bio: 'Adventure sports and outdoor lifestyle events.',
        stats: { followers: 25000, events: 15 },
        sourceCover: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=400&q=80',
        posts: []
    },
    {
        name: 'Quantum Leap',
        type: 'band',
        bio: 'Experimental electronic music pushing boundaries.',
        stats: { followers: 7000, events: 10 },
        sourceCover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
        posts: [
            {
                content: "Experimenting with new modular synths. Sounds from another dimension.",
                image: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    {
        name: 'Vintage Threads',
        type: 'brand',
        bio: 'Curated vintage clothing and accessories.',
        stats: { followers: 30000, events: 5 },
        sourceCover: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80',
        sourceProfile: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=400&q=80',
        posts: [
            {
                content: "Found some amazing denim jackets from the 80s today! Stay tuned for the new collection.",
                image: "https://images.unsplash.com/photo-1542272617-08f08630329e?auto=format&fit=crop&w=800&q=80"
            }
        ]
    }
];

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        for (const brandData of dummyBrands) {
            console.log(`Processing ${brandData.name}...`);
            
            // 1. Create User
            const email = `test_${brandData.name.replace(/\s+/g, '').toLowerCase()}@example.com`;
            let user = await User.findOne({ email });
            
            if (!user) {
                user = await User.create({
                    name: brandData.name,
                    email,
                    password: 'password123',
                    role: 'user',
                    isVerified: true,
                    verificationBadge: brandData.type
                });
                console.log(`  Created User`);
            } else {
                console.log(`  User exists`);
            }

            // 2. Upload Images to Cloudinary if needed
            let coverPhotoUrl = brandData.coverPhotoUrl;
            let profilePhotoUrl = brandData.profilePhotoUrl;
            
            const existingProfile = await BrandProfile.findOne({ user: user._id });
            
            let needsUpload = true;
            if (existingProfile && existingProfile.coverPhoto && existingProfile.coverPhoto.includes('cloudinary')) {
                 // Optimization: Skip upload if already exists (comment out to force update)
                 needsUpload = false; 
                 coverPhotoUrl = existingProfile.coverPhoto;
                 profilePhotoUrl = existingProfile.profilePhoto;
                 console.log(`  Images already on Cloudinary, skipping upload.`);
            }

            if (needsUpload) {
                if (brandData.sourceCover) {
                    // console.log(`  Uploading cover...`);
                    // coverPhotoUrl = await uploadImage(brandData.sourceCover, 'covers');
                    coverPhotoUrl = brandData.sourceCover; // Use directly for speed vs Unsplash
                }
                if (brandData.sourceProfile) {
                    // console.log(`  Uploading profile...`);
                    // profilePhotoUrl = await uploadImage(brandData.sourceProfile, 'profiles');
                    profilePhotoUrl = brandData.sourceProfile; // Use directly for speed vs Unsplash
                }
            }

            // 3. Update or Create Profile
            let brandProfile;
            if (existingProfile) {
                existingProfile.coverPhoto = coverPhotoUrl;
                existingProfile.profilePhoto = profilePhotoUrl;
                existingProfile.bio = brandData.bio;
                existingProfile.stats = brandData.stats;
                existingProfile.socialLinks = brandData.socialLinks || {}; // Update social links
                existingProfile.members = brandData.members || []; // Update members
                brandProfile = await existingProfile.save();
                console.log(`  Updated Profile`);
            } else {
                brandProfile = await BrandProfile.create({
                    user: user._id,
                    name: brandData.name,
                    type: brandData.type,
                    bio: brandData.bio,
                    stats: brandData.stats,
                    coverPhoto: coverPhotoUrl,
                    profilePhoto: profilePhotoUrl,
                    socialLinks: brandData.socialLinks || {},
                    members: brandData.members || [],
                    status: 'approved',
                    isActive: true
                });
                console.log(`  Created Profile`);
            }

            // 4. Create Posts
            if (brandData.posts && brandData.posts.length > 0) {
                console.log(`  Seeding posts...`);
                // Clear existing posts for cleanliness (optional, but good for seeding)
                await Post.deleteMany({ brand: brandProfile._id });

                for (const postData of brandData.posts) {
                    await Post.create({
                        brand: brandProfile._id,
                        content: postData.content,
                        images: postData.image ? [postData.image] : [],
                        likes: [], // Empty initial likes
                        comments: []
                    });
                }
                console.log(`  Created ${brandData.posts.length} posts`);
            }
        }

        console.log('Seeding complete');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
