console.log('🚀 Starting Chat Server...');

// ============================================
// ENHANCED CHAT SERVER
// ============================================

// 1. Load environment variables FIRST
require('dotenv').config();

// 2. Import required packages
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Message = require('./models/Message');
const authRoutes = require('./routes/auth');
const User = require('./models/user');
const PersistentChat = require('./models/PersistentChat');

// ========== QUICK CHAT VARIABLES ==========
const activeChats = new Map(); // Active quick chats
const waitingQueue = new Map(); // Users waiting for quick chat
// ========== END QUICK CHAT VARIABLES ==========

// ========== DEEP CHAT VARIABLES ==========
const activeDeepChats = new Map(); // Active deep chats
const deepChatQueue = new Map();  // Users waiting for deep chat
// ========== END DEEP CHAT VARIABLES ==========

// ✨ ADDED: Conversation hints for deep chat
const conversationHints = [
    { hint: "💭 Try asking: 'What's something you're passionate about that surprises people?'", category: 'deep' },
    { hint: "🌟 Curiosity starter: 'If you could master any skill overnight, what would it be?'", category: 'fun' },
    { hint: "🌊 Deep dive: 'What's a belief you held strongly that you've completely changed your mind about?'", category: 'deep' },
    { hint: "🎭 Light moment: 'What's the most ridiculous thing you've ever convinced someone of?'", category: 'funny' },
    { hint: "📚 Thoughtful: 'What book, movie, or song has had the biggest impact on how you see the world?'", category: 'deep' },
    { hint: "🌍 Perspective: 'If you could live in any time period, past or future, which would you choose?'", category: 'deep' },
    { hint: "😄 Icebreaker: 'What's your go-to karaoke song or guilty pleasure music?'", category: 'fun' },
    { hint: "🤔 Philosophical: 'Do you think people can truly change, or do we just become more ourselves?'", category: 'deep' }
];

// ✨ ADDED: Track last message time for silence detection
const deepChatLastMessageTime = new Map();
// ========== END ADDED ==========

// 2.5 Add DNS fallback to prevent ETIMEOUT
const dns = require('dns');
dns.setServers([
  '8.8.8.8', // Google DNS
  '8.8.4.4', // Google DNS secondary
  '1.1.1.1'  // Cloudflare DNS
]);
console.log('🌐 DNS servers configured for MongoDB connections');

// ========== MONGODB CONNECTION MANAGER ==========
class MongoDBConnectionManager {
    constructor() {
        this.isWakingUp = false;
        this.isConnected = false;
        this.wakeUpAttempts = 0;
        this.maxWakeUpAttempts = 20;
        this.connectionPromise = null;
    }

    async connectWithWakeUp() {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = this._attemptConnection();
        return this.connectionPromise;
    }

    async _attemptConnection() {
        console.log('🔄 MongoDB Connection Manager Started');
        console.log('⏰ Checking MongoDB Atlas cluster status...');
        
        if (!process.env.MONGODB_URI) {
            console.log('❌ ERROR: MONGODB_URI not found in .env file');
            return false;
        }

        const quickResult = await this._tryConnect(5000);
        if (quickResult) {
            this.isConnected = true;
            return true;
        }

        console.log('\n⚠️  MongoDB cluster might be sleeping. Starting wake-up sequence...');
        console.log('⏱️  This may take 1-2 minutes. Server will continue running.\n');
        
        this.isWakingUp = true;
        
        for (let attempt = 1; attempt <= this.maxWakeUpAttempts; attempt++) {
            console.log(`\n=== Wake-up Attempt ${attempt}/${this.maxWakeUpAttempts} ===`);
            
            const result = await this._tryConnect(30000);
            
            if (result) {
                console.log('\n🎉🎉🎉 SUCCESS! MongoDB cluster is now awake! 🎉🎉🎉');
                console.log('✅ Full database functionality enabled.');
                this.isWakingUp = false;
                this.isConnected = true;
                return true;
            }
            
            if (attempt < this.maxWakeUpAttempts) {
                const waitTime = 10;
                console.log(`⏳ Waiting ${waitTime} seconds before next attempt...`);
                console.log('   (Server continues running, chat works without DB)');
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            }
        }

        console.log('\n❌ Could not wake MongoDB cluster after multiple attempts.');
        console.log('💡 Troubleshooting:');
        console.log('   1. Visit https://cloud.mongodb.com and check your cluster');
        console.log('   2. Look for "Resume" button if cluster is paused');
        console.log('   3. Check Network Access IP whitelist');
        console.log('   4. Verify your connection string in .env file');
        console.log('\n⚠️  Running WITHOUT database - chat works, but messages not saved\n');
        
        this.isWakingUp = false;
        return false;
    }

    async _tryConnect(timeout) {
        try {
            const options = {
                serverSelectionTimeoutMS: timeout,
                connectTimeoutMS: timeout,
                socketTimeoutMS: 45000,
                family: 4,
                maxPoolSize: 100,
                minPoolSize: 0,
                maxIdleTimeMS: 0,
                waitQueueTimeoutMS: 0,
                retryWrites: true,
                retryReads: true,
                w: 'majority'
            };
            
            if (process.env.MONGODB_URI.includes('replicaSet')) {
                options.replicaSet = 'rs0';
            }
            
            await mongoose.connect(process.env.MONGODB_URI, options);
            
            console.log('=========================================');
            console.log('✅ MongoDB Atlas Connected Successfully!');
            console.log(`📊 Database: ${mongoose.connection.name || 'Unknown'}`);
            console.log(`🛠️  Host: ${mongoose.connection.host || 'Unknown'}`);
            console.log(`⏱️  Connection Time: ${timeout}ms timeout used`);
            console.log('=========================================');
            
            return true;
        } catch (error) {
            if (error.message.includes('ETIMEOUT') || error.name === 'MongoNetworkError') {
                console.log(`⏰ Cluster sleeping or network issue: ${error.message.substring(0, 100)}`);
            } else {
                console.log(`❌ Connection error: ${error.message.substring(0, 100)}`);
            }
            return false;
        }
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            isWakingUp: this.isWakingUp,
            readyState: mongoose.connection.readyState,
            wakeUpAttempts: this.wakeUpAttempts
        };
    }
}

const dbManager = new MongoDBConnectionManager();
// ========== END MONGODB CONNECTION MANAGER ==========

// 3. Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'mystery-chat-secret-key-change-in-production';
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 4. Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// 5. Configure Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// 6. Custom sanitization function
const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  next();
};

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return;
  
  const keys = Object.keys(obj);
  for (let key of keys) {
    if (key.startsWith('$')) {
      delete obj[key];
      continue;
    }
    
    const value = obj[key];
    if (value && typeof value === 'object') {
      sanitizeObject(value);
    } else if (typeof value === 'string') {
      obj[key] = value.replace(/[$<>{}]/g, '');
    }
  }
}

// 7. Security middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
}));

