// add-progression-field.js
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function addProgressionField() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        // Update all users to add progression field if it doesn't exist
        const result = await User.updateMany(
            { progression: { $exists: false } },
            {
                $set: {
                    progression: {
                        hasCompletedFirstChat: false,
                        hasUnlockedHourChat: false,
                        hasCompletedHourChat: false,
                        hasUnlockedExplore: false
                    },
                    persistentChats: []
                }
            }
        );
        
        console.log(`✅ Updated ${result.modifiedCount} users with progression field`);
        
        // Verify the field was added
        const sampleUser = await User.findOne({});
        console.log('Sample user progression:', sampleUser.progression);
        
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

addProgressionField();