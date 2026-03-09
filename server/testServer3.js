require('dotenv').config();
const mongoose = require('mongoose');
const Ticket = require('./models/Ticket');
const User = require('./models/User');
const Event = require('./models/Event');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: 'testuser@fira.com' });
    
    // User's tickets
    const userTickets = await Ticket.find({ user: user._id })
        .populate({
            path: 'event',
            select: 'name date startTime endTime status',
        }).lean();

    console.log("userTickets:", JSON.stringify(userTickets, null, 2));
    
    const now = new Date();
    console.log("Now:", now);

    const activeTickets = userTickets.filter(t => t.status === 'active');
    console.log("activeTickets count:", activeTickets.length);
    
    const upcomingTickets = activeTickets.filter(t =>
        t.event && new Date(t.event.date) >= now
    );
    console.log("upcomingTickets count:", upcomingTickets.length);
    
    process.exit(0);
}
test();
