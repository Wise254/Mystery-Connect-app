// Global functions for HTML onclick handlers - MUST be defined FIRST
let quickChat; // Declare globally

// Define global functions immediately
window.sendMessage = function() {
    console.log('🌐 Global sendMessage called');
    if (quickChat) {
        quickChat.sendMessage();
        quickChat.stopUserTyping();
    } else {
        console.error('❌ quickChat instance not found');
        alert('Chat not initialized yet. Please wait...');
    }
};

window.handleKeyDown = function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (quickChat) {
            quickChat.sendMessage();
            quickChat.stopUserTyping();
        }
    }
};

window.endChatEarly = function() {
    if (quickChat) {
        quickChat.endChatEarly();
    }
};

window.leaveQueue = function() {
    if (quickChat) {
        quickChat.leaveQueue();
    }
};

// Quick Chat JavaScript Class
class QuickChat {
    constructor() {
        this.socket = null;
        this.timerInterval = null;
        this.timeRemaining = 300; // 5 minutes in seconds
        this.isInChat = false;
        this.isInQueue = false;
        this.isTyping = false;
        this.typingTimeout = null;
        this.typingDebounce = null;
        this.partnerIsTyping = false;
        
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
            successAlert: document.getElementById('successAlert')
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 QuickChat initializing...');
        
        // Check authentication
        const token = localStorage.getItem('mysteryToken');
        const userData = JSON.parse(localStorage.getItem('mysteryUser') || '{}');
        
        if (!token || !userData.id) {
            this.showError('Please login first');
            setTimeout(() => window.location.href = 'auth.html', 2000);
            return;
        }
        
        this.setupTypingListeners();
        // Connect to Socket.io
        await this.connectSocket(token);
        
        // Start looking for a match automatically
        this.findQuickChat();
    }
    
    connectSocket(token) {
        return new Promise((resolve) => {
            // Connect to Socket.io server
            this.socket = io('http://localhost:3000', {
                auth: { token },
                transports: ['websocket', 'polling']
            });
            
            // Connection events
            this.socket.on('connect', () => {
                console.log('✅ Connected to quick chat server');
                resolve();
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('❌ Connection error:', error);
                this.showError('Connection failed. Please try again.');
            });
            
            // Quick chat events
            this.socket.on('waitingForMatch', this.handleWaitingForMatch.bind(this));
            this.socket.on('matchFound', this.handleMatchFound.bind(this));
            this.socket.on('newQuickMessage', this.handleNewMessage.bind(this));
            this.socket.on('chatEnded', this.handleChatEnded.bind(this));
            this.socket.on('alreadyInChat', this.handleAlreadyInChat.bind(this));
            this.socket.on('alreadyInQueue', this.handleAlreadyInQueue.bind(this));
            this.socket.on('leftQueue', this.handleLeftQueue.bind(this));
            this.socket.on('userTyping', this.handleTypingIndicator.bind(this));
            this.socket.on('error', this.handleSocketError.bind(this));
        });
    }
    
    // Event Handlers
    handleWaitingForMatch(data) {
        console.log('⏳ Waiting for match:', data);
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
        
        this.showSuccess('Looking for a match...');
    }
    
    handleMatchFound(data) {
        console.log('🤝 Match found:', data);
        this.isInQueue = false;
        this.isInChat = true;
        
        // Start timer
        this.timeRemaining = data.timeRemaining || 300;
        this.startTimer();
        
        // Switch to chat screen
        this.elements.waitingScreen.style.display = 'none';
        this.elements.chatScreen.style.display = 'flex';
        this.elements.chatEndedScreen.style.display = 'none';
        
        // Update partner info
        this.elements.partnerName.textContent = 'Mystery Partner';
        this.elements.partnerLevel.textContent = 'Level • Anonymous';
        this.elements.partnerStatus.textContent = `⏱️ ${Math.floor(this.timeRemaining / 60)}:${(this.timeRemaining % 60).toString().padStart(2, '0')} remaining`;
        
        // Update welcome message with time
        this.elements.welcomeMessage.textContent = `You've been matched! Chat will end in ${Math.floor(this.timeRemaining / 60)}:${(this.timeRemaining % 60).toString().padStart(2, '0')}.`;
        
        this.showSuccess('Match found! You can start chatting.');
    }
    
