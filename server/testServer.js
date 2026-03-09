require('dotenv').config();
const mongoose = require('mongoose');
const dashboardService = require('./services/dashboardService');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('./models/User');
    const user = await User.findOne({ email: 'testuser@fira.com' });
    
    // Test the logic directly inside the method context:
    const Ticket = require('./models/Ticket');
    const userTickets = await Ticket.find({ user: user._id })
        .populate({
            path: 'event',
            select: 'name date startTime endTime status',
        }).lean();

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    console.log("Local now:", now);
    console.log("Local now UTC:", now.toISOString());
    console.log("t.event.date:", userTickets[0].event.date);
    console.log("t.event.date obj:", new Date(userTickets[0].event.date));
    console.log("new Date(t.event.date) >= now:", new Date(userTickets[0].event.date) >= now);
    
    process.exit(0);
}
test();
