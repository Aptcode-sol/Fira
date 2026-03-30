const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/Users/VARSHITHA/Desktop/Aptcode/Firaa/server/.env' });
const Event = require('c:/Users/VARSHITHA/Desktop/Aptcode/Firaa/server/models/Event.js');

async function checkEvents() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const allEvents = await Event.find({});
        console.log(`Total events in DB: ${allEvents.length}`);

        if (allEvents.length === 0) {
            console.log('No events exist at all.');
        } else {
            console.log('\n--- Checking why events are invisible on Home ---');
            
            // Check status
            const approvedEvents = allEvents.filter(e => e.status === 'approved');
            console.log(`Approved events: ${approvedEvents.length}`);

            // Check if active
            const activeEvents = approvedEvents.filter(e => e.isActive !== false);
            console.log(`Active (not deleted) approved events: ${activeEvents.length}`);

            // Check if in future
            const now = new Date();
            const futureEvents = activeEvents.filter(e => new Date(e.startDateTime) >= now);
            console.log(`Future, active, approved events: ${futureEvents.length}`);

            // Print first 2 faulty events for debugging
            const invisible = allEvents.filter(e => e.status !== 'approved' || e.isActive === false || new Date(e.startDateTime) < now);
            console.log('\nSample invisible events:');
            invisible.slice(0, 2).forEach(e => {
                console.log(`- '${e.name}' | status: ${e.status} | active: ${e.isActive} | start: ${e.startDateTime}`);
            });
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkEvents();