app.use(sanitizeInput);
app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
  const forwarded = req.headers['x-forwarded-for'];
  req.realIp = forwarded 
    ? forwarded.split(',')[0].trim() 
    : req.ip || req.connection.remoteAddress;
  
  if (process.env.NODE_ENV === 'development') {
    req.ip = `${req.realIp}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  } else {
    req.ip = req.realIp;
  }
  
  next();
});

console.log('🔓 RATE LIMITING: DISABLED (will add back for production)');

app.use((req, res, next) => {
  next();
});

// ==================== AUTHENTICATION MIDDLEWARE ====================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
      return res.status(401).json({ 
          error: 'Access denied. No token provided.' 
      });
  }
  
  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
  } catch (error) {
      console.error('JWT verification error:', error.message);
      
      if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ 
              error: 'Token expired. Please login again.' 
          });
      }
      
      return res.status(403).json({ 
          error: 'Invalid token. Access denied.' 
      });
  }
}

// ==================== HELPER FUNCTIONS ====================
function getSocketByUserId(userId) {
  if (!userId) {
    console.log('❌ No userId provided to getSocketByUserId');
    return null;
  }
  
  for (const [socketId, socket] of io.sockets.sockets) {
    if (socket.userId && socket.userId.toString() === userId.toString()) {
      console.log(`✅ Found socket for user ${userId}: ${socketId}`);
      return socket;
    }
  }
  
  console.log(`❌ No socket found for user ${userId}`);
  return null;
}

// ========== QUICK CHAT FUNCTIONS ==========
function findMatch(userId, socket) {
  console.log(`🔍 Finding match for user: ${userId}`);
  
  if (activeChats.has(userId)) {
      socket.emit('error', { message: 'You are already in a chat!' });
      return;
  }
  
  User.findById(userId).then(user => {
      const userLevel = user?.level || 1;
      
      waitingQueue.set(userId, {
          socket: socket,
          userId: userId,
          username: socket.username,
          level: userLevel,
          joinedAt: Date.now()
      });
      
      console.log(`📊 Queue size: ${waitingQueue.size}`);
      socket.emit('waitingForMatch', {
          message: 'Looking for a chat partner...',
          positionInQueue: waitingQueue.size,
          estimatedWait: Math.min(60, waitingQueue.size * 15)
      });
      
      tryToMatchUsers();
  }).catch(err => {
      console.error('Error finding user:', err);
      waitingQueue.set(userId, {
          socket: socket,
          userId: userId,
          username: socket.username,
          level: 1,
          joinedAt: Date.now()
      });
      tryToMatchUsers();
  });
}

function tryToMatchUsers() {
  if (waitingQueue.size < 2) return;
  
  const queueArray = Array.from(waitingQueue.values());
  
  // 🔧 FIXED: Improved matching - prefer similar levels
  for (let i = 0; i < queueArray.length; i++) {
      for (let j = i + 1; j < queueArray.length; j++) {
          const user1 = queueArray[i];
          const user2 = queueArray[j];
          
          const levelDiff = Math.abs((user1.level || 1) - (user2.level || 1));
          // Match if within 1 level difference
          if (levelDiff <= 1) {
              createMatch(user1, user2);
              return;
          }
      }
  }
  
  // Fallback: match first two in queue
  const user1 = queueArray[0];
  const user2 = queueArray[1];
  createMatch(user1, user2);
}

function createMatch(user1, user2) {
  waitingQueue.delete(user1.userId);
  waitingQueue.delete(user2.userId);
  
  const roomId = `quickchat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const chatEndTime = Date.now() + 300000; // 5 minutes
  
  activeChats.set(user1.userId, {
      partnerId: user2.userId,
      roomId: roomId,
      startedAt: new Date(),
      endsAt: new Date(chatEndTime),
      userMessages: {},
      timer: setTimeout(() => {
          endChat(user1.userId, 'time_up');
      }, 300000)
  });
  
  activeChats.set(user2.userId, {
      partnerId: user1.userId,
      roomId: roomId,
      startedAt: new Date(),
      endsAt: new Date(chatEndTime),
      userMessages: {},
      timer: setTimeout(() => {
          endChat(user2.userId, 'time_up');
      }, 300000)
  });
  
  user1.socket.emit('matchFound', {
      roomId: roomId,
      partnerId: user2.userId,
      startedAt: new Date(),
      endsAt: new Date(chatEndTime),
      timeRemaining: 300
  });
  
  user2.socket.emit('matchFound', {
      roomId: roomId,
      partnerId: user1.userId,
      startedAt: new Date(),
      endsAt: new Date(chatEndTime),
      timeRemaining: 300
  });
  
  user1.socket.join(roomId);
  user2.socket.join(roomId);
  
  console.log(`✅ Match created: ${user1.userId} <-> ${user2.userId} in room ${roomId}`);
}

// 🔧 FIXED: Complete quick chat reward logic
async function handleQuickChatCompletion(userId, partnerId, completed) {
  try {
      const user = await User.findById(userId);
      if (!user) return;
      
      // Check if this is first chat
      if (!user.progression?.hasCompletedFirstChat) {
          // ✨ ADDED: Award points for first chat completion
          const result = await user.unlockStage('firstChat');
          console.log(`🎉 User ${userId} completed first chat! +${result.pointsEarned} points`);
          
          const userSocket = getSocketByUserId(userId);
          if (userSocket) {
              userSocket.emit('firstChatBonus', {
                  message: `🎉 First chat completed! +${result.pointsEarned} points and Deep Chat unlocked!`,
                  pointsEarned: result.pointsEarned,
                  newLevel: result.level
              });
          }
      }
      
      // ✨ ADDED: Track interaction for "previously chatted" badge
      if (completed && partnerId) {
          await user.updateChatStats('quick', 5, partnerId);
      } else {
          await user.updateChatStats('quick', 0);
      }
      
      // 🔧 FIXED: Unlock deep chat after first completion
      if (completed && !user.progression?.hasUnlockedDeepChat) {
          await user.unlockStage('deepChat');
      }
      
  } catch (error) {
      console.error('Error handling quick chat completion:', error);
  }
}

function endChat(userId, reason = 'partner_left') {
  console.log(`🔚 Ending chat for ${userId}, reason: ${reason}`);
  
  const chat = activeChats.get(userId);
  if (!chat) {
      console.log(`No active chat found for ${userId}`);
      return;
  }
  
  const partnerId = chat.partnerId;
  const duration = Date.now() - new Date(chat.startedAt).getTime();
  const completed = reason === 'time_up';
  
  if (chat.timer) {
      clearTimeout(chat.timer);
  }
  
  // ✨ ADDED: Handle rewards for completed chats
  if (completed) {
      handleQuickChatCompletion(userId, partnerId, true);
  } else {
      handleQuickChatCompletion(userId, partnerId, false);
  }
  
  const userSocket = getSocketByUserId(userId);
  if (userSocket && userSocket.connected) {
      userSocket.emit('chatEnded', {
          reason: reason,
          duration: duration,
          completed: completed,
          message: reason === 'time_up' ? 'Time is up! Chat ended.' : 'You left the chat.'
      });
      userSocket.leave(chat.roomId);
  }
  
  if (partnerId) {
      const partnerChat = activeChats.get(partnerId);
      if (partnerChat && partnerChat.timer) {
          clearTimeout(partnerChat.timer);
      }
      
      // ✨ ADDED: Handle partner rewards
      if (completed) {
          handleQuickChatCompletion(partnerId, userId, true);
      }
      
      const partnerSocket = getSocketByUserId(partnerId);
      if (partnerSocket && partnerSocket.connected) {
          const partnerReason = reason === 'you_left' ? 'partner_left' : 
                               reason === 'time_up' ? 'time_up' : reason;
          partnerSocket.emit('chatEnded', {
              reason: partnerReason,
              duration: duration,
              completed: completed,
              message: reason === 'time_up' ? 'Time is up! Chat ended.' : 'Your partner left the chat.'
          });
          partnerSocket.leave(chat.roomId);
      }
      
      activeChats.delete(partnerId);
  }
  
  activeChats.delete(userId);
  console.log(`✅ Chat ended for ${userId}`);
}

