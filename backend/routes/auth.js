// Enhanced Auth Routes File - Mystery Connect
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const jwt = require('jsonwebtoken');

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'mystery-chat-secret-key-change-in-production';

// Helper: Generate recovery code
function generateRecoveryCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
        if (i === 4 || i === 8) {
            code += '-';
        }
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Helper: Validate password strength
function validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (password.length < minLength) {
        return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!hasUpperCase) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!hasLowerCase) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!hasNumbers) {
        return { valid: false, message: 'Password must contain at least one number' };
    }
    if (!hasSpecialChar) {
        return { valid: false, message: 'Password must contain at least one special character' };
    }
    
    return { valid: true };
}

// ==================== REGISTRATION ====================
router.post('/register', async (req, res) => {
    try {
        const { 
            username, 
            email, 
            password, 
            dateOfBirth, 
            avatar, 
            securityQuestions 
        } = req.body;
        
        // Basic validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }
        
        // Validate password strength
        const passwordCheck = validatePasswordStrength(password);
        if (!passwordCheck.valid) {
            return res.status(400).json({
                success: false,
                message: passwordCheck.message
            });
        }
        
        // Validate age (18+)
        if (dateOfBirth) {
            const birthDate = new Date(dateOfBirth);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            if (age < 18) {
                return res.status(400).json({
                    success: false,
                    message: 'You must be at least 18 years old to use Mystery Connect'
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'Date of birth is required for age verification'
            });
        }
        
        // Validate security questions
        if (!securityQuestions || securityQuestions.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Please provide at least 2 security questions'
            });
        }
        
        for (const sq of securityQuestions) {
            if (!sq.question || !sq.answer || sq.answer.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Security answers must be at least 2 characters'
                });
            }
        }
        
        if (securityQuestions[0].question === securityQuestions[1].question) {
            return res.status(400).json({
                success: false,
                message: 'Please select two different security questions'
            });
        }
        
        // Check if username exists (case insensitive)
        const existingUser = await User.findOne({ 
            username: new RegExp(`^${username}$`, 'i')
        });
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username already exists'
            });
        }
        
        // Check email if provided
        if (email && email.trim() !== '') {
            const existingEmail = await User.findOne({ 
                email: email.toLowerCase().trim()
            });
            
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already registered'
                });
            }
        }
        
        // Generate recovery code
        const recoveryCode = generateRecoveryCode();
        
        // Create new user
        const user = new User({
            username: username.toLowerCase(),
            email: email ? email.toLowerCase().trim() : undefined,
            password: password,
            dateOfBirth: new Date(dateOfBirth),
            avatar: avatar || '🦊',
            securityQuestions: securityQuestions,
            recoveryCode: {
                code: recoveryCode,
                generatedAt: new Date(),
                used: false
            },
            level: 1,
            points: 0,
            isOnline: false,
            lastActive: new Date()
        });
        
        await user.save();
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id, 
                username: user.username,
                level: user.level 
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.status(201).json({
            success: true,
            message: 'Welcome to Mystery Connect! Please save your recovery code.',
            token,
            recoveryCode: recoveryCode,
            user: {
                id: user._id,
                username: user.username,
                avatar: user.avatar,
                level: user.level,
                points: user.points,
                email: user.email || null,
                profileCompleted: false
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }
        
        // Find user (case insensitive)
        const user = await User.findOne({ 
            username: new RegExp(`^${username}$`, 'i')
        });
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid username or password'
            });
        }
        
        // Check password using the model method
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Invalid username or password'
            });
        }
        
        // Update user status
        user.isOnline = true;
        user.lastActive = new Date();
        await user.save();
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id, 
                username: user.username,
                level: user.level 
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        const profileCompleted = user.profile?.completed === true;
        
        res.json({
            success: true,
            message: 'Welcome back!',
            token,
            profileCompleted: profileCompleted,
            user: {
                id: user._id,
                username: user.username,
                avatar: user.avatar,
                level: user.level,
                points: user.points,
                email: user.email,
                isOnline: user.isOnline,
                lastActive: user.lastActive,
                hasUnlockedDeepChat: user.progression?.hasUnlockedDeepChat || false,
                hasUnlockedExplore: user.progression?.hasUnlockedExplore || false
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ==================== PASSWORD RECOVERY SYSTEM ====================

// Forgot password - Step 1: Get security question
router.post('/forgot-password', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({
                success: false,
                message: 'Username is required'
            });
        }
        
        const user = await User.findOne({ 
            username: new RegExp(`^${username}$`, 'i')
        }).select('+securityQuestions');
        
        if (!user) {
            // Don't reveal that user doesn't exist for security
            return res.json({
                success: true,
                securityQuestion: 'What is your favorite color?',
                hasSecurityQuestion: false,
                canUseRecoveryCode: false
            });
        }
        
        // Return first security question if exists
        const hasSecurityQuestion = user.securityQuestions && 
                                   user.securityQuestions.length > 0 && 
                                   user.securityQuestions[0]?.question;
        
        res.json({
            success: true,
            securityQuestion: hasSecurityQuestion ? user.securityQuestions[0].question : null,
            hasSecurityQuestion: !!hasSecurityQuestion,
            canUseRecoveryCode: user.recoveryCode && !user.recoveryCode.used
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Forgot password - Step 2: Reset password
router.post('/reset-password', async (req, res) => {
    try {
        const { username, securityAnswer, recoveryCode, newPassword } = req.body;
        
        if (!username || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Username and new password are required'
            });
        }
        
        // Validate password strength
        const passwordCheck = validatePasswordStrength(newPassword);
        if (!passwordCheck.valid) {
            return res.status(400).json({
                success: false,
                message: passwordCheck.message
            });
        }
        
        const user = await User.findOne({ 
            username: new RegExp(`^${username}$`, 'i')
        }).select('+securityQuestions +recoveryCode');
        
        if (!user) {
            return res.json({
                success: true,
                message: 'If the account exists, password reset instructions have been sent'
            });
        }
        
        let isValid = false;
        
        // Check security answer
        if (securityAnswer && user.securityQuestions && user.securityQuestions[0]) {
            const answerMatch = await bcrypt.compare(
                securityAnswer.toLowerCase(), 
                user.securityQuestions[0].answer
            );
            if (answerMatch) isValid = true;
        }
        
        // Check recovery code
        if (!isValid && recoveryCode && user.recoveryCode) {
            const normalizedInput = recoveryCode.toUpperCase().replace(/\s/g, '');
            const normalizedStored = user.recoveryCode.code.replace(/\s/g, '');
            const codeMatch = normalizedInput === normalizedStored && !user.recoveryCode.used;
            
            if (codeMatch) {
                isValid = true;
                user.recoveryCode.used = true;
                user.recoveryCode.usedAt = new Date();
            }
        }
        
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid security answer or recovery code'
            });
        }
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        res.json({
            success: true,
            message: 'Password reset successfully. Please login with your new password.'
        });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during password reset'
        });
    }
});

