// Global functions for HTML onclick handlers
let deepChat; // Declare globally

// Define global functions immediately
window.handleKeyDown = function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (deepChat) {
            deepChat.sendMessage();
            deepChat.stopUserTyping();
        }
    }
};

// Deep Chat JavaScript Class
class DeepChat {
    constructor() {
        this.socket = null;
        this.timerInterval = null;
        this.silenceCheckInterval = null; // 🔧 ADDED
        this.timeRemaining = 3600; // 60 minutes in seconds
        this.isInChat = false;
        this.isInQueue = false;
        this.isTyping = false;
        this.typingTimeout = null;
        this.typingDebounce = null;
        this.partnerIsTyping = false;
        this.hasReached30Min = false;
        this.queueTimeout = null;
        this.currentPartnerId = null;
        this.lastMessageTime = null; // 🔧 ADDED: Track for silence detection
        this.hintsEnabled = true; // 🔧 ADDED
        this.unlockedExplore = false; // 🔧 ADDED: Track if Explore was unlocked
        
        // DOM Elements
        this.elements = {
            waitingScreen: document.getElementById('waitingScreen'),
            chatScreen: document.getElementById('chatScreen'),
            chatEndedScreen: document.getElementById('chatEndedScreen'),
            timer: document.getElementById('timer'),
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            queueInfo: document.getElementById('queueInfo'),
            queuePosition: document.getElementById('queuePosition'),
            estimatedWait: document.getElementById('estimatedWait'),
            leaveQueueBtn: document.getElementById('leaveQueueBtn'),
            endChatBtn: document.getElementById('endChatBtn'),
            partnerAvatar: document.getElementById('partnerAvatar'),
            partnerName: document.getElementById('partnerName'),
            partnerLevel: document.getElementById('partnerLevel'),
            partnerStatus: document.getElementById('partnerStatus'),
            typingIndicator: document.getElementById('typingIndicator'),
            typingUser: document.getElementById('typingUser'),
            chatEndedReason: document.getElementById('chatEndedReason'),
            welcomeMessage: document.getElementById('welcomeMessage'),
            errorAlert: document.getElementById('errorAlert'),
            successAlert: document.getElementById('successAlert'),
            infoAlert: document.getElementById('infoAlert'),
            endedIcon: document.getElementById('endedIcon'),
            endedTitle: document.getElementById('endedTitle'),
            endedButtons: document.getElementById('endedButtons')
        };
        
        // 🔧 ADDED: Create hint popup element
        this.createHintPopup();
        
        this.init();
    }
    
    // 🔧 ADDED: Create hint popup element
    createHintPopup() {
        this.hintPopup = document.createElement('div');
        this.hintPopup.className = 'hint-popup';
        this.hintPopup.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, rgba(107, 70, 193, 0.95), rgba(139, 92, 246, 0.95));
            color: white;
            padding: 15px 25px;
            border-radius: 50px;
            font-size: 1rem;
            box-shadow: 0 10px 30px rgba(107, 70, 193, 0.5);
            border: 1px solid #D69E2E;
            z-index: 1000;
            display: none;
            max-width: 400px;
            text-align: center;
            animation: hintSlideUp 0.5s ease;
            cursor: pointer;
            backdrop-filter: blur(5px);
        `;
        
        // Add animation style
        const style = document.createElement('style');
        style.textContent = `
            @keyframes hintSlideUp {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }
            @keyframes hintSlideDown {
                from {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(-50%) translateY(20px);
                }
            }
            .hint-popup:hover {
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(167, 139, 250, 0.95));
                transform: translateX(-50%) scale(1.02);
                transition: all 0.3s ease;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(this.hintPopup);
        