// ========== DEEP CHAT FUNCTIONS ==========
function findDeepMatch(userId, socket) {
    console.log(`🌊 Looking for deep match for user: ${userId}`);
    
    deepChatQueue.set(userId, {
        socket,
        joinedAt: Date.now(),
        userId
    });
    
    for (const [otherUserId, otherData] of deepChatQueue) {
        if (otherUserId !== userId && deepChatQueue.size >= 2) {
            const user1Data = deepChatQueue.get(userId);
            const user2Data = deepChatQueue.get(otherUserId);
            
            deepChatQueue.delete(userId);
            deepChatQueue.delete(otherUserId);
            
            const roomId = `deepchat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            console.log(`🤝 Deep matched ${userId} with ${otherUserId} in room: ${roomId}`);
            
            const chatEndTime = Date.now() + 3600000; // 60 minutes
            
            activeDeepChats.set(userId, {
                partnerId: otherUserId,
                roomId,
                startedAt: new Date(),
                endsAt: new Date(chatEndTime),
                userMessages: {},
                hasReached30Min: false,
                // ✨ ADDED: Track last hint time
                lastHintTime: Date.now(),
                timer: setTimeout(() => {
                    console.log(`⏰ Deep timer expired for ${userId}, ending chat`);
                    endDeepChat(userId, 'time_up');
                }, 3600000)
            });
            
            activeDeepChats.set(otherUserId, {
                partnerId: userId,
                roomId,
                startedAt: new Date(),
                endsAt: new Date(chatEndTime),
                userMessages: {},
                hasReached30Min: false,
                // ✨ ADDED: Track last hint time
                lastHintTime: Date.now(),
                timer: setTimeout(() => {
                    console.log(`⏰ Deep timer expired for ${otherUserId}, ending chat`);
                    endDeepChat(otherUserId, 'time_up');
                }, 3600000)
            });
            
            // ✨ ADDED: Initialize last message time for silence detection
            deepChatLastMessageTime.set(roomId, Date.now());
            
            user1Data.socket.emit('deepMatchFound', {
                roomId,
                partnerId: otherUserId,
                startedAt: new Date(),
                endsAt: new Date(chatEndTime),
                timeRemaining: 3600
            });
            
            user2Data.socket.emit('deepMatchFound', {
                roomId,
                partnerId: userId,
                startedAt: new Date(),
                endsAt: new Date(chatEndTime),
                timeRemaining: 3600
            });
            
            user1Data.socket.join(roomId);
            user2Data.socket.join(roomId);
            
            return;
        }
    }
    
    socket.emit('deepWaitingForMatch', {
        message: 'Looking for a deep conversation partner...',
        positionInQueue: deepChatQueue.size,
        estimatedWait: Math.max(30, deepChatQueue.size * 15)
    });
    
    console.log(`⏳ User ${userId} added to deep queue. Queue size: ${deepChatQueue.size}`);
}

// ✨ ADDED: Function to send conversation hints
function sendConversationHint(roomId, socket) {
    const chat = Array.from(activeDeepChats.values()).find(c => c.roomId === roomId);
    if (!chat) return;
    
    const now = Date.now();
    const timeSinceLastHint = now - (chat.lastHintTime || now);
    
    // Only send hint every 2 minutes max
    if (timeSinceLastHint < 120000) return;
    
    // Randomly select a hint
    const randomHint = conversationHints[Math.floor(Math.random() * conversationHints.length)];
    
    socket.emit('conversationHint', {
        hint: randomHint.hint,
        category: randomHint.category
    });
    
    chat.lastHintTime = now;
    
    // Also send to partner
    const partnerId = chat.partnerId;
    const partnerSocket = getSocketByUserId(partnerId);
    if (partnerSocket) {
        partnerSocket.emit('conversationHint', {
            hint: randomHint.hint,
            category: randomHint.category
        });
    }
}

// ✨ ADDED: Check for silence and send hint
function checkSilenceAndSendHint(roomId, userId) {
    const lastMessageTime = deepChatLastMessageTime.get(roomId);
    if (!lastMessageTime) return;
    
    const now = Date.now();
    const silenceDuration = now - lastMessageTime;
    
    // If silence for more than 90 seconds, send a hint
    if (silenceDuration > 90000) {
        const chat = activeDeepChats.get(userId);
        if (chat) {
            const socket = getSocketByUserId(userId);
            if (socket) {
                const randomHint = conversationHints[Math.floor(Math.random() * conversationHints.length)];
                socket.emit('conversationHint', {
                    hint: randomHint.hint,
                    category: randomHint.category,
                    reason: 'silence'
                });
                chat.lastHintTime = now;
            }
        }
    }
}

async function endDeepChat(userId, reason = 'time_up') {
  console.log(`🌊 Ending deep chat for ${userId}, reason: ${reason}`);
  
  const chat = activeDeepChats.get(userId);
  if (!chat) {
      console.log('❌ No active deep chat found for user:', userId);
      return;
  }
  
  const partnerId = chat.partnerId;
  const hasReached30Min = chat.hasReached30Min || false;
  const duration = Date.now() - new Date(chat.startedAt).getTime();
  const durationMinutes = Math.floor(duration / 60000);
  const completed = reason === 'time_up' || (hasReached30Min && reason === 'partner_left');
  
  if (chat.timer) {
      clearTimeout(chat.timer);
  }
  
  // ✨ ADDED: Clean up last message time tracking
  deepChatLastMessageTime.delete(chat.roomId);
  
  const userSocket = getSocketByUserId(userId);
  
  // 🔧 FIXED: Proper unlock logic with correct stage names
  const shouldRewardUser = hasReached30Min || (partnerId && activeDeepChats.get(partnerId)?.hasReached30Min);
  
  if (shouldRewardUser) {
      try {
          const user = await User.findById(userId);
          if (user) {
              // Update stats with partner ID for "previously interacted" badge
              await user.updateChatStats('deep', durationMinutes, partnerId);
              
              // 🔧 FIXED: Use correct stage name 'explore' not 'hourChat'
              if (!user.progression?.hasUnlockedExplore) {
                  const result = await user.unlockStage('explore');
                  console.log(`🎉 User ${userId} unlocked Explore page! +${result.pointsEarned} points`);
                  
                  if (userSocket) {
                      userSocket.emit('exploreUnlocked', {
                          message: `🎉 Congratulations! You've unlocked the Explore page! +${result.pointsEarned} points!`,
                          pointsEarned: result.pointsEarned,
                          newLevel: result.level,
                          redirectUrl: '/explore.html'
                      });
                  }
              }
          }
      } catch (error) {
          console.error('Error awarding deep chat rewards:', error);
      }
  } else {
      // Still update stats but no explore unlock
      try {
          const user = await User.findById(userId);
          if (user) {
              await user.updateChatStats('deep', durationMinutes);
          }
      } catch (error) {
          console.error('Error updating stats:', error);
      }
  }
  
  if (userSocket) {
      userSocket.emit('deepChatEnded', {
          reason: reason,
          reached30Min: hasReached30Min,
          completed: completed,
          duration: duration,
          durationMinutes: durationMinutes,
          unlockedExplore: shouldRewardUser,
          message: completed ? 'Deep Dive completed!' : 'Chat ended.'
      });
      userSocket.leave(chat.roomId);
  }
  
  if (partnerId) {
      const partnerChat = activeDeepChats.get(partnerId);
      if (partnerChat && partnerChat.timer) {
          clearTimeout(partnerChat.timer);
      }
      
      const partnerSocket = getSocketByUserId(partnerId);
      const partnerHasReached30Min = partnerChat?.hasReached30Min || false;
      
      if (partnerSocket) {
          const partnerShouldReward = partnerHasReached30Min || hasReached30Min;
          const partnerCompleted = reason === 'time_up' || (partnerHasReached30Min && reason === 'you_left');
          
          // Update partner stats
          try {
              const partner = await User.findById(partnerId);
              if (partner) {
                  await partner.updateChatStats('deep', durationMinutes, userId);
                  
                  // 🔧 FIXED: Use correct stage name
                  if (partnerShouldReward && !partner.progression?.hasUnlockedExplore) {
                      await partner.unlockStage('explore');
                      console.log(`🎉 Partner ${partnerId} unlocked Explore page!`);
                  }
              }
          } catch (error) {
              console.error('Error awarding partner deep chat rewards:', error);
          }
          
          partnerSocket.emit('deepChatEnded', {
              reason: reason === 'you_left' ? 'partner_left' : reason,
              reached30Min: partnerHasReached30Min,
              completed: partnerCompleted,
              duration: duration,
              durationMinutes: durationMinutes,
              unlockedExplore: partnerShouldReward,
              message: partnerCompleted ? 'Deep Dive completed!' : 'Chat ended.'
          });
          partnerSocket.leave(chat.roomId);
      }
      
      activeDeepChats.delete(partnerId);
  }
  
  activeDeepChats.delete(userId);
  console.log(`✅ Deep chat cleanup completed for ${userId}`);
}