// ==================== PROFILE COMPLETION ROUTES ====================

// Check if profile is completed
router.get('/profile/check', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            profileCompleted: user.profile?.completed || false,
            profile: user.profile || null
        });
        
    } catch (error) {
        console.error('Check profile error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Complete profile
router.post('/profile/complete', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const { 
            interests, 
            bio, 
            chatStyle, 
            lookingFor,
            topics,
            realName,
            country,
            gender
        } = req.body;
        
        // Validate required fields
        if (!interests || interests.length < 1) {
            return res.status(400).json({
                success: false,
                message: 'Please select at least 1 interest'
            });
        }
        
        if (interests.length > 5) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 5 interests allowed'
            });
        }
        
        // Find and update user
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if profile already completed
        if (user.profile?.completed) {
            return res.status(400).json({
                success: false,
                message: 'Profile already completed',
                profileCompleted: true
            });
        }
        
        // Update user profile fields
        user.interests = interests.slice(0, 5);
        if (realName) user.realName = realName;
        if (country) user.country = country;
        if (gender) user.gender = gender;
        
        // Create hidden profile
        user.profile = {
            interests: interests.slice(0, 5),
            bio: bio || '',
            chatStyle: chatStyle || 'casual',
            lookingFor: lookingFor || 'friendship',
            topics: topics || [],
            completed: true,
            hidden: true,
            completedAt: new Date()
        };
        
        // Add 10 bonus points for completing profile
        user.points += 10;
        user.level = Math.floor(user.points / 100) + 1;
        
        await user.save();
        
        res.json({
            success: true,
            message: 'Profile completed! +10 points',
            user: {
                id: user._id,
                username: user.username,
                avatar: user.avatar,
                level: user.level,
                points: user.points,
                profileCompleted: true
            }
        });
        
    } catch (error) {
        console.error('Complete profile error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ==================== TOKEN VERIFICATION ====================
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        user.lastActive = new Date();
        await user.save();
        
        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                avatar: user.avatar,
                level: user.level,
                points: user.points,
                isOnline: user.isOnline,
                lastActive: user.lastActive,
                profileCompleted: user.profile?.completed || false,
                hasUnlockedDeepChat: user.progression?.hasUnlockedDeepChat || false,
                hasUnlockedExplore: user.progression?.hasUnlockedExplore || false
            }
        });
        
    } catch (error) {
        console.error('Token verification error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ==================== USER SEARCH ====================
router.get('/search', async (req, res) => {
    try {
        const { query, limit = 20 } = req.query;
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        let currentUserId = null;
        
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                currentUserId = decoded.userId;
            } catch (error) {
                // Token invalid, continue without auth
            }
        }
        
        if (!query || query.length < 2) {
            return res.json({
                success: true,
                users: []
            });
        }
        
        const searchQuery = {
            username: { $regex: query, $options: 'i' }
        };
        
        if (currentUserId) {
            searchQuery._id = { $ne: currentUserId };
        }
        
        const users = await User.find(searchQuery)
            .select('username avatar level points isOnline lastActive')
            .limit(parseInt(limit))
            .sort({ isOnline: -1, level: -1 });
        
        res.json({
            success: true,
            users: users.map(user => ({
                id: user._id,
                username: user.username,
                avatar: user.avatar,
                level: user.level,
                points: user.points,
                isOnline: user.isOnline,
                lastActive: user.lastActive,
                status: user.isOnline ? 'Online' : 
                        new Date() - new Date(user.lastActive) < 5 * 60 * 1000 ? 'Recently' : 'Offline'
            }))
        });
        
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Search failed'
        });
    }
});

