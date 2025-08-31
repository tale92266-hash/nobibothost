document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements (Main Required Elements)
    const rulesList = document.getElementById("rulesList");
    const addRuleBtn = document.getElementById("addRuleBtn");
    const ruleModal = new bootstrap.Modal(document.getElementById("ruleModal"));
    const variableModal = new bootstrap.Modal(document.getElementById("variableModal"));
    const ruleForm = document.getElementById("ruleForm");
    const variableForm = document.getElementById("variableForm");
    const formTitle = document.getElementById("formTitle");
    const loadingMessage = document.getElementById("loadingMessage");
    const toastLiveExample = document.getElementById('liveToast');
    const toastBody = document.querySelector('#liveToast .toast-body');
    const toast = new bootstrap.Toast(toastLiveExample);

    // Global Variables
    let totalRules = 0;
    let allRules = [];
    let allVariables = [];

    // Socket connection for real-time stats
    const socket = io();
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    socket.on('statsUpdate', (data) => {
        updateStatsDisplay(data);
    });

    // Chat functionality
    let chatMessages = [];
    let maxMessages = 10;
    let chatPaused = false;
    const chatMessagesContainer = document.getElementById('chatMessages');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const pauseChatBtn = document.getElementById('pauseChatBtn');

    // Socket listeners for chat
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
                userMessage: message.userMessage || '',
                botReply: message.botReply || '',
                timestamp: message.timestamp || new Date().toISOString()
            });
        });
        updateChatDisplay();
        scrollToLatest();
        console.log('✅ Chat history loaded and displayed');
    });

    // Event Listeners
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            clearChat();
        });
    }

    if (pauseChatBtn) {
        pauseChatBtn.addEventListener('click', () => {
            toggleChatPause();
        });
    }

    // Initialize
    init();

    // Essential Functions that need to stay in main script
    function showToast(message, type = 'success') {
        const toastElement = document.getElementById('liveToast');
        const toastBody = toastElement.querySelector('.toast-body');
        toastBody.textContent = message;
        toastElement.classList.remove('success', 'fail', 'warning');
        toastElement.classList.add(type);
        const toastInstance = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 4000
        });
        toastInstance.show();
    }

    function updateStatsDisplay(data) {
        const totalUsers = document.getElementById('totalUsers');
        const todayUsers = document.getElementById('todayUsers');
        const totalMsgs = document.getElementById('totalMsgs');
        const todayMsgs = document.getElementById('todayMsgs');
        
        if (totalUsers) totalUsers.textContent = data.totalUsers || 0;
        if (todayUsers) todayUsers.textContent = data.todayUsers || 0;
        if (totalMsgs) totalMsgs.textContent = (data.totalMsgs || 0).toLocaleString();
        if (todayMsgs) todayMsgs.textContent = (data.todayMsgs || 0).toLocaleString();

        const headerTotalUsers = document.getElementById('headerTotalUsers');
        const headerTotalMsgs = document.getElementById('headerTotalMsgs');
        if (headerTotalUsers) headerTotalUsers.textContent = data.totalUsers || 0;
        if (headerTotalMsgs) headerTotalMsgs.textContent = (data.totalMsgs || 0).toLocaleString();

        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) {
            const now = new Date();
            lastUpdate.textContent = now.toLocaleTimeString();
        }
    }

    async function fetchStats() {
        try {
            const response = await fetch('/stats');
            const data = await response.json();
            updateStatsDisplay(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }

    async function fetchRules() {
        if (!loadingMessage) return;
        loadingMessage.style.display = 'block';
        rulesList.innerHTML = '';
        
        try {
            const response = await fetch('/api/rules');
            const data = await response.json();
            allRules = data;
            totalRules = data.length;
            console.log(`📋 Loaded ${totalRules} rules from server`);
            loadingMessage.style.display = 'none';
            
            if (data.length === 0) {
                rulesList.innerHTML = `<div class="empty-state">
                    <h4>No rules found</h4>
                    <p>Add your first rule to get started!</p>
                </div>`;
            } else {
                renderRules(data);
            }
        } catch (error) {
            console.error('Failed to fetch rules:', error);
            loadingMessage.style.display = 'none';
            showToast('Failed to load rules', 'fail');
        }
    }

    function renderRules(rules) {
        rulesList.innerHTML = '';
        const sortedRules = rules.sort((a, b) => a.RULE_NUMBER - b.RULE_NUMBER);
        
        sortedRules.forEach(rule => {
            const ruleCard = createRuleCard(rule);
            rulesList.appendChild(ruleCard);
        });
    }

    function createRuleCard(rule) {
        const card = document.createElement('div');
        card.className = 'rule-card';
        card.innerHTML = `
            <div class="rule-header">
                <div class="rule-number">#${rule.RULE_NUMBER}</div>
                <div class="rule-name">${rule.RULE_NAME || 'Unnamed Rule'}</div>
                <div class="rule-type-badge ${rule.RULE_TYPE?.toLowerCase()}">${rule.RULE_TYPE}</div>
            </div>
            <div class="rule-content">
                <div class="rule-keywords">
                    <strong>Keywords:</strong> ${rule.KEYWORDS || 'N/A'}
                </div>
                <div class="rule-replies">
                    <strong>Replies:</strong> ${rule.REPLY_TEXT ? rule.REPLY_TEXT.substring(0, 100) + '...' : 'N/A'}
                </div>
            </div>
            <div class="rule-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="editRule(${rule.RULE_NUMBER})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteRule(${rule.RULE_NUMBER})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        return card;
    }

    // Chat Functions
    function addChatMessage(messageData) {
        const { sessionId, userMessage, botReply, timestamp, senderName } = messageData;
        const message = {
            id: Date.now() + Math.random(),
            sessionId: sessionId || 'unknown',
            senderName: senderName || '',
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

    function updateChatDisplay() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        chatContainer.innerHTML = '';
        chatMessages.forEach((message, index) => {
            const messageElement = createMessageElement(message, index);
            chatContainer.appendChild(messageElement);
        });
    }

    function createMessageElement(message, index) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.style.animationDelay = `${index * 0.1}s`;
        
        const userName = message.senderName || getUserDisplayName(message.sessionId, message.senderName);
        const userAvatar = getUserAvatar(userName);
        const timeDisplay = formatTime(message.timestamp);
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="user-avatar">${userAvatar}</div>
                <div class="user-name">${escapeHtml(userName)}</div>
                <div class="message-time">${timeDisplay}</div>
            </div>
            <div class="message-content">
                <div class="user-message">${escapeHtml(message.userMessage)}</div>
                <div class="bot-reply">${escapeHtml(message.botReply)}</div>
            </div>
        `;
        return messageDiv;
    }

    function getUserDisplayName(sessionId, senderName) {
        if (senderName && senderName.trim() !== '') {
            return senderName.trim();
        }
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
        
        if (diffMins < 1) return 'Now';
        if (diffMins < 60) return `${diffMins} मिनट पहले`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} घंटे पहले`;
        return date.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function scrollToLatest() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        chatContainer.classList.add('scrolling');
        chatContainer.scrollTop = chatContainer.scrollHeight;
        setTimeout(() => {
            chatContainer.classList.remove('scrolling');
        }, 500);
    }

    function clearChat() {
        chatMessages = [];
        updateChatDisplay();
        showToast('Chat cleared successfully', 'success');
    }

    function toggleChatPause() {
        const pauseBtn = document.getElementById('pauseChatBtn');
        if (!pauseBtn) return;
        
        chatPaused = !chatPaused;
        if (chatPaused) {
            pauseBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
            pauseBtn.classList.remove('btn-outline-secondary');
            pauseBtn.classList.add('btn-outline-warning');
            showToast('Chat paused', 'warning');
        } else {
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            pauseBtn.classList.remove('btn-outline-warning');
            pauseBtn.classList.add('btn-outline-secondary');
            showToast('Chat resumed', 'success');
        }
    }

    function initBottomNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabPanes = document.querySelectorAll('.tab-pane');
        
        if (navItems.length > 0) {
            navItems[0].classList.add('active');
        }
        
        navItems.forEach(navItem => {
            navItem.addEventListener('click', () => {
                const tabName = navItem.getAttribute('data-tab');
                navItems.forEach(item => item.classList.remove('active'));
                navItem.classList.add('active');
                tabPanes.forEach(pane => {
                    pane.classList.remove('show', 'active');
                });
                
                const targetPane = document.getElementById(`${tabName}-pane`);
                if (targetPane) {
                    targetPane.classList.add('show', 'active');
                }
                
                if (tabName === 'rules' && allRules.length === 0) {
                    fetchRules();
                } else if (tabName === 'settings' && allVariables.length === 0) {
                    fetchVariables();
                }
            });
        });
    }

    async function init() {
        try {
            initBottomNavigation();
            await fetchStats();
            await fetchRules();
            await fetchVariables();
        } catch (error) {
            console.error('Initialization error:', error);
            showToast('Failed to initialize application', 'fail');
        }
    }

    // Make essential functions globally available
    window.showToast = showToast;
    window.allRules = allRules;
    window.totalRules = totalRules;
    window.fetchRules = fetchRules;
    window.renderRules = renderRules;
});
