require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('./models/Event');
const BrandProfile = require('./models/BrandProfile');

async function fixSeededData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Fix all events: set status to approved and add approval fields
        const eventResult = await Event.updateMany(
            {},
            {
                $set: {
                    status: 'approved',
                    'venueApproval.status': 'approved',
                    'venueApproval.respondedAt': new Date(),
                    'venueApproval.respondedBy': 'system',
                    'adminApproval.status': 'approved',
                    'adminApproval.respondedAt': new Date(),
                    'adminApproval.respondedBy': 'system'
                }
            }
        );
        console.log('✅ Updated events:', eventResult.modifiedCount);

        // Check brands
        const brands = await BrandProfile.find({}).select('name user');
        console.log('✅ Brands found:', brands.length);
        brands.forEach(b => console.log('  -', b.name));

        // Fix all brands: set status to approved and isActive to true
        const brandResult = await BrandProfile.updateMany(
            {},
            { $set: { status: 'approved', isActive: true } }
        );
        console.log('✅ Updated brands:', brandResult.modifiedCount);

        // Verify brands
        const updatedBrands = await BrandProfile.find({}).select('name status isActive');
        console.log('✅ Brands after update:');
        updatedBrands.forEach(b => console.log('  -', b.name, '| status:', b.status, '| isActive:', b.isActive));

        // Verify events are now approved
        const events = await Event.find({}).select('name status startDateTime');
        console.log('✅ Events after update:');
        events.forEach(e => console.log('  -', e.name, '| status:', e.status, '| date:', e.startDateTime?.toISOString?.() || 'N/A'));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixSeededData();
