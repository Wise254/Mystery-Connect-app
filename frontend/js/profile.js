// Profile Manager with Real Stats
    class ProfileManager {
        constructor() {
            this.userData = null;
            this.currentAvatar = '🦊';
            this.accessories = [];
            this.realStats = null;
            
            this.init();
        }
        
        async init() {
            // Check authentication
            const token = localStorage.getItem('mysteryToken');
            const userData = JSON.parse(localStorage.getItem('mysteryUser') || '{}');
            
            if (!token || !userData.id) {
                window.location.href = 'auth.html';
                return;
            }
            
            this.userData = userData;
            
            // Fetch real stats from server
            await this.fetchRealStats();
            
            // Load saved avatar customization
            this.loadSavedAvatar();
            
            // Update profile display with real data
            this.updateProfileDisplay();
            
            // Setup event listeners
            this.setupEventListeners();
        }
        
        async fetchRealStats() {
            const token = localStorage.getItem('mysteryToken');
            
            try {
                const response = await fetch('/api/user/stats', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.realStats = data.stats;
                    console.log('📊 Real stats loaded:', this.realStats);
                } else {
                    throw new Error('Failed to fetch stats');
                }
            } catch (error) {
                console.error('Error fetching stats:', error);
                // Use cached stats if available
                const cachedStats = localStorage.getItem('userStats');
                if (cachedStats) {
                    this.realStats = JSON.parse(cachedStats);
                } else {
                    // Fallback to userData
                    this.realStats = {
                        totalChats: 0,
                        totalMessages: 0,
                        totalMinutesChatted: 0,
                        sparksGiven: 0,
                        achievements: 0,
                        currentStreak: 0,
                        favoriteChatTime: 'Not enough data',
                        mostActiveDay: 'Not enough data',
                        chatPersonality: 'Emerging Chatter',
                        points: this.userData.points || 0,
                        level: this.userData.level || 1,
                        avatar: this.userData.avatar || '🦊'
                    };
                }
            }
        }
        
        loadSavedAvatar() {
            const savedProfile = localStorage.getItem('mysteryProfile');
            if (savedProfile) {
                const profile = JSON.parse(savedProfile);
                this.currentAvatar = profile.avatar || this.realStats?.avatar || '🦊';
                this.accessories = profile.accessories || [];
            } else {
                this.currentAvatar = this.realStats?.avatar || '🦊';
            }
        }
        
        updateProfileDisplay() {
            if (!this.realStats) return;
            
            // Update stats with real data
            document.getElementById('totalChats').textContent = this.realStats.totalChats;
            document.getElementById('totalPoints').textContent = this.realStats.points;
            document.getElementById('achievementCount').textContent = this.realStats.achievements;
            document.getElementById('currentStreak').textContent = `${this.realStats.currentStreak} days 🔥`;
            
            // Connection quality (calculate based on total chats and streak)
            const connectionQuality = Math.min(100, 50 + (this.realStats.totalChats * 2) + (this.realStats.currentStreak * 3));
            document.getElementById('connectionQuality').textContent = `${Math.min(100, connectionQuality)}%`;
            
            document.getElementById('favoriteTime').textContent = this.realStats.favoriteChatTime;
            document.getElementById('activeDay').textContent = this.realStats.mostActiveDay;
            document.getElementById('chatPersonality').textContent = this.realStats.chatPersonality;
            
            // Update avatar and level
            document.getElementById('spiritAnimal').textContent = this.currentAvatar;
            document.getElementById('avatarLevel').textContent = `Level ${this.realStats.level}`;
            
            // Update accessories display
            const accessoriesText = this.accessories.length > 0 
                ? this.accessories.map(a => this.getAccessoryEmoji(a)).join(' ')
                : '✨ No accessories yet';
            document.getElementById('avatarAccessories').textContent = accessoriesText;
            
            // Update member since from user data
            if (this.userData.createdAt) {
                document.getElementById('memberSince').textContent = new Date(this.userData.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
            
            // Update chat time display (convert minutes to hours/minutes)
            const totalMinutes = this.realStats.totalMinutesChatted;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const chatTimeDisplay = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}min`;
            const chatTimeElement = document.getElementById('chatTime');
            if (chatTimeElement) chatTimeElement.textContent = chatTimeDisplay;
            
            // Update messages sent
            const totalMessagesElem = document.getElementById('totalMessages');
            if (totalMessagesElem) totalMessagesElem.textContent = this.realStats.totalMessages;
        }
        
        getAccessoryEmoji(accessory) {
            const emojis = {
                'scarf': '✨',
                'hat': '🎩',
                'glasses': '👓',
                'crown': '👑'
            };
            return emojis[accessory] || '✨';
        }
        
        setupEventListeners() {
            // Avatar click to open customizer
            const avatarSection = document.querySelector('.avatar-section');
            if (avatarSection) {
                avatarSection.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('customize-avatar-btn')) {
                        openAvatarCustomizer();
                    }
                });
            }
        }
        
        saveAvatar() {
            const profile = {
                avatar: this.currentAvatar,
                accessories: this.accessories
            };
            localStorage.setItem('mysteryProfile', JSON.stringify(profile));
            this.updateProfileDisplay();
        }
    }
    
    // Global variables
    let profileManager;
    
    // Avatar Customizer Functions
    function openAvatarCustomizer() {
        document.getElementById('avatarCustomizer').style.display = 'flex';
        
        // Set current selections
        document.querySelectorAll('.animal-option').forEach(btn => {
            const animal = btn.getAttribute('data-animal');
            if (profileManager.currentAvatar === animal) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
        
        document.querySelectorAll('.accessory-option').forEach(btn => {
            const accessory = btn.getAttribute('data-accessory');
            if (profileManager.accessories.includes(accessory)) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
        
        // Update preview
        document.getElementById('avatarPreview').textContent = profileManager.currentAvatar;
    }
    
    function closeAvatarCustomizer() {
        document.getElementById('avatarCustomizer').style.display = 'none';
    }
    
    function selectAnimal(animal) {
        profileManager.currentAvatar = animal;
        
        // Update selected state
        document.querySelectorAll('.animal-option').forEach(btn => {
            if (btn.getAttribute('data-animal') === animal) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
        
        // Preview
        document.getElementById('avatarPreview').textContent = animal;
    }
    
    function toggleAccessory(accessory) {
        const index = profileManager.accessories.indexOf(accessory);
        if (index === -1) {
            profileManager.accessories.push(accessory);
        } else {
            profileManager.accessories.splice(index, 1);
        }
        
        // Update selected state
        document.querySelectorAll('.accessory-option').forEach(btn => {
            const btnAccessory = btn.getAttribute('data-accessory');
            if (profileManager.accessories.includes(btnAccessory)) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }
    
    function saveAvatar() {
        profileManager.saveAvatar();
        closeAvatarCustomizer();
        showNotification('Avatar updated! ✨', 'success');
    }
    
    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'success' ? '#48BB78' : '#E53E3E'};
            color: white;
            padding: 12px 24px;
            border-radius: 10px;
            z-index: 2000;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
    
    // Placeholder functions for future features
    function showChatTimeline() {
        showNotification('Timeline feature coming soon! 📊', 'info');
    }
    
    function showAchievements() {
        if (profileManager?.realStats) {
            const achievementCount = profileManager.realStats.achievements;
            showNotification(`You have ${achievementCount} achievements! 🏆`, 'success');
        } else {
            showNotification('Achievements gallery coming soon! 🏆', 'info');
        }
    }
    
    function showMysteryVault() {
        showNotification('Mystery Vault coming soon! 🔐', 'info');
    }
    
    function showConnectionMap() {
        showNotification('Connection Map coming soon! 🕸️', 'info');
    }
    
    function viewAllAchievements() {
        showAchievements();
    }
    
    function expandTimeline() {
        showChatTimeline();
    }
    
    // Auto-refresh stats every 30 seconds
    async function refreshProfileStats() {
        if (profileManager) {
            await profileManager.fetchRealStats();
            profileManager.updateProfileDisplay();
            console.log('🔄 Profile stats refreshed');
        }
    }
    
    // Initialize on page load
    document.addEventListener('DOMContentLoaded', () => {
        profileManager = new ProfileManager();
        
        // Auto-refresh every 30 seconds
        setInterval(refreshProfileStats, 30000);
    });