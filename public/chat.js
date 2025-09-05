// file: public/chat.js

let chatMessages = [];
let maxMessages = 10;
let chatPaused = false;

const chatMessagesContainer = document.getElementById('chatMessages');
const clearChatBtn = document.getElementById('clearChatBtn');
const pauseChatBtn = document.getElementById('pauseChatBtn');

/**
 * Initializes the chat functionality and sets up event listeners.
 */
function initChat() {
    const socket = io();

    socket.on('connect', () => {
        console.log('Connected to server via Socket.IO');
    });

    socket.on('newMessage', (data) => {
        if (!chatPaused) {
            addChatMessage(data);
        }
    });

    socket.on('chatHistory', (historyMessages) => {
        console.log('📜 Received chat history:', historyMessages.length, 'messages');
        chatMessages = [];
        const reversedHistory = [...historyMessages].reverse();
        reversedHistory.forEach(message => {
            chatMessages.push({
                id: Date.now() + Math.random(),
                sessionId: message.sessionId || 'unknown',
                senderName: message.senderName || '',
                groupName: message.groupName || null,
                userMessage: message.userMessage || '',
                botReply: message.botReply || '',
                timestamp: message.timestamp || new Date().toISOString()
            });
        });
        updateChatDisplay();
        scrollToLatest();
        console.log('✅ Chat history loaded and displayed');
    });

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearChat);
    }

    if (pauseChatBtn) {
        pauseChatBtn.addEventListener('click', toggleChatPause);
    }
}

/**
 * Adds a new message to the chat display.
 * @param {object} messageData - The new message data.
 */
function addChatMessage(messageData) {
    const { sessionId, userMessage, botReply, timestamp, senderName, groupName } = messageData;
    const message = {
        id: Date.now() + Math.random(),
        sessionId: sessionId || 'unknown',
        senderName: senderName || '',
        groupName: groupName || null,
        userMessage: userMessage || '',
        botReply: botReply || '',
        timestamp: timestamp || new Date().toISOString()
    };
    
    chatMessages.push(message);
    if (chatMessages.length > maxMessages) {
        chatMessages = chatMessages.slice(-maxMessages);
    }
    updateChatDisplay();
    scrollToLatest();
}

/**
 * Renders the chat messages to the DOM.
 */
function updateChatDisplay() {
    if (!chatMessagesContainer) return;
    chatMessagesContainer.innerHTML = '';
    chatMessages.forEach((message, index) => {
        const messageElement = createMessageElement(message, index);
        chatMessagesContainer.appendChild(messageElement);
    });
}

/**
 * Creates a single message DOM element.
 * @param {object} message - The message object.
 * @param {number} index - The index of the message.
 * @returns {HTMLElement} The created message element.
 */
function createMessageElement(message, index) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.style.animationDelay = `${index * 0.1}s`;

    const userName = message.senderName || getUserDisplayName(message.sessionId);
    const userAvatar = getUserAvatar(userName);
    const timeDisplay = formatTime(message.timestamp);
    
    let botReplyText = `Reply sent to ${escapeHtml(userName)}`;
    if (message.groupName) {
        botReplyText += ` in ${escapeHtml(message.groupName)} GC`;
    }

    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="user-info">
                <div class="user-avatar">${userAvatar}</div>
                <div class="user-name">${escapeHtml(userName)}</div>
            </div>
            <div class="message-time">${timeDisplay}</div>
        </div>
        <div class="message-content">
            <div class="user-message">
                <strong>User:</strong> ${escapeHtml(message.userMessage)}
            </div>
            <div class="bot-reply">
                ${botReplyText}
            </div>
        </div>
    `;
    return messageDiv;
}

/**
 * Scrolls the chat container to the bottom.
 */
function scrollToLatest() {
    if (!chatMessagesContainer) return;
    chatMessagesContainer.classList.add('scrolling');
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    setTimeout(() => {
        chatMessagesContainer.classList.remove('scrolling');
    }, 500);
}

/**
 * Clears all chat messages.
 */
function clearChat() {
    chatMessages = [];
    updateChatDisplay();
    showToast('Chat cleared successfully', 'success');
}

/**
 * Toggles the chat pause state.
 */
function toggleChatPause() {
    if (!pauseChatBtn) return;
    chatPaused = !chatPaused;
    if (chatPaused) {
        pauseChatBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
        pauseChatBtn.classList.remove('btn-outline-secondary');
        pauseChatBtn.classList.add('btn-outline-warning');
        showToast('Chat paused', 'warning');
    } else {
        pauseChatBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        pauseChatBtn.classList.remove('btn-outline-warning');
        pauseChatBtn.classList.add('btn-outline-secondary');
        showToast('Chat resumed', 'success');
    }
}

// Utility functions
function getUserDisplayName(sessionId) {
    const prefix = 'User';
    const shortId = sessionId.substring(sessionId.length - 4).toUpperCase();
    return `${prefix}-${shortId}`;
}

function getUserAvatar(userName) {
    if (!userName || userName === 'unknown') return '?';
    return userName.substring(0, 2).toUpperCase();
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Now.';
    if (diffMins < 60) return `${diffMins} मिनट पहले`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} घंटे पहले`;
    return date.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
