
require('dotenv').config();
const mongoose = require('mongoose');

console.log('URI:', process.env.MONGODB_URI);

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected successfully!');
        await mongoose.disconnect();
    } catch (error) {
        console.error('Connection failed:', error);
    }
}

check();