// ========== GLOBAL VARIABLES ==========
const activeRooms = new Set(['general']);
const userSockets = new Map();

// ========== API ROUTES ==========
app.use('/api/auth', authRoutes);
app.use(express.static('../frontend'));

app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const managerStatus = dbManager.getStatus();
  
  res.json({
    success: true,
    message: 'Server is working! 🚀',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: dbStatus[dbState] || 'unknown',
      readyState: dbState,
      host: mongoose.connection.host || 'N/A',
      name: mongoose.connection.name || 'N/A',
      isConnected: managerStatus.isConnected,
      isWakingUp: managerStatus.isWakingUp
    },
    environment: NODE_ENV,
    version: '2.0.0'
  });
});

app.get('/api/stats', async (req, res) => {
  try {
    const totalMessages = await Message.countDocuments();
    const activeRooms = await Message.distinct('room').then(rooms => rooms.length);
    
    res.json({
      success: true,
      onlineUsers: io.engine.clientsCount,
      totalMessages,
      activeRooms,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      success: true,
      onlineUsers: io.engine.clientsCount,
      totalMessages: 0,
      activeRooms: 0,
      serverTime: new Date().toISOString(),
      message: 'Database not available, showing basic stats only'
    });
  }
});

// 🔧 FIXED: Proper progression endpoint
app.get('/api/user/progression', authenticateToken, async (req, res) => {
  try {
      const user = await User.findById(req.user.userId).select('progression points stats level');
      
      if (!user) {
          return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      res.json({
          success: true,
          progression: user.progression,
          points: user.points,
          level: user.level,
          stats: user.stats,
          // 🔧 FIXED: Return flat booleans for easy frontend checking
          hasCompletedFirstChat: user.progression?.hasCompletedFirstChat || false,
          hasUnlockedDeepChat: user.progression?.hasUnlockedDeepChat || false,
          hasUnlockedHourChat: user.progression?.hasUnlockedHourChat || false,
          hasCompletedHourChat: user.progression?.hasCompletedHourChat || false,
          hasUnlockedExplore: user.progression?.hasUnlockedExplore || false
      });
  } catch (error) {
      console.error('Progression fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch progression' });
  }
});

// ✨ ADDED: User stats endpoint
app.get('/api/user/stats', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select('username avatar level points stats progression profile lastActive isOnline');
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Calculate achievements count
        let achievements = 0;
        if (user.stats.totalChats >= 1) achievements++;
        if (user.stats.totalChats >= 10) achievements++;
        if (user.stats.totalTimeSpent >= 60) achievements++;
        if (user.progression?.hasCompletedFirstChat) achievements++;
        if (user.progression?.hasUnlockedExplore) achievements++;
        
        // Determine chat personality based on stats
        let chatPersonality = 'Emerging Chatter';
        if (user.stats.totalTimeSpent > 300) chatPersonality = 'Deep Conversationalist';
        else if (user.stats.totalChats > 20) chatPersonality = 'Social Butterfly';
        else if (user.stats.quickChats > user.stats.deepChats) chatPersonality = 'Quick Connector';
        
        // Determine favorite time
        let favoriteChatTime = 'Evening';
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) favoriteChatTime = 'Morning';
        else if (hour >= 12 && hour < 17) favoriteChatTime = 'Afternoon';
        else if (hour >= 17 && hour < 22) favoriteChatTime = 'Evening';
        else favoriteChatTime = 'Night';
        
        res.json({
            success: true,
            stats: {
                totalChats: user.stats?.totalChats || 0,
                quickChats: user.stats?.quickChats || 0,
                deepChats: user.stats?.deepChats || 0,
                totalMessages: user.stats?.totalMessagesSent || 0,
                totalMinutesChatted: user.stats?.totalTimeSpent || 0,
                sparksGiven: user.stats?.sparksGiven || 0,
                achievements: achievements,
                currentStreak: 0,
                favoriteChatTime: favoriteChatTime,
                mostActiveDay: 'Weekends',
                chatPersonality: chatPersonality,
                points: user.points || 0,
                level: user.level || 1,
                avatar: user.avatar || '🦊'
            }
        });
    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
});

app.post('/api/explore/start-chat', authenticateToken, async (req, res) => {
  try {
      const { partnerId } = req.body;
      const currentUserId = req.user.userId;
      
      if (partnerId === currentUserId) {
          return res.status(400).json({ error: 'Cannot chat with yourself' });
      }
      
      const partner = await User.findOne({
          _id: partnerId,
          'progression.hasUnlockedExplore': true
      });
      
      if (!partner) {
          return res.status(404).json({ error: 'Partner not found or not eligible' });
      }
      
      // 🔧 FIXED: Use consistent PersistentChat model
      let chat = await PersistentChat.findOne({
          participants: { $all: [currentUserId, partnerId] }
      });
      
      if (chat) {
          // ✨ ADDED: Check if they've interacted before
          const currentUser = await User.findById(currentUserId);
          const hasInteractedBefore = currentUser?.hasInteractedWith(partnerId) || false;
          
          return res.json({
              chatId: chat._id,
              exists: true,
              hasInteractedBefore
          });
      }
      
      // Create new persistent chat
      chat = new PersistentChat({
          participants: [currentUserId, partnerId],
          messageCounts: new Map([
              [currentUserId, 0],
              [partnerId, 0]
          ]),
          revealLevels: new Map([
              [currentUserId, 0],
              [partnerId, 0]
          ]),
          createdAt: new Date()
      });
      
      await chat.save();
      
      // ✨ ADDED: Check for previous interaction
      const currentUser = await User.findById(currentUserId);
      const hasInteractedBefore = currentUser?.hasInteractedWith(partnerId) || false;
      
      res.json({
          chatId: chat._id,
          exists: false,
          hasInteractedBefore,
          partner: {
              _id: partner._id,
              username: partner.username,
              avatar: partner.avatar
          }
      });
      
  } catch (error) {
      console.error('Start chat error:', error);
      res.status(500).json({ error: 'Failed to start chat' });
  }
});