        // 🔧 ADDED: Click to dismiss
        this.hintPopup.addEventListener('click', () => {
            this.hideHint();
        });
    }
    
    // 🔧 ADDED: Show hint popup
    showHint(hint, category = 'general', reason = 'auto') {
        if (!this.hintsEnabled || !this.isInChat) return;
        
        const emoji = category === 'deep' ? '💭' : category === 'fun' ? '😄' : category === 'funny' ? '😂' : '💡';
        const reasonText = reason === 'silence' ? 'Conversation paused? ' : '';
        
        this.hintPopup.innerHTML = `${emoji} ${reasonText}<strong>Hint:</strong> ${hint}`;
        this.hintPopup.style.display = 'block';
        this.hintPopup.style.animation = 'hintSlideUp 0.5s ease';
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            this.hideHint();
        }, 8000);
    }
    
    // 🔧 ADDED: Hide hint popup
    hideHint() {
        if (this.hintPopup) {
            this.hintPopup.style.animation = 'hintSlideDown 0.3s ease';
            setTimeout(() => {
                this.hintPopup.style.display = 'none';
            }, 300);
        }
    }
    
    async init() {
        console.log('🌊 DeepChat initializing...');
        
        // Check authentication
        const token = localStorage.getItem('mysteryToken');
        const userData = JSON.parse(localStorage.getItem('mysteryUser') || '{}');
        
        if (!token || !userData.id) {
            this.showError('Please login first');
            setTimeout(() => window.location.href = 'auth.html', 2000);
            return;
        }
        
        // Update user avatar
        if (userData.avatar) {
            document.getElementById('userAvatar').textContent = userData.avatar;
        }
        
        this.setupTypingListeners();
        
        // Connect to Socket.io
        await this.connectSocket(token);
        
        // Start looking for a match automatically
        this.findDeepChat();
    }
    
    connectSocket(token) {
        return new Promise((resolve) => {
            this.socket = io('http://localhost:3000', {
                auth: { token },
                transports: ['websocket', 'polling']
            });
            
            this.socket.on('connect', () => {
                console.log('✅ Connected to deep chat server');
                resolve();
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('❌ Connection error:', error);
                this.showError('Connection failed. Please try again.');
            });
            
            // Deep chat events
            this.socket.on('deepWaitingForMatch', this.handleWaitingForMatch.bind(this));
            this.socket.on('deepMatchFound', this.handleMatchFound.bind(this));
            this.socket.on('newDeepMessage', this.handleNewMessage.bind(this));
            this.socket.on('deepChatEnded', this.handleChatEnded.bind(this));
            this.socket.on('deepAlreadyInChat', this.handleAlreadyInChat.bind(this));
            this.socket.on('deepAlreadyInQueue', this.handleAlreadyInQueue.bind(this));
            this.socket.on('deepLeftQueue', this.handleLeftQueue.bind(this));
            this.socket.on('deepUserTyping', this.handleTypingIndicator.bind(this));
            this.socket.on('deepRequeued', this.handleRequeued.bind(this));
            this.socket.on('deep30MinMilestone', this.handle30MinMilestone.bind(this));
            // 🔧 ADDED: New events
            this.socket.on('conversationHint', this.handleConversationHint.bind(this));
            this.socket.on('exploreUnlocked', this.handleExploreUnlocked.bind(this));
            this.socket.on('error', this.handleSocketError.bind(this));
        });
    }
    
    // 🔧 ADDED: Handle conversation hint from server
    handleConversationHint(data) {
        console.log('💡 Received hint:', data);
        this.showHint(data.hint, data.category, data.reason);
    }
    
    // 🔧 ADDED: Handle Explore unlock event
    handleExploreUnlocked(data) {
        console.log('🎉 Explore unlocked!', data);
        this.unlockedExplore = true;
        
        // Show celebration message
        this.addSystemMessage(`🎉 ${data.message || 'Explore page unlocked! +100 points!'}`, 'success');
        
        // Show success alert
        this.showSuccess(`Explore unlocked! +${data.pointsEarned || 100} points!`);
    }
    
    handleWaitingForMatch(data) {
        console.log('⏳ Waiting for deep match:', data);
        this.isInQueue = true;
        
        this.elements.waitingScreen.style.display = 'block';
        this.elements.chatScreen.style.display = 'none';
        this.elements.chatEndedScreen.style.display = 'none';
        this.elements.queueInfo.style.display = 'block';
        
        if (data.positionInQueue !== undefined) {
            this.elements.queuePosition.textContent = data.positionInQueue;
        }
        if (data.estimatedWait !== undefined) {
            this.elements.estimatedWait.textContent = data.estimatedWait;
        }
        
        if (this.queueTimeout) clearTimeout(this.queueTimeout);
        this.queueTimeout = setTimeout(() => {
            if (this.isInQueue && !this.isInChat) {
                this.showInfo('No partner found yet. You can keep waiting or cancel.');
                this.elements.estimatedWait.textContent = 'Still searching...';
            }
        }, 120000);
        
        this.showInfo('Looking for a deep conversation partner...');
    }
    
    handleMatchFound(data) {
        console.log('🤝 Deep match found:', data);
        this.isInQueue = false;
        this.isInChat = true;
        this.hasReached30Min = false;
        this.unlockedExplore = false;
        this.currentPartnerId = data.partnerId;
        this.lastMessageTime = Date.now(); // 🔧 ADDED
        
        if (this.queueTimeout) {
            clearTimeout(this.queueTimeout);
            this.queueTimeout = null;
        }
        
        this.timeRemaining = data.timeRemaining || 3600;
        this.startTimer();
        
        // 🔧 ADDED: Start silence check interval
        this.startSilenceCheck();
        
        this.elements.waitingScreen.style.display = 'none';
        this.elements.chatScreen.style.display = 'flex';
        this.elements.chatEndedScreen.style.display = 'none';
        
        this.elements.partnerName.textContent = 'Mystery Partner';
        this.elements.partnerLevel.textContent = 'Level • Anonymous';
        this.elements.partnerStatus.textContent = `🌊 ${this.formatTime(this.timeRemaining)} remaining`;
        
        const minutes = Math.floor(this.timeRemaining / 60);
        this.elements.welcomeMessage.innerHTML = `
            🌊 <strong>You've been matched!</strong> You have ${minutes} minutes for a deep conversation.
            <br><br>
            💡 <strong>Tip:</strong> Chat for 30+ minutes to unlock Explore and earn 100 points!
            <br>
            💭 <strong>Hint:</strong> Stuck? Click the hint button or wait for conversation suggestions!
        `;
        
        // 🔧 ADDED: Add hint request button to chat header
        this.addHintButton();
        
        this.showSuccess('Match found! Enjoy your deep conversation.');
    }
    
    // 🔧 ADDED: Add hint button to UI
    addHintButton() {
        const headerRight = document.querySelector('.header-right');
        if (headerRight && !document.getElementById('requestHintBtn')) {
            const hintBtn = document.createElement('button');
            hintBtn.id = 'requestHintBtn';
            hintBtn.className = 'end-chat-btn';
            hintBtn.style.background = 'rgba(107, 70, 193, 0.2)';
            hintBtn.style.color = '#D69E2E';
            hintBtn.style.border = '1px solid #6B46C1';
            hintBtn.style.marginRight = '10px';
            hintBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Hint';
            hintBtn.onclick = () => this.requestHint();
            headerRight.insertBefore(hintBtn, this.elements.endChatBtn);
        }
    }
    
    // 🔧 ADDED: Remove hint button
    removeHintButton() {
        const hintBtn = document.getElementById('requestHintBtn');
        if (hintBtn) hintBtn.remove();
    }
    
    // 🔧 ADDED: Request a hint manually
    requestHint() {
        if (this.socket && this.isInChat) {
            this.socket.emit('requestHint');
            this.showInfo('Requesting conversation hint...');
        }
    }
    
    // 🔧 ADDED: Start silence check
    startSilenceCheck() {
        this.silenceCheckInterval = setInterval(() => {
            if (this.isInChat && this.lastMessageTime) {
                const silenceDuration = Date.now() - this.lastMessageTime;
                // If silence for more than 90 seconds, show a gentle nudge
                if (silenceDuration > 90000 && silenceDuration < 120000) {
                    this.showInfo('Conversation seems quiet. Try asking a question!');
                }
            }
        }, 30000);
    }
    
    handleNewMessage(data) {
        console.log('💬 New deep message:', data);
        
        this.lastMessageTime = Date.now(); // 🔧 ADDED
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.isOwn ? 'sent' : 'received'}`;
        
        const messageContent = document.createElement('div');
        messageContent.textContent = data.text;
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        const time = new Date(data.time);
        messageTime.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);
        
        this.elements.chatMessages.appendChild(messageDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        
        this.elements.typingIndicator.style.display = 'none';
    }
    
    // 🔧 FIXED: Complete chat ended handler with proper rewards
    handleChatEnded(data) {
        console.log('⏰ Deep chat ended:', data);
        this.isInChat = false;
        this.isInQueue = false;
        this.hintsEnabled = false;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        // 🔧 ADDED: Clear silence check interval
        if (this.silenceCheckInterval) {
            clearInterval(this.silenceCheckInterval);
        }
        
        this.elements.typingIndicator.style.display = 'none';
        this.removeHintButton();
        this.hideHint();
        
        this.elements.waitingScreen.style.display = 'none';
        this.elements.chatScreen.style.display = 'none';
        this.elements.chatEndedScreen.style.display = 'block';
        
        // 🔧 FIXED: Use proper reward logic
        const earnedRewards = data.reached30Min === true;
        const completed = data.completed === true;
        const unlockedExplore = data.unlockedExplore === true || this.unlockedExplore;
        
        let reasonMessage = '';
        let icon = '⏰';
        let title = 'Chat Ended';
        let showExploreButton = unlockedExplore;
        let pointsMessage = '';
        
        if (completed) {
            icon = '🎉';
            title = 'Deep Dive Complete!';
            pointsMessage = '\n\n✨ You earned 100 points!';
            reasonMessage = '🎉 Congratulations! You completed the full 60-minute Deep Dive.';
            if (unlockedExplore) {
                reasonMessage += '\n🔓 Explore page unlocked!';
            }
        } else if (earnedRewards) {
            icon = '🏆';
            title = 'Milestone Reached!';
            pointsMessage = '\n\n✨ You earned 100 points!';
            reasonMessage = '🏆 You reached the 30-minute milestone!';
            if (unlockedExplore) {
                reasonMessage += '\n🔓 Explore page unlocked!';
            }
        } else {
            switch (data.reason) {
                case 'time_up':
                    reasonMessage = '⏰ Time\'s up! Your 60-minute Deep Dive has ended.\n\n⚠️ You needed 30 minutes to earn rewards.';
                    break;
                case 'partner_left':
                    reasonMessage = '👋 Your conversation partner left the Deep Dive.';
                    break;
                case 'partner_disconnected':
                    reasonMessage = '🔌 Your partner disconnected.';
                    break;
                case 'you_left':
                    reasonMessage = '🚪 You ended the Deep Dive early.\n\n⚠️ You need to chat for at least 30 minutes to earn rewards.';
                    break;
                default:
                    reasonMessage = '💬 The Deep Dive has ended.';
            }
        }
        
        reasonMessage += pointsMessage;
        
        // Add duration
        if (data.durationMinutes) {
            reasonMessage += `\n⏱️ Duration: ${data.durationMinutes} minutes`;
        } else if (data.duration) {
            const minutes = Math.floor(data.duration / 60000);
            const seconds = Math.floor((data.duration % 60000) / 1000);
            reasonMessage += `\n⏱️ Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        this.elements.endedIcon.textContent = icon;
        this.elements.endedTitle.textContent = title;
        this.elements.chatEndedReason.textContent = reasonMessage;
        
        this.elements.endedButtons.innerHTML = '';
        
        const dashboardBtn = document.createElement('button');
        dashboardBtn.className = 'back-to-dashboard-btn';
        dashboardBtn.innerHTML = '<i class="fas fa-home"></i> Back to Dashboard';
        dashboardBtn.onclick = () => {
            window.location.href = 'dashboard.html';
        };
        this.elements.endedButtons.appendChild(dashboardBtn);
        
        if (showExploreButton) {
            const exploreBtn = document.createElement('button');
            exploreBtn.className = 'go-to-explore-btn';
            exploreBtn.innerHTML = '<i class="fas fa-globe"></i> Go to Explore';
            exploreBtn.onclick = () => {
                window.location.href = 'explore.html';
            };
            this.elements.endedButtons.appendChild(exploreBtn);
        }
        
        this.elements.messageInput.disabled = true;
        this.elements.sendBtn.disabled = true;
        this.elements.endChatBtn.disabled = true;
        
        if (!completed && !earnedRewards) {
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 8000);
        }
        
        if (this.socket) {
            this.socket.disconnect();
        }
    }
    
    handleRequeued(data) {
        console.log('🔄 Requeued after partner left:', data);
        this.isInChat = false;
        this.currentPartnerId = null;
        this.removeHintButton();
        this.hideHint();
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        if (this.silenceCheckInterval) {
            clearInterval(this.silenceCheckInterval);
        }
        
        this.addSystemMessage('Your partner left the conversation. Looking for a new partner...');
        
        this.elements.waitingScreen.style.display = 'block';
        this.elements.chatScreen.style.display = 'none';
        
        this.timeRemaining = 3600;
        this.elements.timer.textContent = '60:00';
        
        this.showInfo('Partner left. Finding a new match for you...');
        
        setTimeout(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('findDeepChat');
            }
        }, 1000);
    }
    
    handle30MinMilestone(data) {
        console.log('🎉 30-minute milestone reached!');
        this.hasReached30Min = true;
        
        this.addSystemMessage('🎉 Congratulations! You\'ve reached the 30-minute milestone! +100 points! Explore page unlocked! 🎉', 'success');
        
        this.elements.timer.classList.add('milestone');
        setTimeout(() => {
            this.elements.timer.classList.remove('milestone');
        }, 1000);
        
        // 🔧 ADDED: Show celebration hint
        this.showHint('Amazing! You\'ve unlocked the Explore page! Keep chatting or head to Explore!', 'success', 'milestone');
        
        this.showSuccess('30-minute milestone reached! +100 points! Explore unlocked!');
    }
    
    handleAlreadyInChat(data) {
        console.log('⚠️ Already in deep chat');
        this.showError(data.message || 'You are already in a Deep Dive!');
    }
    
    handleAlreadyInQueue(data) {
        console.log('⚠️ Already in deep queue');
        this.isInQueue = true;
        this.showInfo('You are already in the queue for a Deep Dive.');
        
        if (data.position) {
            this.elements.queuePosition.textContent = data.position;
        }
    }
    
    handleLeftQueue(data) {
        console.log('👋 Left deep queue');
        this.isInQueue = false;
        
        if (this.queueTimeout) {
            clearTimeout(this.queueTimeout);
            this.queueTimeout = null;
        }
        
        this.showSuccess(data.message || 'You left the queue');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
    }
    
    handleTypingIndicator(data) {
        if (data.isTyping) {
            this.elements.typingUser.textContent = data.username || 'Partner';
            this.elements.typingIndicator.style.display = 'block';
            this.partnerIsTyping = true;
        } else {
            this.elements.typingIndicator.style.display = 'none';
            this.partnerIsTyping = false;
        }
    }
    
    handleSocketError(data) {
        console.error('Socket error:', data);
        this.showError(data.message || 'An error occurred');
    }
    
    setupTypingListeners() {
        const messageInput = this.elements.messageInput;
        if (!messageInput) return;
        
        messageInput.addEventListener('input', (e) => {
            this.handleUserTyping(e.target.value);
        });
        
        messageInput.addEventListener('blur', () => {
            this.stopUserTyping();
        });
        
        this.elements.sendBtn.addEventListener('click', () => {
            this.stopUserTyping();
        });
    }
    
    handleUserTyping(text) {
        if (!this.isInChat || !this.socket) return;
        
        if (this.typingDebounce) {
            clearTimeout(this.typingDebounce);
        }
        
        this.typingDebounce = setTimeout(() => {
            if (text.trim().length > 0) {
                this.startUserTyping();
            } else {
                this.stopUserTyping();
            }
        }, 300);
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        this.typingTimeout = setTimeout(() => {
            this.stopUserTyping();
        }, 2000);
    }
    
    startUserTyping() {
        if (!this.isTyping && this.socket && this.isInChat) {
            this.isTyping = true;
            this.socket.emit('deepTyping', {
                isTyping: true,
                timestamp: Date.now()
            });
        }
    }
    
    stopUserTyping() {
        if (this.isTyping && this.socket && this.isInChat) {
            this.isTyping = false;
            this.socket.emit('deepTyping', {
                isTyping: false,
                timestamp: Date.now()
            });
        }
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
    }
    
    addSystemMessage(text, type = 'normal') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `system-message ${type === 'success' ? 'success' : ''}`;
        messageDiv.innerHTML = text;
        this.elements.chatMessages.appendChild(messageDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
    
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    startTimer() {
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            // Check for 30-minute milestone (1800 seconds)
            if (!this.hasReached30Min && this.timeRemaining <= 1800 && this.isInChat) {
                this.hasReached30Min = true;
                this.socket.emit('deepReached30Min');
                this.handle30MinMilestone({});
            }
            
            if (this.timeRemaining <= 0) {
                clearInterval(this.timerInterval);
                this.elements.timer.textContent = '00:00';
                
                setTimeout(() => {
                    if (this.isInChat) {
                        console.log('⏰ Frontend timer expired, forcing chat end');
                        this.handleChatEnded({
                            reason: 'time_up',
                            completed: true,
                            reached30Min: true,
                            unlockedExplore: this.hasReached30Min,
                            durationMinutes: 60
                        });
                    }
                }, 2000);
            }
        }, 1000);
    }
    
    updateTimerDisplay() {
        const timeString = this.formatTime(this.timeRemaining);
        this.elements.timer.textContent = timeString;
        this.elements.partnerStatus.textContent = `🌊 ${timeString} remaining`;
        
        this.elements.timer.className = 'timer';
        if (this.timeRemaining <= 60) {
            this.elements.timer.classList.add('danger');
        } else if (this.timeRemaining <= 300) {
            this.elements.timer.classList.add('warning');
        }
    }
    
    findDeepChat() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Not connected to server');
            return;
        }
        
        if (this.isInChat) {
            this.showError('You are already in a Deep Dive!');
            return;
        }
        
        console.log('🌊 Finding deep chat...');
        this.socket.emit('findDeepChat');
        this.showInfo('Looking for a deep conversation partner...');
    }
    
    leaveQueue() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Not connected to server');
            return;
        }
        
        if (!this.isInQueue) {
            this.showError('You are not in the queue');
            return;
        }
        
        console.log('🚪 Leaving deep queue...');
        this.socket.emit('leaveDeepQueue');
    }
    
    sendMessage() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Not connected to server');
            return;
        }
        
        if (!this.isInChat) {
            this.showError('You are not in a Deep Dive');
            return;
        }
        
        const message = this.elements.messageInput.value.trim();
        
        if (!message) return;
        
        this.lastMessageTime = Date.now(); // 🔧 ADDED
        
        this.socket.emit('deepChatMessage', {
            text: message
        });
        
        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';
        this.socket.emit('deepTyping', { isTyping: false });
    }
    
    endChatEarly() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Not connected to server');
            return;
        }
        
        if (!this.isInChat) {
            this.showError('You are not in a Deep Dive');
            return;
        }
        
        let warningMsg = 'Are you sure you want to end the Deep Dive early?\n\n';
        if (!this.hasReached30Min) {
            warningMsg += '⚠️ WARNING: You have not reached the 30-minute minimum.\n';
            warningMsg += 'You will NOT earn any rewards and will NOT unlock the Explore page.\n\n';
        }
        warningMsg += 'Click OK to end the conversation.';
        
        if (confirm(warningMsg)) {
            console.log('👋 Ending deep chat early...');
            this.socket.emit('endDeepChatEarly');
        }
    }
    
    showError(message) {
        this.elements.errorAlert.textContent = message;
        this.elements.errorAlert.style.display = 'block';
        setTimeout(() => {
            this.elements.errorAlert.style.display = 'none';
        }, 5000);
    }
    
    showSuccess(message) {
        this.elements.successAlert.textContent = message;
        this.elements.successAlert.style.display = 'block';
        setTimeout(() => {
            this.elements.successAlert.style.display = 'none';
        }, 5000);
    }
    
    showInfo(message) {
        this.elements.infoAlert.textContent = message;
        this.elements.infoAlert.style.display = 'block';
        setTimeout(() => {
            this.elements.infoAlert.style.display = 'none';
        }, 5000);
    }
}

// Auto-resize textarea and initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 DOM loaded, initializing DeepChat...');
    
    const textarea = document.getElementById('messageInput');
    if (textarea) {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }
    
    deepChat = new DeepChat();
});