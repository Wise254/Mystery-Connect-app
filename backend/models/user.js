const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [30, 'Username cannot exceed 30 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    
    email: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    
    dateOfBirth: {
        type: Date,
        required: false
    },
    
    realName: {
        type: String,
        default: '',
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    
    country: {
        type: String,
        default: ''
    },
    
    gender: {
        type: String,
        enum: ['male', 'female', 'non-binary', 'prefer-not-to-say'],
        default: 'prefer-not-to-say'
    },
    
    location: {
        type: String,
        default: '',
        maxlength: [100, 'Location cannot exceed 100 characters']
    },
    
    avatar: {
        type: String,
        default: '🦊'
    },
    
    bio: {
        type: String,
        default: '',
        maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    
    interests: [{
        type: String,
        trim: true
    }],
    
    profile: {
        interests: [{
            type: String,
            trim: true
        }],
        bio: {
            type: String,
            maxlength: 500
        },
        chatStyle: {
            type: String,
            enum: ['casual', 'deep', 'funny', 'serious', 'quirky'],
            default: 'casual'
        },
        lookingFor: {
            type: String,
            enum: ['friendship', 'deep-conversations', 'learning', 'fun', 'support'],
            default: 'friendship'
        },
        topics: [{
            type: String,
            trim: true
        }],
        completed: {
            type: Boolean,
            default: false
        },
        hidden: {
            type: Boolean,
            default: true
        },
        completedAt: {
            type: Date
        }
    },
    
    securityQuestions: [{
        question: {
            type: String,
            required: true
        },
        answer: {
            type: String,
            required: true
        }
    }],
    
    recoveryCode: {
        code: {
            type: String
        },
        generatedAt: {
            type: Date
        },
        used: {
            type: Boolean,
            default: false
        },
        usedAt: {
            type: Date
        }
    },
    
    points: {
        type: Number,
        default: 0,
        min: 0
    },
    
    level: {
        type: Number,
        default: 1,
        min: 1
    },
    
    progression: {
        hasCompletedFirstChat: {
            type: Boolean,
            default: false
        },
        hasUnlockedDeepChat: {
            type: Boolean,
            default: false
        },
        hasUnlockedHourChat: {
            type: Boolean,
            default: false
        },
        hasCompletedHourChat: {
            type: Boolean,
            default: false
        },
        hasUnlockedExplore: {
            type: Boolean,
            default: false
        },
        firstChatCompletedAt: Date,
        deepChatUnlockedAt: Date,
        hourChatCompletedAt: Date,
        exploreUnlockedAt: Date
    },
    
    stats: {
        totalChats: { type: Number, default: 0 },
        quickChats: { type: Number, default: 0 },
        deepChats: { type: Number, default: 0 },
        persistentChats: { type: Number, default: 0 },
        totalMessagesSent: { type: Number, default: 0 },
        totalTimeSpent: { type: Number, default: 0 },
        longestChat: { type: Number, default: 0 },
        lastChatAt: Date,
        sparksGiven: { type: Number, default: 0 },
        sparksReceived: { type: Number, default: 0 }
    },
    
    previousInteractions: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        chatType: {
            type: String,
            enum: ['quick', 'deep']
        },
        completed: {
            type: Boolean,
            default: false
        },
        interactedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    lastActive: {
        type: Date,
        default: Date.now
    },
    
    isOnline: {
        type: Boolean,
        default: false
    },
    
    isActive: {
        type: Boolean,
        default: true
    },
    
    isVerified: {
        type: Boolean,
        default: false
    },
    
    settings: {
        notifications: { type: Boolean, default: true },
        soundEffects: { type: Boolean, default: true },
        darkMode: { type: Boolean, default: false },
        language: { type: String, default: 'en' }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ==================== INDEXES ====================
userSchema.index({ 'progression.hasUnlockedExplore': 1, lastActive: -1 });
userSchema.index({ points: -1 });
userSchema.index({ username: 'text', 'profile.bio': 'text', 'profile.interests': 'text' });
userSchema.index({ lastActive: -1 });

// ==================== VIRTUALS ====================
userSchema.virtual('age').get(function() {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
});

userSchema.virtual('isAdult').get(function() {
    return this.age >= 18;
});

userSchema.virtual('calculatedLevel').get(function() {
    return Math.floor(this.points / 100) + 1;
});

userSchema.virtual('canAccessQuickChat').get(function() {
    return this.isActive && this.profile?.completed === true;
});

userSchema.virtual('canAccessDeepChat').get(function() {
    return this.progression?.hasUnlockedDeepChat && this.isActive;
});

userSchema.virtual('canAccessExplore').get(function() {
    return this.progression?.hasUnlockedExplore && this.isActive;
});

// ==================== MIDDLEWARE (Mongoose 9 Compatible) ====================

// Hash password before saving
userSchema.pre('save', async function() {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
});

// Hash security question answers before saving
userSchema.pre('save', async function() {
    if (this.isModified('securityQuestions') && this.securityQuestions && this.securityQuestions.length > 0) {
        for (let i = 0; i < this.securityQuestions.length; i++) {
            const sq = this.securityQuestions[i];
            if (sq.answer && sq.answer.length > 0 && !sq.answer.startsWith('$2')) {
                const salt = await bcrypt.genSalt(10);
                sq.answer = await bcrypt.hash(sq.answer.toLowerCase(), salt);
            }
        }
    }
});

// Update level based on points before saving
userSchema.pre('save', function() {
    const calculatedLevel = Math.floor(this.points / 100) + 1;
    if (calculatedLevel > this.level) {
        this.level = calculatedLevel;
    }
});

// ==================== METHODS ====================
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) {
        const user = await this.constructor.findById(this._id).select('+password');
        return await bcrypt.compare(candidatePassword, user.password);
    }
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.compareSecurityAnswer = async function(questionIndex, candidateAnswer) {
    if (!this.securityQuestions || !this.securityQuestions[questionIndex]) {
        return false;
    }
    const sq = this.securityQuestions[questionIndex];
    return await bcrypt.compare(candidateAnswer.toLowerCase(), sq.answer);
};

userSchema.methods.addPoints = async function(points, reason = '') {
    this.points += points;
    const oldLevel = this.level;
    const newLevel = Math.floor(this.points / 100) + 1;
    const leveledUp = newLevel > oldLevel;
    this.level = newLevel;
    await this.save();
    
    return {
        pointsAdded: points,
        totalPoints: this.points,
        newLevel: this.level,
        leveledUp,
        reason
    };
};

userSchema.methods.unlockStage = async function(stage) {
    let pointsEarned = 0;
    let message = '';
    
    switch(stage) {
        case 'firstChat':
            if (!this.progression.hasCompletedFirstChat) {
                this.progression.hasCompletedFirstChat = true;
                this.progression.firstChatCompletedAt = new Date();
                pointsEarned = 25;
                message = 'First chat completed! +25 points';
                this.stats.quickChats += 1;
                this.stats.totalChats += 1;
            }
            break;
            
        case 'deepChat':
            if (!this.progression.hasUnlockedDeepChat) {
                this.progression.hasUnlockedDeepChat = true;
                this.progression.deepChatUnlockedAt = new Date();
                pointsEarned = 25;
                message = 'Deep Chat unlocked! +25 points';
            }
            break;
            
        case 'hourChat':
            if (!this.progression.hasUnlockedHourChat) {
                this.progression.hasUnlockedHourChat = true;
                pointsEarned = 50;
                message = 'Deep Dive access granted! +50 points';
            }
            break;
            
        case 'explore':
            if (!this.progression.hasUnlockedExplore) {
                this.progression.hasCompletedHourChat = true;
                this.progression.hasUnlockedExplore = true;
                this.progression.hourChatCompletedAt = new Date();
                this.progression.exploreUnlockedAt = new Date();
                pointsEarned = 100;
                message = 'Explore page unlocked! +100 points';
                this.stats.deepChats += 1;
                this.stats.totalChats += 1;
            }
            break;
            
        default:
            throw new Error('Invalid stage: ' + stage);
    }
    
    if (pointsEarned > 0) {
        this.points += pointsEarned;
        this.level = Math.floor(this.points / 100) + 1;
    }
    
    await this.save();
    
    return {
        success: true,
        stage,
        pointsEarned,
        totalPoints: this.points,
        level: this.level,
        message,
        progression: this.progression
    };
};

userSchema.methods.updateChatStats = async function(chatType, duration = 0, partnerId = null) {
    this.stats.totalChats += 1;
    this.stats.lastChatAt = new Date();
    
    if (chatType === 'quick') {
        this.stats.quickChats += 1;
    } else if (chatType === 'deep') {
        this.stats.deepChats += 1;
    } else if (chatType === 'persistent') {
        this.stats.persistentChats += 1;
    }
    
    if (duration > 0) {
        this.stats.totalTimeSpent += duration;
        if (duration > this.stats.longestChat) {
            this.stats.longestChat = duration;
        }
    }
    
    if (partnerId) {
        this.previousInteractions.push({
            userId: partnerId,
            chatType: chatType,
            completed: true,
            interactedAt: new Date()
        });
    }
    
    await this.save();
};

userSchema.methods.hasInteractedWith = function(otherUserId) {
    return this.previousInteractions.some(
        interaction => interaction.userId.toString() === otherUserId.toString() && interaction.completed
    );
};

userSchema.methods.incrementMessageCount = async function() {
    this.stats.totalMessagesSent += 1;
    await this.save();
};

userSchema.methods.getPublicProfile = function() {
    return {
        _id: this._id,
        username: this.username,
        avatar: this.avatar,
        level: this.level,
        lastActive: this.lastActive,
        isOnline: this.isOnline
    };
};

userSchema.methods.getProgressiveProfile = function(revealLevel = 0) {
    const profile = this.getPublicProfile();
    
    if (revealLevel >= 1) {
        profile.gender = this.gender;
    }
    
    if (revealLevel >= 2) {
        profile.location = this.location;
        profile.country = this.country;
    }
    
    if (revealLevel >= 3) {
        profile.avatar = this.avatar;
    }
    
    if (revealLevel >= 4) {
        profile.bio = this.bio;
        profile.interests = this.interests;
        profile.realName = this.realName;
        profile.stats = {
            totalChats: this.stats.totalChats,
            level: this.level
        };
    }
    
    return profile;
};

userSchema.methods.canAccess = function(stage) {
    switch(stage) {
        case 'quickChat':
            return this.isActive && this.profile?.completed === true;
        case 'deepChat':
            return this.progression?.hasUnlockedDeepChat && this.isActive;
        case 'explore':
            return this.progression?.hasUnlockedExplore && this.isActive;
        default:
            return false;
    }
};

// ==================== STATICS ====================
userSchema.statics.findOnline = function() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.find({
        isOnline: true,
        lastActive: { $gte: fiveMinutesAgo }
    });
};

userSchema.statics.findExploreEligible = function(excludeUserId = null) {
    const query = {
        'progression.hasUnlockedExplore': true,
        'profile.completed': true,
        isActive: true
    };
    
    if (excludeUserId) {
        query._id = { $ne: excludeUserId };
    }
    
    return this.find(query)
        .select('username avatar gender location country lastActive isOnline profile')
        .sort({ lastActive: -1 });
};

userSchema.statics.getLeaderboard = function(limit = 100) {
    return this.find({ isActive: true })
        .select('username level points stats.totalChats avatar')
        .sort({ points: -1 })
        .limit(limit);
};

userSchema.statics.markOffline = async function(userId) {
    return this.findByIdAndUpdate(userId, {
        isOnline: false,
        lastActive: new Date()
    });
};

const User = mongoose.model('User', userSchema);

module.exports = User;