// ✨ ADDED: Include previously interacted flag in explore partners
app.get('/api/explore/partners', authenticateToken, async (req, res) => {
  try {
      const currentUserId = req.user.userId;
      const currentUser = await User.findById(currentUserId);
      
      const eligibleUsers = await User.find({
          _id: { $ne: currentUserId },
          'progression.hasUnlockedExplore': true
      }).select('username avatar gender location country bio interests lastActive isOnline');
      
      const existingChats = await PersistentChat.find({
          participants: currentUserId
      });
      
      const existingPartnerIds = existingChats.map(chat => 
          chat.participants.find(p => p.toString() !== currentUserId).toString()
      );
      
      // ✨ ADDED: Mark users who have previously interacted
      const availablePartners = eligibleUsers
          .filter(user => !existingPartnerIds.includes(user._id.toString()))
          .map(user => {
              const userObj = user.toObject();
              userObj.hasInteractedBefore = currentUser?.hasInteractedWith(user._id) || false;
              return userObj;
          });
      
      res.json({
          partners: availablePartners,
          count: availablePartners.length
      });
      
  } catch (error) {
      console.error('Explore partners error:', error);
      res.status(500).json({ error: 'Failed to fetch partners' });
  }
});
app.get('/api/persistent-chat/:chatId', authenticateToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.userId;
        
        const chat = await PersistentChat.findOne({
            _id: chatId,
            participants: userId
        });
        
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        
        const partnerId = chat.participants.find(p => p.toString() !== userId);
        const partner = await User.findById(partnerId).select('username avatar gender location country bio interests realName');
        
        // ✨ ADDED: Check if they've interacted before
        const currentUser = await User.findById(userId);
        const hasInteractedBefore = currentUser?.hasInteractedWith(partnerId) || false;
        
        const messages = await Message.find({ chatId: chatId })
            .sort({ createdAt: 1 })
            .limit(100);
        
        await Message.updateMany(
            { 
                chatId: chatId,
                recipient: userId,
                read: false
            },
            { read: true }
        );
        
        const messageCount = chat.messageCounts?.get(userId) || 0;
        const revealedPartner = {
            _id: partner._id,
            username: partner.username,
            hasInteractedBefore  // ✨ ADDED
        };
        
        // Progressive reveal based on message count
        if (messageCount >= 5) revealedPartner.gender = partner.gender;
        if (messageCount >= 10) {
            revealedPartner.location = partner.location;
            revealedPartner.country = partner.country;
        }
        if (messageCount >= 20) revealedPartner.avatar = partner.avatar;
        if (messageCount >= 30) {
            revealedPartner.bio = partner.bio;
            revealedPartner.interests = partner.interests;
            revealedPartner.realName = partner.realName;  // ✨ ADDED: Full reveal includes real name
        }
        
        res.json({
            chatId: chat._id,
            partner: revealedPartner,
            messages: messages,
            messageCount: messageCount,
            revealLevel: chat.revealLevels?.get(userId) || 0,
            hasInteractedBefore  // ✨ ADDED
        });
        
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ error: 'Failed to fetch chat' });
    }
  });
  
  app.get('/api/persistent-chats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const currentUser = await User.findById(userId);
        
        const chats = await PersistentChat.find({
            participants: userId
        }).sort({ 'lastMessage.timestamp': -1 });
        
        const enrichedChats = await Promise.all(chats.map(async (chat) => {
            const partnerId = chat.participants.find(p => p.toString() !== userId);
            const partner = await User.findById(partnerId).select('username avatar lastActive isOnline');
            
            const unreadCount = await Message.countDocuments({
                chatId: chat._id,
                recipient: userId,
                read: false
            });
            
            // ✨ ADDED: Check if previously interacted
            const hasInteractedBefore = currentUser?.hasInteractedWith(partnerId) || false;
            
            return {
                _id: chat._id,
                partner: partner,
                lastMessage: chat.lastMessage,
                unreadCount: unreadCount,
                messageCount: chat.messageCounts?.get(userId) || 0,
                revealLevel: chat.revealLevels?.get(userId) || 0,
                createdAt: chat.createdAt,
                hasInteractedBefore  // ✨ ADDED
            };
        }));
        
        res.json({ chats: enrichedChats });
        
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
  });
  
  // Landing page - use the inline HTML that doesn't require frontend files
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mystery Connect 🎭</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', system-ui, sans-serif; 
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #f8fafc;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }
          .container {
            max-width: 800px;
            width: 100%;
            padding: 2rem;
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(12px);
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            text-align: center;
          }
          h1 { 
            font-size: 3rem;
            margin: 0 0 1rem 0;
            background: linear-gradient(90deg, #8b5cf6, #ec4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .btn {
            padding: 1rem 2rem;
            font-size: 1.1rem;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            display: inline-block;
            margin: 10px;
            background: linear-gradient(90deg, #8b5cf6, #ec4899);
            color: white;
            border: none;
            cursor: pointer;
          }
          .btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 30px rgba(139, 92, 246, 0.4);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎭 Mystery Connect</h1>
          <p style="margin-bottom: 2rem; color: #cbd5e1;">Where conversations reveal more than profiles</p>
          <div>
            <a href="/auth.html" class="btn">🚪 Enter the Mystery</a>
            <a href="/dashboard.html" class="btn">📊 Dashboard</a>
          </div>
          <div style="margin-top: 2rem;">
            <a href="/api/health" style="color: #8b5cf6;">Server Status</a>
          </div>
        </div>
      </body>
      </html>
    `);
  });
  
  // ========== SOCKET.IO AUTH MIDDLEWARE ==========
  io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
            return next(new Error('Authentication required'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return next(new Error('User not found'));
        }
        
        socket.userId = user._id.toString();
        socket.user = user;
        socket.username = user.username;
        next();
    } catch (error) {
        console.error('Socket auth error:', error.message);
        next(new Error('Authentication failed'));
    }
  });
  
  // ========== SOCKET.IO CONNECTION HANDLER ==========
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const username = socket.username;
    
    console.log(`✅ User connected: ${username} (${userId})`);
    
    // Track user
    userSockets.set(userId, {
        socketId: socket.id,
        username,
        joinedAt: new Date(),
        currentRoom: 'general'
    });
    
    // Welcome message
    socket.emit('welcome', {
        message: `Welcome ${username}!`,
        id: socket.id,
        userId,
        username,
        time: new Date().toISOString(),
        onlineUsers: io.engine.clientsCount
    });
    
    // Broadcast user online
    socket.broadcast.emit('userOnline', {
        userId,
        username,
        onlineUsers: io.engine.clientsCount
    });
    
    // Auto-join general room
    socket.join('general');
    socket.emit('roomJoined', {
        room: 'general',
        message: `You joined general room`
    });
    
    // ========== PING/PONG ==========
    socket.on('ping', (data) => {
        socket.emit('pong', { 
            timestamp: Date.now(),
            received: data 
        });
    });
    
    // ========== QUICK CHAT EVENTS ==========
    socket.on('findQuickChat', () => {
        console.log(`🎯 User ${username} (${userId}) wants a quick chat`);
        
        if (activeChats.has(userId)) {
            const chat = activeChats.get(userId);
            socket.emit('alreadyInChat', {
                message: 'You are already in a chat!',
                partnerId: chat.partnerId,
                timeRemaining: Math.floor((chat.endsAt - Date.now()) / 1000)
            });
            return;
        }
        
        if (waitingQueue.has(userId)) {
            socket.emit('alreadyInQueue', {
                message: 'You are already in the queue',
                position: Array.from(waitingQueue.keys()).indexOf(userId) + 1
            });
            return;
        }
        
        findMatch(userId, socket);
    });
    
    socket.on('leaveQueue', () => {
        if (waitingQueue.has(userId)) {
            waitingQueue.delete(userId);
            socket.emit('leftQueue', {
                message: 'You left the queue'
            });
            console.log(`🚪 User ${username} left the queue`);
        } else {
            socket.emit('error', { message: 'You are not in the queue' });
        }
    });
    
    socket.on('endChatEarly', () => {
        console.log(`👋 User ${username} wants to end chat early`);
        
        if (!activeChats.has(userId)) {
            socket.emit('error', { message: 'You are not in a chat' });
            return;
        }
        
        endChat(userId, 'you_left');
    });
    
    socket.on('quickChatMessage', async (data) => {
        const chat = activeChats.get(userId);
        
        if (!chat) {
            socket.emit('error', { message: 'You are not in a quick chat' });
            return;
        }
        
        if (!data.text || data.text.trim().length === 0) {
            socket.emit('error', { message: 'Message cannot be empty' });
            return;
        }
        
        const messageText = data.text.trim();
        const partnerId = chat.partnerId;
        
        if (!chat.userMessages) {
            chat.userMessages = {};
        }
        chat.userMessages[userId] = (chat.userMessages[userId] || 0) + 1;
        
        // ✨ ADDED: Update user's message count
        try {
            await User.findByIdAndUpdate(userId, { $inc: { 'stats.totalMessagesSent': 1 } });
        } catch (err) {
            console.error('Error updating message count:', err);
        }
        
        const partnerSocket = getSocketByUserId(partnerId);
        if (partnerSocket) {
            partnerSocket.emit('newQuickMessage', {
                userId: userId,
                username: username,
                text: messageText,
                time: new Date().toISOString(),
                isOwn: false
            });
        }
        
        socket.emit('newQuickMessage', {
            userId: userId,
            username: username,
            text: messageText,
            time: new Date().toISOString(),
            isOwn: true
        });
        
        try {
            if (mongoose.connection.readyState === 1) {
                const message = new Message({
                    user: userId,
                    username: username || 'Anonymous',
                    text: messageText,
                    room: chat.roomId,
                    timestamp: new Date(),
                    isQuickChat: true
                });
                await message.save();
            }
        } catch (dbError) {
            console.error('Quick chat database save error:', dbError.message);
        }
    });
    
    // ========== DEEP CHAT EVENTS ==========
    socket.on('findDeepChat', () => {
        if (activeDeepChats.has(userId)) {
            socket.emit('deepAlreadyInChat', {
                message: 'You are already in a Deep Dive!',
                partnerId: activeDeepChats.get(userId).partnerId,
                timeRemaining: activeDeepChats.get(userId).endsAt - Date.now()
            });
            return;
        }
        
        if (deepChatQueue.has(userId)) {
            socket.emit('deepAlreadyInQueue', {
                message: 'You are already in the queue for a Deep Dive',
                position: Array.from(deepChatQueue.keys()).indexOf(userId) + 1
            });
            return;
        }
        
        console.log(`🌊 User ${username} (${userId}) wants a deep chat`);
        findDeepMatch(userId, socket);
    });
    
    socket.on('leaveDeepQueue', () => {
        if (deepChatQueue.has(userId)) {
            deepChatQueue.delete(userId);
            socket.emit('deepLeftQueue', {
                message: 'You left the Deep Dive queue'
            });
            console.log(`🚪 User ${username} left the deep queue`);
        }
    });
    
    socket.on('endDeepChatEarly', () => {
        console.log(`👋 User ${username} wants to end deep chat early`);
        
        if (!activeDeepChats.has(userId)) {
            socket.emit('error', { message: 'You are not in a Deep Dive' });
            return;
        }
        
        endDeepChat(userId, 'you_left');
    });
    
    socket.on('deepChatMessage', async (data) => {
        const chat = activeDeepChats.get(userId);
        
        if (!chat) {
            socket.emit('error', { message: 'You are not in a Deep Dive' });
            return;
        }
        
        if (!data.text || data.text.trim().length === 0) {
            socket.emit('error', { message: 'Message cannot be empty' });
            return;
        }
        
        const messageText = data.text.trim();
        const partnerId = chat.partnerId;
        
        if (!chat.userMessages) {
            chat.userMessages = {};
        }
        chat.userMessages[userId] = (chat.userMessages[userId] || 0) + 1;
        
        // ✨ ADDED: Update last message time for silence detection
        deepChatLastMessageTime.set(chat.roomId, Date.now());
        
        // ✨ ADDED: Update user's message count
        try {
            await User.findByIdAndUpdate(userId, { $inc: { 'stats.totalMessagesSent': 1 } });
        } catch (err) {
            console.error('Error updating message count:', err);
        }
        
        const partnerSocket = getSocketByUserId(partnerId);
        if (partnerSocket) {
            partnerSocket.emit('newDeepMessage', {
                userId,
                username,
                text: messageText,
                time: new Date().toISOString(),
                isOwn: false
            });
        }
        
        socket.emit('newDeepMessage', {
            userId,
            username,
            text: messageText,
            time: new Date().toISOString(),
            isOwn: true
        });
        
        // ✨ ADDED: Check if we should send a hint (every ~5 messages)
        if ((chat.userMessages[userId] + (chat.userMessages[partnerId] || 0)) % 5 === 0) {
            sendConversationHint(chat.roomId, socket);
        }
        
        try {
            if (mongoose.connection.readyState === 1) {
                const message = new Message({
                    user: userId,
                    username: username || 'Anonymous',
                    text: messageText,
                    room: chat.roomId,
                    timestamp: new Date(),
                    isDeepChat: true
                });
                await message.save();
            }
        } catch (dbError) {
            console.error('Deep chat database save error:', dbError.message);
        }
    });
    
    // ✨ ADDED: Request a conversation hint manually
    socket.on('requestHint', () => {
        const chat = activeDeepChats.get(userId);
        if (chat) {
            sendConversationHint(chat.roomId, socket);
        }
    });
    
    socket.on('deepReached30Min', async () => {
        const chat = activeDeepChats.get(userId);
        if (!chat || chat.hasReached30Min) return;
        
        chat.hasReached30Min = true;
        console.log(`🎉 User ${username} reached 30-minute milestone in deep chat!`);
        
        socket.emit('deep30MinMilestone', {
            message: '🎉 You\'ve reached the 30-minute milestone! +100 points!',
            pointsEarned: 100
        });
        
        const partnerSocket = getSocketByUserId(chat.partnerId);
        if (partnerSocket) {
            partnerSocket.emit('deep30MinMilestone', {
                message: '🎉 Your partner reached the 30-minute milestone!'
            });
        }
    });
    
    // ========== TYPING INDICATORS ==========
    socket.on('typing', (data) => {
        const chat = activeChats.get(userId);
        if (chat && chat.partnerId) {
            const partnerSocket = getSocketByUserId(chat.partnerId);
            if (partnerSocket) {
                partnerSocket.emit('userTyping', {
                    userId,
                    username,
                    isTyping: data.isTyping,
                    timestamp: data.timestamp || Date.now()
                });
            }
        }
    });
    
    socket.on('deepTyping', (data) => {
        const chat = activeDeepChats.get(userId);
        if (chat && chat.partnerId) {
            const partnerSocket = getSocketByUserId(chat.partnerId);
            if (partnerSocket) {
                partnerSocket.emit('deepUserTyping', {
                    userId,
                    username,
                    isTyping: data.isTyping,
                    timestamp: data.timestamp || Date.now()
                });
            }
        }
    });
    
    // ========== PERSISTENT CHAT EVENTS ==========
    socket.on('joinPersistentChat', async (data) => {
        try {
            const { chatId } = data;
            
            if (!chatId) {
                socket.emit('error', { message: 'Chat ID required' });
                return;
            }
            
            const chat = await PersistentChat.findOne({
                _id: chatId,
                participants: socket.userId
            });
            
            if (!chat) {
                socket.emit('error', { message: 'Chat not found or unauthorized' });
                return;
            }
            
            socket.join(`persistent:${chatId}`);
            socket.currentChatId = chatId;
            
            await Message.updateMany(
                { 
                    chatId: chatId,
                    sender: { $ne: socket.userId },
                    read: false
                },
                { read: true }
            );
            
            const messages = await Message.find({ chatId: chatId })
                .sort({ createdAt: 1 })
                .limit(100);
                
            const partnerId = chat.participants.find(p => p.toString() !== socket.userId);
            const partner = await User.findById(partnerId).select('username avatar gender location country');
            
            // ✨ ADDED: Check previous interaction
            const currentUser = await User.findById(socket.userId);
            const hasInteractedBefore = currentUser?.hasInteractedWith(partnerId) || false;
            
            socket.emit('chatHistory', {
                chatId: chatId,
                messages: messages,
                partner: partner,
                revealLevel: chat.revealLevels?.get(socket.userId) || 0,
                messageCount: chat.messageCounts?.get(socket.userId) || 0,
                hasInteractedBefore  // ✨ ADDED
            });
            
            socket.to(`persistent:${chatId}`).emit('partnerOnline', {
                userId: socket.userId,
                online: true
            });
            
        } catch (error) {
            console.error('Join persistent chat error:', error);
            socket.emit('error', { message: 'Failed to join chat' });
        }
    });
    
    socket.on('persistentChatMessage', async (data) => {
        try {
            const { chatId, content } = data;
            
            if (!chatId || !content || content.trim() === '') {
                socket.emit('error', { message: 'Invalid message data' });
                return;
            }
            
            const chat = await PersistentChat.findOne({
                _id: chatId,
                participants: socket.userId
            });
            
            if (!chat) {
                socket.emit('error', { message: 'Not authorized' });
                return;
            }
            
            const partnerId = chat.participants.find(p => p.toString() !== socket.userId);
            
            const message = new Message({
                chatId: chatId,
                sender: socket.userId,
                recipient: partnerId,
                content: content.trim(),
                read: false,
                createdAt: new Date()
            });
            
            await message.save();
            
            chat.lastMessage = {
                content: content.trim(),
                sender: socket.userId,
                timestamp: new Date()
            };
            
            const currentCount = chat.messageCounts?.get(socket.userId) || 0;
            chat.messageCounts.set(socket.userId, currentCount + 1);
            
            const messageCount = currentCount + 1;
            let revealUpdate = false;
            let pointsEarned = 0;
            
            if (messageCount === 5) {
                chat.revealLevels.set(socket.userId, 1);
                revealUpdate = true;
            } else if (messageCount === 10) {
                chat.revealLevels.set(socket.userId, 2);
                revealUpdate = true;
            } else if (messageCount === 20) {
                chat.revealLevels.set(socket.userId, 3);
                revealUpdate = true;
            } else if (messageCount === 30) {
                chat.revealLevels.set(socket.userId, 4);
                // ✨ ADDED: Award points for full reveal
                await User.findByIdAndUpdate(socket.userId, {
                    $inc: { points: 50 }
                });
                pointsEarned = 50;
                revealUpdate = true;
            }
            
            await chat.save();
            
            // ✨ ADDED: Update user message count
            await User.findByIdAndUpdate(socket.userId, {
                $inc: { 'stats.totalMessagesSent': 1 }
            });
            
            const messageData = {
                _id: message._id,
                chatId: chatId,
                sender: socket.userId,
                content: content.trim(),
                createdAt: message.createdAt,
                read: false
            };
            
            socket.emit('messageSent', messageData);
            socket.to(`persistent:${chatId}`).emit('newPersistentMessage', messageData);
            
            if (revealUpdate) {
                const sender = await User.findById(socket.userId).select('username gender location country avatar bio interests realName');
                
                const revealData = {
                    level: chat.revealLevels.get(socket.userId),
                    messageCount: messageCount,
                    revealedInfo: {},
                    pointsEarned: pointsEarned
                };
                
                if (messageCount >= 5) revealData.revealedInfo.gender = sender.gender;
                if (messageCount >= 10) {
                    revealData.revealedInfo.location = sender.location;
                    revealData.revealedInfo.country = sender.country;
                }
                if (messageCount >= 20) revealData.revealedInfo.avatar = sender.avatar;
                if (messageCount >= 30) {
                    revealData.revealedInfo.fullProfile = {
                        username: sender.username,
                        bio: sender.bio,
                        interests: sender.interests,
                        realName: sender.realName  // ✨ ADDED: Full reveal includes real name
                    };
                }
                
                io.to(`persistent:${chatId}`).emit('revealUpdate', revealData);
            }
            
        } catch (error) {
            console.error('Persistent message error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });
    
    socket.on('persistentTyping', (data) => {
        const { chatId, isTyping } = data;
        
        if (chatId) {
            socket.to(`persistent:${chatId}`).emit('partnerTyping', {
                userId: socket.userId,
                isTyping: isTyping
            });
        }
    });
    
    socket.on('leavePersistentChat', (data) => {
        const { chatId } = data;
        
        if (chatId) {
            socket.leave(`persistent:${chatId}`);
            socket.to(`persistent:${chatId}`).emit('partnerOnline', {
                userId: socket.userId,
                online: false
            });
        }
    });
    
    socket.on('messageRead', async (data) => {
        try {
            const { chatId, messageId } = data;
            
            await Message.findByIdAndUpdate(messageId, { read: true });
            
            socket.to(`persistent:${chatId}`).emit('messageReadReceipt', {
                messageId: messageId,
                chatId: chatId
            });
        } catch (error) {
            console.error('Message read error:', error);
        }
    });
    
    // ========== ROOM EVENTS ==========
    socket.on('joinRoom', async (roomName) => {
        try {
            const room = (roomName || 'general').toString().toLowerCase().trim();
            
            if (room.length > 20 || !/^[a-z0-9-_]+$/.test(room)) {
                socket.emit('error', { message: 'Invalid room name' });
                return;
            }
            
            const previousRooms = Array.from(socket.rooms);
            previousRooms.forEach(r => {
                if (r !== socket.id && r !== room) {
                    socket.leave(r);
                }
            });
            
            socket.join(room);
            activeRooms.add(room);
            
            const userInfo = userSockets.get(userId);
            if (userInfo) {
                userInfo.currentRoom = room;
            }
            
            console.log(`🚪 ${username} joined room: "${room}"`);
            
            socket.emit('roomJoined', {
                room: room,
                message: `You joined ${room} room`,
                activeUsers: 0
            });
            
            socket.to(room).emit('userJoined', {
                userId,
                username,
                room: room,
                time: new Date().toISOString()
            });
            
            try {
                if (mongoose.connection.readyState === 1) {
                    const messages = await Message.find({ room: room })
                        .sort({ timestamp: 1 })
                        .limit(100)
                        .lean();
                    
                    socket.emit('roomHistory', {
                        room: room,
                        messages: messages.map(msg => ({
                            id: msg._id,
                            userId: msg.userId || msg.user,
                            username: msg.username || 'Anonymous',
                            text: msg.text,
                            time: new Date(msg.timestamp).toLocaleTimeString(),
                            timestamp: msg.timestamp,
                            isOwn: (msg.userId || msg.user) === userId
                        }))
                    });
                }
            } catch (error) {
                console.error('Error loading message history:', error.message);
            }
            
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });
    
    socket.on('chatMessage', async (data) => {
        try {
            if (!data.text || data.text.trim().length === 0) {
                socket.emit('error', { message: 'Message cannot be empty' });
                return;
            }
            
            if (data.text.length > 1000) {
                socket.emit('error', { message: 'Message too long (max 1000 characters)' });
                return;
            }
            
            const room = (data.room || 'general').toString().toLowerCase().trim();
            const messageText = data.text.trim();
            
            console.log(`📨 Message from ${username}: "${messageText}"`);
            
            const messageData = {
                user: userId,
                username: username,
                text: messageText,
                room: room,
                timestamp: new Date()
            };
            
            try {
                if (mongoose.connection.readyState === 1) {
                    const message = new Message(messageData);
                    await message.save();
                }
            } catch (dbError) {
                console.error('Database save error:', dbError.message);
            }
            
            const messagePayload = {
                id: Date.now().toString(),
                userId: socket.id,
                username,
                text: messageText,
                room: room,
                time: new Date().toLocaleTimeString(),
                timestamp: new Date().toISOString(),
                isOwn: false
            };
            
            socket.emit('newMessage', {
                ...messagePayload,
                isOwn: true
            });
            
            socket.to(room).emit('newMessage', messagePayload);
            
        } catch (error) {
            console.error('Error sending message:', error.message);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });
    
    // ========== DISCONNECTION ==========
    socket.on('disconnect', async () => {
        console.log(`🔴 User disconnected: ${username} (${socket.id})`);
        
        if (waitingQueue.has(userId)) {
            waitingQueue.delete(userId);
            console.log(`🗑️ Removed ${username} from waiting queue`);
        }
        
        if (deepChatQueue.has(userId)) {
            deepChatQueue.delete(userId);
            console.log(`🗑️ Removed ${username} from deep queue`);
        }
        
        const chat = activeChats.get(userId);
        if (chat) {
            endChat(userId, 'partner_disconnected');
            
            const partnerId = chat.partnerId;
            if (partnerId) {
                const partnerChat = activeChats.get(partnerId);
                if (partnerChat && partnerChat.timer) {
                    clearTimeout(partnerChat.timer);
                }
                activeChats.delete(partnerId);
                
                const partnerSocket = getSocketByUserId(partnerId);
                if (partnerSocket) {
                    partnerSocket.emit('chatEnded', {
                        reason: 'partner_disconnected',
                        message: 'Your chat partner disconnected.',
                        duration: Date.now() - new Date(chat.startedAt).getTime()
                    });
                    partnerSocket.leave(chat.roomId);
                }
            }
        }
        
        const deepChat = activeDeepChats.get(userId);
        if (deepChat) {
            endDeepChat(userId, 'partner_disconnected');
        }
        
        userSockets.delete(userId);
        
        // ✨ ADDED: Mark user offline in database
        try {
            await User.findByIdAndUpdate(userId, {
                isOnline: false,
                lastActive: new Date()
            });
        } catch (err) {
            console.error('Error updating offline status:', err);
        }
        
        socket.broadcast.emit('userOffline', {
            userId,
            username,
            onlineUsers: io.engine.clientsCount - 1
        });
    });
    
    // ✨ ADDED: Silence check interval for deep chats
    const silenceInterval = setInterval(() => {
        for (const [uid, chat] of activeDeepChats) {
            if (chat.roomId) {
                checkSilenceAndSendHint(chat.roomId, uid);
            }
        }
    }, 30000); // Check every 30 seconds
    
    // Clean up interval on disconnect
    socket.on('disconnect', () => {
        clearInterval(silenceInterval);
    });
    
  }); // END OF io.on('connection')
  
  // ========== GRACEFUL SHUTDOWN ==========
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  async function gracefulShutdown() {
    console.log('\n\n🛑 Graceful shutdown initiated...');
    
    try {
        console.log('📢 Notifying connected clients...');
        io.sockets.sockets.forEach(socket => {
            socket.emit('serverShutdown', { message: 'Server is shutting down' });
            socket.disconnect(true);
        });
        
        console.log('🛑 Closing HTTP server...');
        await new Promise((resolve) => {
            server.close(resolve);
        });
        console.log('📴 HTTP server closed');
        
        if (mongoose.connection.readyState === 1) {
            console.log('🛑 Closing MongoDB connection...');
            await mongoose.connection.close(false);
            console.log('📴 MongoDB connection closed');
        }
        
        console.log('👋 Graceful shutdown complete');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
  }
  
  // ========== CONNECT TO MONGODB ==========
  const connectWithRetry = async () => {
      return await dbManager.connectWithWakeUp();
  };
  
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });
  
  mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected. Attempting to reconnect...');
    setTimeout(() => connectWithRetry(), 10000);
  });
  
  // ========== START SERVER ==========
  (async () => {
    try {
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`=========================================`);
            console.log(`🚀 SERVER STARTED SUCCESSFULLY!`);
            console.log(`📡 Environment: ${NODE_ENV}`);
            console.log(`🌐 HTTP: http://localhost:${PORT}`);
            console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
            console.log(`📊 Health: http://localhost:${PORT}/api/health`);
            console.log(`=========================================`);
            console.log(`🔄 Attempting MongoDB connection with auto wake-up...`);
            console.log(`⏱️  Server continues running even if DB is sleeping`);
            console.log(`=========================================`);
        });
        
        setTimeout(async () => {
            console.log('🌐 Starting MongoDB connection process...');
            const dbConnected = await connectWithRetry();
            
            if (dbConnected) {
                console.log('✅ MongoDB ready! Full functionality enabled.');
            } else {
                console.log('⚠️ Running without MongoDB. Use wake-up-mongo.js if needed.');
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
  })();
  
  // ========== ERROR HANDLERS ==========
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });