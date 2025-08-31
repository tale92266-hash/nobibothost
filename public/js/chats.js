const ChatModule = {
    chatMessages: [],
    maxMessages: 10,
    chatPaused: false,

    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Clear chat button
        const clearChatBtn = document.getElementById('clearChatBtn');
        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', () => {
                this.clearChat();
            });
        }

        // Pause/Resume chat button
        const pauseChatBtn = document.getElementById('pauseChatBtn');
        if (pauseChatBtn) {
            pauseChatBtn.addEventListener('click', () => {
                this.toggleChatPause();
            });
        }
    },

    handleNewMessage(messageData) {
        if (!this.chatPaused) {
            this.addChatMessage(messageData);
        }
    },

    handleChatHistory(historyMessages) {
        console.log('📜 Received chat history:', historyMessages.length, 'messages');
        
        // Clear current messages and load history
        this.chatMessages = [];
        
        // Reverse history (oldest first in array for chronological order)
        const reversedHistory = [...historyMessages].reverse();
        
        // Add history messages to current array
        reversedHistory.forEach(message => {
            this.chatMessages.push({
                id: Date.now() + Math.random(),
                sessionId: message.sessionId || 'unknown',
                senderName: message.senderName || '',
                userMessage: message.userMessage || '',
                botReply: message.botReply || '',
                timestamp: message.timestamp || new Date().toISOString()
            });
        });
        
        // Update display
        this.updateChatDisplay();
        
        // Scroll to bottom to show latest
        this.scrollToLatest();
        
        console.log('✅ Chat history loaded and displayed');
    },

    addChatMessage(messageData) {
        const { sessionId, userMessage, botReply, timestamp, senderName } = messageData;
        
        // Create message object
        const message = {
            id: Date.now() + Math.random(),
            sessionId: sessionId || 'unknown',
            senderName: senderName || '',
            userMessage: userMessage || '',
            botReply: botReply || '',
            timestamp: timestamp || new Date().toISOString()
        };
        
        // Add to end of array (newest at end)
        this.chatMessages.push(message);
        
        // Keep only last 10 messages
        if (this.chatMessages.length > this.maxMessages) {
            this.chatMessages = this.chatMessages.slice(-this.maxMessages);
        }
        
        // Update chat display
        this.updateChatDisplay();
        
        // Auto scroll to latest message (bottom)
        this.scrollToLatest();
    },

    updateChatDisplay() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        chatContainer.innerHTML = '';
        
        // Show messages in chronological order (oldest first, newest at bottom)
        this.chatMessages.forEach((message, index) => {
            const messageElement = this.createMessageElement(message, index);
            chatContainer.appendChild(messageElement);
        });
    },

    createMessageElement(message, index) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.style.animationDelay = `${index * 0.1}s`;
        
        // Use actual sender name if available
        const userName = message.senderName || this.getUserDisplayName(message.sessionId, message.senderName);
        const userAvatar = this.getUserAvatar(userName);
        const timeDisplay = this.formatTime(message.timestamp);
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="user-info">
                    <div class="user-avatar">${userAvatar}</div>
                    <span class="user-name">${this.escapeHtml(userName)}</span>
                </div>
                <span class="message-time">${timeDisplay}</span>
            </div>
            <div class="message-content">
                <div class="user-message">
                    <strong>User:</strong> ${this.escapeHtml(message.userMessage)}
                </div>
                <div class="bot-reply">
                    ${this.escapeHtml(message.botReply)}
                </div>
            </div>
        `;
        
        return messageDiv;
    },

    getUserDisplayName(sessionId, senderName) {
        // Prioritize actual sender name
        if (senderName && senderName.trim() !== '') {
            return senderName.trim();
        }
        
        // Fallback for anonymous users
        const prefix = 'User';
        const shortId = sessionId.substring(sessionId.length - 4).toUpperCase();
        return `${prefix}-${shortId}`;
    },

    getUserAvatar(userName) {
        if (!userName || userName === 'unknown') return '?';
        // Create avatar from actual name
        return userName.substring(0, 2).toUpperCase();
    },

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Now.';
        if (diffMins < 60) return `${diffMins} मिनट पहले`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} घंटे पहले`;
        
        return date.toLocaleTimeString('hi-IN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    scrollToLatest() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        chatContainer.classList.add('scrolling');
        
        // Scroll to bottom for newest messages
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        setTimeout(() => {
            chatContainer.classList.remove('scrolling');
        }, 500);
    },

    clearChat() {
        this.chatMessages = [];
        this.updateChatDisplay();
        UIModule.showToast('Chat cleared successfully', 'success');
    },

    toggleChatPause() {
        const pauseBtn = document.getElementById('pauseChatBtn');
        if (!pauseBtn) return;
        
        this.chatPaused = !this.chatPaused;
        
        if (this.chatPaused) {
            pauseBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
            pauseBtn.classList.remove('btn-outline-secondary');
            pauseBtn.classList.add('btn-outline-warning');
            UIModule.showToast('Chat paused', 'warning');
        } else {
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            pauseBtn.classList.remove('btn-outline-warning');
            pauseBtn.classList.add('btn-outline-secondary');
            UIModule.showToast('Chat resumed', 'success');
        }
    }
};
