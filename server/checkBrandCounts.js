
const mongoose = require('mongoose');
const BrandProfile = require('./models/BrandProfile');
require('dotenv').config();

async function checkCounts() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const counts = await BrandProfile.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);
        console.log('Brand Counts by Type:', counts);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkCounts();