    handleNewMessage(data) {
        console.log('💬 New message:', data);
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.isOwn ? 'sent' : 'received'}`;
        
        // Message content
        const messageContent = document.createElement('div');
        messageContent.textContent = data.text;
        
        // Message time
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        const time = new Date(data.time);
        messageTime.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);
        
        this.elements.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        
        // Hide typing indicator
        this.elements.typingIndicator.style.display = 'none';
    }
    
    handleChatEnded(data) {
        console.log('⏰ Chat ended:', data);
        this.isInChat = false;
        this.isInQueue = false;
        
        // Clear timer
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
        }
        
        // Stop any ongoing typing indicators
        this.elements.typingIndicator.style.display = 'none';
        
        // Switch to ended screen
        this.elements.waitingScreen.style.display = 'none';
        this.elements.chatScreen.style.display = 'none';
        this.elements.chatEndedScreen.style.display = 'block';
        
        // Set reason message
        let reasonMessage = '';
        switch (data.reason) {
          case 'time_up':
            reasonMessage = '⏰ Time\'s up! Your 5-minute chat has ended.';
            break;
          case 'partner_left':
            reasonMessage = '👋 Your chat partner left the conversation.';
            break;
          case 'partner_disconnected':
            reasonMessage = '🔌 Your chat partner disconnected.';
            break;
          case 'you_left':
            reasonMessage = '🚪 You ended the chat.';
            break;
          default:
            reasonMessage = '💬 The chat has ended.';
        }
        
        // Add duration if available
        if (data.duration) {
          const minutes = Math.floor(data.duration / 60000);
          const seconds = Math.floor((data.duration % 60000) / 1000);
          reasonMessage += `\n⏱️ Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Add points earned (you can implement this later)
        reasonMessage += `\n✨ You earned 10 points!`;
        
        this.elements.chatEndedReason.textContent = reasonMessage;
        
        // Show success message
        this.showSuccess('Chat ended! Redirecting to dashboard...');
        
        // Disable message input
        this.elements.messageInput.disabled = true;
        this.elements.sendBtn.disabled = true;
        this.elements.endChatBtn.disabled = true;
        
