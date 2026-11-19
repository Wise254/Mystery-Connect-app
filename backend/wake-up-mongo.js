const mongoose = require('mongoose');
require('dotenv').config();

console.log('⏰ Waking up MongoDB cluster...');
console.log('This may take 1-2 minutes for the first connection...');
console.log('DO NOT CLOSE THIS WINDOW until it says success!');

const uri = process.env.MONGODB_URI;

async function wakeUp() {
  let connected = false;
  let attempts = 0;
  
  while (!connected && attempts < 20) {
    attempts++;
    console.log(`\n=== Attempt ${attempts}/20 ===`);
    
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000
      });
      
      connected = true;
      console.log('\n🎉🎉🎉 SUCCESS! MongoDB cluster is now awake and ready! 🎉🎉🎉');
      console.log('✅ You can now restart your main server without emergency mode.');
      console.log('✅ The cluster will stay awake for several hours.');
      
      // Keep connection alive for a bit
      setTimeout(() => {
        mongoose.disconnect();
        console.log('\n🔌 Disconnected. Your main server should connect normally now.');
        console.log('💡 You can close this terminal window.');
        process.exit(0);
      }, 10000);
      
    } catch (error) {
      console.log(`❌ Attempt ${attempts} failed: ${error.message}`);
      
      if (attempts < 20) {
        const waitTime = 10;
        console.log(`⏳ Waiting ${waitTime} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    }
  }
  
  if (!connected) {
    console.log('\n❌❌❌ Could not wake cluster after 20 attempts ❌❌❌');
    console.log('💡 Try logging into MongoDB Atlas dashboard at: https://cloud.mongodb.com');
    console.log('💡 Click on your cluster and look for "Resume" button');
    process.exit(1);
  }
}

wakeUp();