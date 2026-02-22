require('dotenv').config();
const mongoose = require('mongoose');
const dashboardService = require('./services/dashboardService');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('./models/User');
    const user = await User.findOne({ email: 'testuser@fira.com' });
    
    console.log("Requesting getOverviewStats for:", user.email);
    const stats = await dashboardService.getOverviewStats(user._id);
    
    console.log("Events Attending:", stats.stats.eventsAttending);
    console.log("upcomingEventsAttending length:", stats.upcomingEventsAttending.length);
    console.log("First upcoming event:", stats.upcomingEventsAttending[0] ? stats.upcomingEventsAttending[0].event.name : 'N/A');
    
    process.exit(0);
}
test();