        // Auto-redirect to dashboard after 5 seconds
        setTimeout(() => {
          this.showSuccess('Redirecting to dashboard...');
          
          // Disconnect socket
          if (this.socket) {
            this.socket.disconnect();
          }
          
          // Redirect to dashboard
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 1500);
          
        }, 5000); // Show ended screen for 5 seconds before redirect
      }
    
    handleAlreadyInChat(data) {
        console.log('⚠️ Already in chat');
        this.showError(data.message || 'You are already in a chat!');
        
        // If time remaining is provided, redirect to chat
        if (data.timeRemaining && data.timeRemaining > 0) {
            setTimeout(() => {
                // We could automatically join the existing chat
                // For now, just inform the user
                alert('You are already in a chat! Please finish that chat first.');
            }, 1000);
        }
    }
    
    handleAlreadyInQueue(data) {
        console.log('⚠️ Already in queue');
        this.isInQueue = true;
        this.showInfo('You are already in the queue for a chat.');
        
        if (data.position) {
            this.elements.queuePosition.textContent = data.position;
        }
    }
    
    handleLeftQueue(data) {
        console.log('👋 Left queue');
        this.isInQueue = false;
        this.showSuccess(data.message || 'You left the queue');
        this.elements.waitingScreen.style.display = 'none';
        
        // Redirect back to dashboard after a delay
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
    
    setupTypingListeners() {
        const messageInput = this.elements.messageInput;
        if (!messageInput) return;
        
        // Listen for typing with debounce
        messageInput.addEventListener('input', (e) => {
            this.handleUserTyping(e.target.value);
        });
        
        // Stop typing when input loses focus
        messageInput.addEventListener('blur', () => {
            this.stopUserTyping();
        });
        
        // Stop typing when send button is clicked
        this.elements.sendBtn.addEventListener('click', () => {
            this.stopUserTyping();
        });
    }
    
    handleUserTyping(text) {
        // Only send typing events if in chat
        if (!this.isInChat || !this.socket) return;
        
        // Debounce typing events
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
        
        // Clear existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        // Auto-stop typing after 2 seconds of inactivity
        this.typingTimeout = setTimeout(() => {
            this.stopUserTyping();
        }, 2000);
    }
    
    startUserTyping() {
        if (!this.isTyping && this.socket && this.isInChat) {
            this.isTyping = true;
            this.socket.emit('typing', {
                isTyping: true,
                timestamp: Date.now()
            });
            console.log('👆 Started typing indicator');
        }
    }
    
    stopUserTyping() {
        if (this.isTyping && this.socket && this.isInChat) {
            this.isTyping = false;
            this.socket.emit('typing', {
                isTyping: false,
                timestamp: Date.now()
            });
            console.log('✋ Stopped typing indicator');
        }
        
        // Clear timeouts
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
    }
    
    handleSocketError(data) {
        console.error('Socket error:', data);
        this.showError(data.message || 'An error occurred');
    }
    
    // Timer functions
    startTimer() {
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
          this.timeRemaining--;
          this.updateTimerDisplay();
          
          // If timer reaches 0, force chat end on frontend
          if (this.timeRemaining <= 0) {
            clearInterval(this.timerInterval);
            this.elements.timer.textContent = '00:00';
            
            // Force chat end if server hasn't sent event
            setTimeout(() => {
              if (this.isInChat) {
                console.log('⏰ Frontend timer expired, forcing chat end');
                this.handleChatEnded({
                  reason: 'time_up',
                  message: 'Chat time has ended!',
                  duration: 300000 // 5 minutes
                });
              }
            }, 2000); // Wait 2 seconds for server event
          }
        }, 1000);
      }
    
    updateTimerDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        this.elements.timer.textContent = timeString;
        this.elements.partnerStatus.textContent = `⏱️ ${timeString} remaining`;
        
        // Update timer color based on remaining time
        this.elements.timer.className = 'timer';
        if (this.timeRemaining <= 60) {
            this.elements.timer.classList.add('danger');
        } else if (this.timeRemaining <= 120) {
            this.elements.timer.classList.add('warning');
        }
    }
    
    // Actions
    findQuickChat() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Not connected to server');
            return;
        }
        
        if (this.isInChat) {
            this.showError('You are already in a chat!');
            return;
        }
        
        console.log('🎯 Finding quick chat...');
        this.socket.emit('findQuickChat');
        this.showInfo('Looking for a match...');
    }
    
    leaveQueue() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Not connected to server');
            return;
        }
        
        if (!this.isInQueue) {
            this.showError('You are not in a queue');
            return;
        }
        
        console.log('🚪 Leaving queue...');
        this.socket.emit('leaveQueue');
    }
    
    sendMessage() {
        console.log('📤 Send message called');
        console.log('Socket connected?', this.socket?.connected);
        console.log('Is in chat?', this.isInChat);
        
        if (!this.socket || !this.socket.connected) {
            console.log('❌ Not connected to server');
            this.showError('Not connected to server');
            return;
        }
        
        if (!this.isInChat) {
            console.log('❌ Not in a chat');
            this.showError('You are not in a chat');
            return;
        }
        
        const message = this.elements.messageInput.value.trim();
        console.log('Message content:', message);
        
        if (!message) {
            console.log('❌ Empty message');
            return;
        }
        
        // Send message via Socket.io
        console.log('📨 Emitting quickChatMessage event');
        this.socket.emit('quickChatMessage', {
            text: message
        });
        
        // Clear input
        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';
        
        // Send typing stopped
        this.socket.emit('typing', { isTyping: false });
        
        console.log('✅ Message sent successfully');
    }
    
    endChatEarly() {
        if (!this.socket || !this.socket.connected) {
            this.showError('Not connected to server');
            return;
        }
        
        if (!this.isInChat) {
            this.showError('You are not in a chat');
            return;
        }
        
        if (confirm('Are you sure you want to end the chat early?')) {
            console.log('👋 Ending chat early...');
            this.socket.emit('endChatEarly');
        }
    }
    
    // UI Helpers
    showError(message) {
        this.elements.errorAlert.textContent = message;
        this.elements.errorAlert.style.display = 'block';
        this.elements.successAlert.style.display = 'none';
        
        setTimeout(() => {
            this.elements.errorAlert.style.display = 'none';
        }, 5000);
    }
    
    showSuccess(message) {
        this.elements.successAlert.textContent = message;
        this.elements.successAlert.style.display = 'block';
        this.elements.errorAlert.style.display = 'none';
        
        setTimeout(() => {
            this.elements.successAlert.style.display = 'none';
        }, 5000);
    }
    
    showInfo(message) {
        // For now, use success style for info
        this.showSuccess(message);
    }
}

// Auto-resize textarea
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 DOM loaded, initializing QuickChat...');
    
    const textarea = document.getElementById('messageInput');
    if (textarea) {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }
    
    // Initialize Quick Chat when page loads
    quickChat = new QuickChat();
});