// ==================== UPDATE USER PROFILE ====================
router.put('/update-profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const { avatar, interests, bio, realName, country, gender } = req.body;
        
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        if (avatar) user.avatar = avatar;
        if (interests) user.interests = interests.slice(0, 5);
        if (realName) user.realName = realName;
        if (country) user.country = country;
        if (gender) user.gender = gender;
        
        if (bio && user.profile) {
            user.profile.bio = bio;
        }
        
        await user.save();
        
        res.json({
            success: true,
            message: 'Profile updated',
            user: {
                id: user._id,
                username: user.username,
                avatar: user.avatar,
                interests: user.interests,
                level: user.level,
                points: user.points
            }
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
});

// ==================== LOGOUT ====================
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                await User.findByIdAndUpdate(decoded.userId, {
                    isOnline: false,
                    lastActive: new Date()
                });
            } catch (error) {
                // Token invalid, ignore
            }
        }
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        res.json({
            success: true,
            message: 'Logged out'
        });
    }
});

// ==================== GET USER BY ID ====================
router.get('/user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        const user = await User.findById(id)
            .select('username avatar level points isOnline lastActive');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                avatar: user.avatar,
                level: user.level,
                points: user.points,
                isOnline: user.isOnline,
                lastActive: user.lastActive
            }
        });
        
    } catch (error) {
        console.error('Get user error:', error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user'
        });
    }
});

module.exports = router;