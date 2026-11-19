// check-messages.js
require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('./models/Message');  // Import your Message model

async function checkMessages() {
  try {
    console.log('🔍 Checking MongoDB messages...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Count total messages
    const count = await Message.countDocuments();
    console.log(`\n📊 Total messages in database: ${count}`);
    
    if (count > 0) {
      // Get last 5 messages
      const messages = await Message.find()
        .sort({ timestamp: -1 })  // Newest first
        .limit(5)
        .lean();
      
      console.log('\n📝 Last 5 messages:');
      console.log('='.repeat(50));
      
      messages.forEach((msg, index) => {
        console.log(`\n${index + 1}. [${new Date(msg.timestamp).toLocaleString()}]`);
        console.log(`   User: ${msg.user.substring(0, 15)}...`);
        console.log(`   Room: ${msg.room}`);
        console.log(`   Message: "${msg.text}"`);
        console.log(`   ID: ${msg._id}`);
      });
      
      console.log('\n' + '='.repeat(50));
      
      // Show room distribution
      const rooms = await Message.aggregate([
        { $group: { _id: "$room", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      console.log('\n🏠 Messages by room:');
      rooms.forEach(room => {
        console.log(`   ${room._id}: ${room.count} messages`);
      });
    } else {
      console.log('\n📭 No messages found in database yet.');
      console.log('💡 Send some messages in your chat to see them here!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the function
checkMessages();