// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    username: { type: String, default: 'Anonymous' },
    text: { type: String, required: function() { return !this.content; } },
    content: { type: String, required: function() { return !this.text; } },
    room: { type: String, default: 'general' },
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersistentChat', required: false },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    timestamp: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    isQuickChat: { type: Boolean, default: false },
    isDeepChat: { type: Boolean, default: false },
    isPersistentChat: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null }
}, { timestamps: true });

// Indexes
messageSchema.index({ room: 1, timestamp: -1 });
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ recipient: 1, read: 1 });

// Virtuals
messageSchema.virtual('messageContent').get(function() {
    return this.content || this.text || '';
});

// Methods
messageSchema.methods.markAsRead = async function() {
    this.read = true;
    this.readAt = new Date();
    await this.save();
    return this;
};

// Statics
messageSchema.statics.getUnreadCount = async function(userId) {
    return this.countDocuments({ recipient: userId, read: false });
};

messageSchema.statics.markChatAsRead = async function(chatId, userId) {
    return this.updateMany(
        { chatId, recipient: userId, read: false },
        { read: true, readAt: new Date() }
    );
};

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;