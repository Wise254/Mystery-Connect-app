// test-mongo.js
require('dotenv').config();
const mongoose = require('mongoose');

console.log('🔍 Testing MongoDB Connection...');
console.log('Connection string found:', !!process.env.MONGODB_URI);

if (!process.env.MONGODB_URI) {
  console.log('❌ ERROR: No MONGODB_URI in .env file');
  process.exit(1);
}

// Show connection string (with password hidden)
const uri = process.env.MONGODB_URI;
const hiddenUri = uri.replace(/:(.*)@/, ':****@');
console.log('Connecting to:', hiddenUri);

// Try to connect
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('\n✅ SUCCESS! MongoDB Connected!');
    console.log(`Database: ${mongoose.connection.name}`);
    console.log(`Host: ${mongoose.connection.host}`);
    console.log(`Port: ${mongoose.connection.port}`);
    console.log(`Ready State: ${mongoose.connection.readyState} (1 = connected)`);
    
    // List collections to verify
    return mongoose.connection.db.listCollections().toArray();
  })
  .then(collections => {
    console.log('\n📁 Collections in database:');
    if (collections.length === 0) {
      console.log('No collections yet (this is normal)');
    } else {
      collections.forEach(col => console.log(`- ${col.name}`));
    }
    process.exit(0);
  })
  .catch(error => {
    console.log('\n❌ CONNECTION FAILED!');
    console.log('Error:', error.message);
    
    // Common error solutions
    console.log('\n🔧 Possible Solutions:');
    console.log('1. Wrong password - Check your .env file');
    console.log('2. IP not whitelisted - Go to MongoDB Atlas → Network Access');
    console.log('3. Cluster not ready - Wait 5 minutes after creation');
    console.log('4. Internet connection - Check your network');
    
    process.exit(1);
  });