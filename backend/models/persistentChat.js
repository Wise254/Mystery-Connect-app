// models/PersistentChat.js
const mongoose = require('mongoose');

const persistentChatSchema = new mongoose.Schema({
    // Participants in the chat
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    
    // Message counts per user
    messageCounts: {
        type: Map,
        of: Number,
        default: () => new Map()
    },
    
    // Reveal levels per user
    revealLevels: {
        type: Map,
        of: Number,
        default: () => new Map()
    },
    
    // Last message info for preview
    lastMessage: {
        content: { type: String, default: '' },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now }
    },
    
    // Track if chat is active
    isActive: { type: Boolean, default: true },
    
    // Track when users last read the chat
    lastRead: {
        type: Map,
        of: Date,
        default: () => new Map()
    },
    
    // Track if users have interacted before
    previousInteraction: { type: Boolean, default: false },
    previousInteractionType: { type: String, enum: ['quick', 'deep', 'none'], default: 'none' },
    
    createdAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ==================== INDEXES ====================
persistentChatSchema.index({ participants: 1 });
persistentChatSchema.index({ lastActivity: -1 });
persistentChatSchema.index({ 'participants': 1, 'lastActivity': -1 });

// ==================== MIDDLEWARE (Mongoose 9) ====================
// 🔧 FIXED: Removed 'next' parameter for Mongoose 9
persistentChatSchema.pre('save', function() {
    if (this.isModified('lastMessage')) {
        this.lastActivity = new Date();
    }
});

// ==================== METHODS ====================
// Get reveal level for a specific user
persistentChatSchema.methods.getRevealLevel = function(userId) {
    return this.revealLevels?.get(userId.toString()) || 0;
};

// Get message count for a specific user
persistentChatSchema.methods.getMessageCount = function(userId) {
    return this.messageCounts?.get(userId.toString()) || 0;
};

// Increment message count for a user and check for reveal updates
persistentChatSchema.methods.incrementMessageCount = async function(userId) {
    const userIdStr = userId.toString();
    const currentCount = this.messageCounts?.get(userIdStr) || 0;
    const newCount = currentCount + 1;
    
    this.messageCounts.set(userIdStr, newCount);
    
    let revealUpdated = false;
    let newRevealLevel = this.revealLevels?.get(userIdStr) || 0;
    
    if (newCount === 5 && newRevealLevel < 1) {
        newRevealLevel = 1;
        revealUpdated = true;
    } else if (newCount === 10 && newRevealLevel < 2) {
        newRevealLevel = 2;
        revealUpdated = true;
    } else if (newCount === 20 && newRevealLevel < 3) {
        newRevealLevel = 3;
        revealUpdated = true;
    } else if (newCount === 30 && newRevealLevel < 4) {
        newRevealLevel = 4;
        revealUpdated = true;
    }
    
    if (revealUpdated) {
        this.revealLevels.set(userIdStr, newRevealLevel);
    }
    
    await this.save();
    
    return { newCount, revealUpdated, newRevealLevel: revealUpdated ? newRevealLevel : null };
};

// Mark chat as read for a user
persistentChatSchema.methods.markAsRead = async function(userId) {
    this.lastRead.set(userId.toString(), new Date());
    await this.save();
};

// Get partner info for a user
persistentChatSchema.methods.getPartnerInfo = async function(userId) {
    const User = mongoose.model('User');
    const partnerId = this.participants.find(p => p.toString() !== userId.toString());
    if (!partnerId) return null;
    
    const partner = await User.findById(partnerId).select('username avatar gender location country lastActive isOnline');
    const currentUser = await User.findById(userId);
    const hasInteractedBefore = currentUser?.hasInteractedWith(partnerId) || false;
    
    return { ...partner.toObject(), hasInteractedBefore };
};

// ==================== STATICS ====================
// Find chat between two users
persistentChatSchema.statics.findChatBetween = function(userId1, userId2) {
    return this.findOne({ participants: { $all: [userId1, userId2] } });
};

// Find or create chat between two users
persistentChatSchema.statics.findOrCreateChat = async function(userId1, userId2, previousInteraction = false, previousType = 'none') {
    let chat = await this.findChatBetween(userId1, userId2);
    
    if (!chat) {
        chat = new this({
            participants: [userId1, userId2],
            messageCounts: new Map([[userId1.toString(), 0], [userId2.toString(), 0]]),
            revealLevels: new Map([[userId1.toString(), 0], [userId2.toString(), 0]]),
            previousInteraction,
            previousInteractionType: previousType,
            createdAt: new Date()
        });
        await chat.save();
    }
    
    return chat;
};

// Get all chats for a user with unread counts
persistentChatSchema.statics.getUserChatsWithUnread = async function(userId) {
    const chats = await this.find({ participants: userId }).sort({ lastActivity: -1 });
    const Message = mongoose.model('Message');
    
    const enrichedChats = await Promise.all(chats.map(async (chat) => {
        const partnerId = chat.participants.find(p => p.toString() !== userId.toString());
        const User = mongoose.model('User');
        const partner = await User.findById(partnerId).select('username avatar lastActive isOnline');
        
        const unreadCount = await Message.countDocuments({
            chatId: chat._id,
            recipient: userId,
            read: false
        });
        
        return {
            _id: chat._id,
            partner,
            lastMessage: chat.lastMessage,
            unreadCount,
            messageCount: chat.getMessageCount(userId),
            revealLevel: chat.getRevealLevel(userId),
            previousInteraction: chat.previousInteraction,
            previousInteractionType: chat.previousInteractionType,
            createdAt: chat.createdAt,
            lastActivity: chat.lastActivity
        };
    }));
    
    return enrichedChats;
};

const PersistentChat = mongoose.model('PersistentChat', persistentChatSchema);

module.exports = PersistentChat;