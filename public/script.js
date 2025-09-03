document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const rulesList = document.getElementById("rulesList");
    const addRuleBtn = document.getElementById("addRuleBtn");
    const ruleModal = new bootstrap.Modal(document.getElementById("ruleModal"));
    const variableModal = new bootstrap.Modal(document.getElementById("variableModal"));
    const overrideModal = new bootstrap.Modal(document.getElementById("overrideModal"));
    const preventRepeatingModal = new bootstrap.Modal(document.getElementById("preventRepeatingModal"));
    const ruleForm = document.getElementById("ruleForm");
    const variableForm = document.getElementById("variableForm");
    const formTitle = document.getElementById("formTitle");
    const deleteRuleBtn = document.getElementById("deleteRuleBtn");
    const loadingMessage = document.getElementById("loadingMessage");
    const ruleTypeSelect = document.getElementById('ruleType');
    const keywordsField = document.getElementById('keywordsField');
    const repliesTypeField = document.getElementById('repliesTypeField');
    const replyTextField = document.getElementById('replyTextField');
    const targetUsersToggle = document.getElementById('targetUsersToggle');
    const targetUsersField = document.getElementById('targetUsersField');
    const ruleNumberInput = document.getElementById('ruleNumber');
    const ruleNumberError = document.getElementById('ruleNumberError');
    const variablesList = document.getElementById('variablesList');
    const addVariableBtn = document.getElementById('addVariableBtn');
    const deleteVariableBtn = document.getElementById('deleteVariableBtn');
    const variableFormContainer = document.getElementById('variableFormContainer');
    const variablesMenuBtn = document.getElementById('variablesMenuBtn');
    const toastLiveExample = document.getElementById('liveToast');
    const toastBody = document.querySelector('#liveToast .toast-body');
    const toast = new bootstrap.Toast(toastLiveExample);
    const saveRuleBtn = document.getElementById('saveRuleBtn');
    const saveVariableBtn = document.getElementById('saveVariableBtn');
    const cancelVariableBtn = document.getElementById('cancelVariableBtn');

    // NEW DOM Elements
    const ignoredOverrideBtn = document.getElementById('ignoredOverrideBtn');
    const specificOverrideBtn = document.getElementById('specificOverrideBtn');
    const overrideModalTitle = document.getElementById('overrideModalTitle');
    const overrideModalDescription = document.getElementById('overrideModalDescription');
    const overrideUsersList = document.getElementById('overrideUsersList');
    const saveOverrideBtn = document.getElementById('saveOverrideBtn');
    const preventRepeatingBtn = document.getElementById('preventRepeatingBtn');
    const preventRepeatingToggle = document.getElementById('preventRepeatingToggle');
    const cooldownTimeInput = document.getElementById('cooldownTime');
    const cooldownField = document.getElementById('cooldownField');
    const saveRepeatingBtn = document.getElementById('saveRepeatingBtn');

    // NEW: Bot Status DOM elements
    const botStatusBtn = document.getElementById('botStatusBtn');
    const botStatusText = document.getElementById('botStatusText');
    const botStatusContainer = document.querySelector('.bot-status-container');

    // NEW DOM for Temporary Hide & Unhide
    const tempHideBtn = document.getElementById('tempHideBtn');
    const tempHideModal = new bootstrap.Modal(document.getElementById("tempHideModal"));
    const tempHideToggle = document.getElementById('tempHideToggle');
    const tempUnhideToggle = document.getElementById('tempUnhideToggle');
    const tempHideMatchTypeSelect = document.getElementById('tempHideMatchType');
    const tempUnhideMatchTypeSelect = document.getElementById('tempUnhideMatchType');
    const tempHideTriggerTextarea = document.getElementById('tempHideTriggerText');
    const tempUnhideTriggerTextarea = document.getElementById('tempUnhideTriggerText');
    const saveTempHideBtn = document.getElementById('saveTempHideBtn');

    // Variables
    let currentRuleNumber = null;
    let currentVariableName = null;
    let totalRules = 0;
    let allRules = [];
    let allVariables = [];
    
    // NEW: Override list variables
    let ignoredOverrideUsers = [];
    let specificOverrideUsers = [];
    let currentOverrideType = null;
    let currentSettings = {
        preventRepeatingRule: {
            enabled: false,
            cooldown: 2
        },
        isBotOnline: true,
        temporaryHide: {
            enabled: false,
            matchType: 'EXACT',
            triggerText: 'nobi papa hide me',
            unhideEnabled: true,
            unhideTriggerText: 'nobi papa start',
            unhideMatchType: 'EXACT'
        }
    };

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

    // Socket listener for chat history
    socket.on('chatHistory', (historyMessages) => {
        console.log('📜 Received chat history:', historyMessages.length, 'messages');
        // Clear current messages and load history
        chatMessages = [];
        // Reverse history (oldest first in array for chronological order)
        const reversedHistory = [...historyMessages].reverse();
        // Add history messages to current array
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
        // Update display
        updateChatDisplay();
        // Scroll to bottom to show latest
        scrollToLatest();
        console.log('✅ Chat history loaded and displayed');
    });

    // Clear chat button
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            clearChat();
        });
    }

    // Pause/Resume chat button
    if (pauseChatBtn) {
        pauseChatBtn.addEventListener('click', () => {
            toggleChatPause();
        });
    }

    // Add chat tab to navigation
    addChatNavigation();

    function addChatMessage(messageData) {
        const { sessionId, userMessage, botReply, timestamp, senderName, groupName } = messageData;
        // Create message object
        const message = {
            id: Date.now() + Math.random(),
            sessionId: sessionId || 'unknown',
            senderName: senderName || '',
            groupName: groupName || null,
            userMessage: userMessage || '',
            botReply: botReply || '',
            timestamp: timestamp || new Date().toISOString()
        };
        // Add to end of array (newest at end)
        chatMessages.push(message);
        // Keep only last 10 messages
        if (chatMessages.length > maxMessages) {
            chatMessages = chatMessages.slice(-maxMessages); // Keep last 10
        }
        // Update chat display
        updateChatDisplay();
        // Auto scroll to latest message (bottom)
        scrollToLatest();
    }

    function updateChatDisplay() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        chatContainer.innerHTML = '';
        // Show messages in chronological order (oldest first, newest at bottom)
        chatMessages.forEach((message, index) => {
            const messageElement = createMessageElement(message, index);
            chatContainer.appendChild(messageElement);
        });
    }

    function createMessageElement(message, index) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.style.animationDelay = `${index * 0.1}s`;
        // Use actual sender name if available
        const userName = message.senderName || getUserDisplayName(message.sessionId, message.senderName);
        const userAvatar = getUserAvatar(userName);
        const timeDisplay = formatTime(message.timestamp);
        // Naya logic: Reply text ko update karen
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

    function getUserDisplayName(sessionId, senderName) {
        // Prioritize actual sender name
        if (senderName && senderName.trim() !== '') {
            return senderName.trim();
        }
        // Fallback for anonymous users
        const prefix = 'User';
        const shortId = sessionId.substring(sessionId.length - 4).toUpperCase();
        return `${prefix}-${shortId}`;
    }

    function getUserAvatar(userName) {
        if (!userName || userName === 'unknown') return '?';
        // Create avatar from actual name
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

    function scrollToLatest() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        chatContainer.classList.add('scrolling');
        // Scroll to bottom for newest messages
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

    function addChatNavigation() {
        // Add chat tab to bottom navigation if it's there
        const navContainer = document.querySelector('.bottom-navigation');
        if (!navContainer) return;
        const chatNavExists = document.querySelector('[data-tab="chat"]');
        if (chatNavExists) return;
        const chatNavItem = document.createElement('div');
        chatNavItem.className = 'nav-item';
        chatNavItem.setAttribute('data-tab', 'chat');
        chatNavItem.innerHTML = `
            <i class="fas fa-comments"></i>
            <span>Chat</span>
        `;
        // Insert before settings tab
        const settingsTab = document.querySelector('[data-tab="settings"]');
        if (settingsTab) {
            navContainer.insertBefore(chatNavItem, settingsTab);
        } else {
            navContainer.appendChild(chatNavItem);
        }
    }

    function validateRuleNumber(num, isEditing = false) {
        const maxAllowed = isEditing ? totalRules : totalRules + 1;
        const isNumInvalid = num > maxAllowed || num < 1 || isNaN(num);
        if (isNumInvalid) {
            ruleNumberError.style.display = 'block';
            if (num > maxAllowed) {
                ruleNumberError.innerText = `In edit mode, rule number cannot be greater than ${totalRules}`;
            } else if (num < 1) {
                ruleNumberError.innerText = `Rule number must be at least 1`;
            }
            return false;
        }
        ruleNumberError.style.display = 'none';
        return true;
    }

    function setupRuleNumberValidation(isEditing = false) {
        const maxAllowed = isEditing ? totalRules : totalRules + 1;
        ruleNumberInput.setAttribute('max', maxAllowed);
        ruleNumberInput.setAttribute('min', 1);
        const newHandler = function(e) {
            let value = parseInt(e.target.value);
            if (isNaN(value)) {
                return;
            }
            if (value < 1) {
                e.target.value = 1;
            } else if (value > maxAllowed) {
                e.target.value = maxAllowed;
                showToast(`Maximum rule number in ${isEditing ? 'edit' : 'add'} mode is ${maxAllowed}`, 'warning');
            }
            validateRuleNumber(e.target.value, isEditing);
        };
        if (ruleNumberInput._currentHandler) {
            ruleNumberInput.removeEventListener('input', ruleNumberInput._currentHandler);
        }
        ruleNumberInput.addEventListener('input', newHandler);
        ruleNumberInput._currentHandler = newHandler;
        const keydownHandler = function(e) {
            if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
                (e.keyCode === 65 && e.ctrlKey === true) ||
                (e.keyCode >= 35 && e.keyCode <= 39)) {
                return;
            }
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                e.preventDefault();
            }
        };
        if (ruleNumberInput._currentKeydownHandler) {
            ruleNumberInput.removeEventListener('keydown', ruleNumberInput._currentKeydownHandler);
        }
        ruleNumberInput.addEventListener('keydown', keydownHandler);
        ruleNumberInput._currentKeydownHandler = keydownHandler;
    }

    // Rule Reordering Function
    function reorderRulesArray(rules, oldRuleNumber, newRuleNumber) {
        if (oldRuleNumber === newRuleNumber) return rules;
        const fromIndex = rules.findIndex(r => r.RULE_NUMBER === oldRuleNumber);
        const toIndex = newRuleNumber - 1;
        if (fromIndex === -1 || toIndex < 0 || toIndex >= rules.length) {
            console.error('❌ Invalid rule or target position');
            return rules;
        }
        const newRules = [...rules];
        const [movingRule] = newRules.splice(fromIndex, 1);
        newRules.splice(toIndex, 0, movingRule);
        const finalRules = newRules.map((rule, index) => ({
            ...rule,
            RULE_NUMBER: index + 1
        }));
        return finalRules;
    }

    // Bulk Update Rules API Call
    async function bulkUpdateRules(reorderedRules) {
        try {
            const response = await fetch('/api/rules/bulk-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rules: reorderedRules })
            });
            const result = await response.json();
            if (result.success) {
                showToast(`${result.updatedCount} rules reordered successfully`, 'success');
                await fetchRules();
            } else {
                showToast(result.message || 'Failed to update rules order', 'fail');
            }
        } catch (error) {
            console.error('❌ Network error during bulk update:', error);
            showToast('Network error during bulk update: ' + error.message, 'fail');
        }
    }

    // Modal Button Management
    function configureModalButtons(modalType, mode) {
        let deleteBtn, buttonContainer;
        if (modalType === 'rule') {
            deleteBtn = document.getElementById('deleteRuleBtn');
            buttonContainer = document.querySelector('#ruleModal .modal-footer');
        } else if (modalType === 'variable') {
            deleteBtn = document.getElementById('deleteVariableBtn');
            buttonContainer = document.querySelector('.form-actions');
        }
        if (!deleteBtn || !buttonContainer) {
            return;
        }
        if (mode === 'add') {
            deleteBtn.style.display = 'none';
            deleteBtn.style.visibility = 'hidden';
            deleteBtn.classList.add('d-none');
        } else if (mode === 'edit') {
            deleteBtn.style.display = 'inline-flex';
            deleteBtn.style.visibility = 'visible';
            deleteBtn.classList.remove('d-none');
        }
        const allButtons = buttonContainer.querySelectorAll('.btn');
        allButtons.forEach(btn => {
            btn.style.display = btn === deleteBtn && mode === 'add' ? 'none' : 'inline-flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.minWidth = '100px';
            btn.style.minHeight = '38px';
            btn.style.padding = '0.625rem 1.25rem';
            btn.style.lineHeight = '1.5';
            btn.style.whiteSpace = 'nowrap';
            btn.style.verticalAlign = 'middle';
            btn.style.marginLeft = '0';
        });
    }

    // Bottom Navigation Handler
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
                } else if (tabName === 'variables' && allVariables.length === 0) {
                    fetchVariables();
                }
            });
        });
    }

    // Initialize
    async function init() {
        try {
            initBottomNavigation();
            showLoading(); // Show spinner before starting fetch requests
            await fetchStats();
            await fetchRules();
            await fetchVariables();
            await fetchSettings();
            updateBotStatusUI();
            hideLoading(); // Hide spinner after all requests are complete
        } catch (error) {
            showToast('Failed to initialize application', 'fail');
            hideLoading(); // Hide spinner on error
        }
    }

    // Loading State Management (FIX)
    function showLoading() {
        if (loadingMessage) {
            loadingMessage.style.display = 'flex';
        }
    }

    function hideLoading() {
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
    }

    // Stats Functions
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

    // Toast Functions
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

    function toggleFormFields(ruleType) {
        if (ruleType === 'WELCOME' || ruleType === 'DEFAULT') {
            keywordsField.style.display = 'none';
            repliesTypeField.style.display = 'none';
            replyTextField.style.display = 'block';
            document.getElementById('keywords').value = "ALL";
        } else {
            keywordsField.style.display = 'block';
            repliesTypeField.style.display = 'block';
            replyTextField.style.display = 'block';
        }
        if (!document.getElementById('repliesType').value) {
            document.getElementById('repliesType').value = 'RANDOM';
        }
    }

    function toggleTargetUsersField() {
        const isTargetOrIgnored = targetUsersToggle.value === 'TARGET' || targetUsersToggle.value === 'IGNORED';
        targetUsersField.style.display = isTargetOrIgnored ? 'block' : 'none';
        if (!isTargetOrIgnored) {
            document.getElementById('targetUsers').value = "ALL";
        }
    }

    async function fetchRules() {
        if (!loadingMessage) return;
        
        rulesList.innerHTML = '';
        try {
            const response = await fetch('/api/rules');
            const data = await response.json();
            allRules = data;
            totalRules = data.length;
            if (data.length === 0) {
                rulesList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-plus-circle fa-3x"></i>
                        <h5>No Rules Found</h5>
                        <p>Add your first rule to get started!</p>
                    </div>
                `;
            } else {
                const searchTerm = document.getElementById('searchRules')?.value?.toLowerCase() || '';
                displayRulesWithSearch(data, searchTerm);
            }
        } catch (error) {
            console.error('Failed to fetch rules:', error);
            rulesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-3x"></i>
                    <h5>Error Loading Rules</h5>
                    <p>Please try refreshing the page</p>
                </div>
            `;
        }
    }

    function displayRulesWithSearch(rules, searchTerm = '') {
        const filteredRules = rules.filter(rule =>
            (rule.RULE_NAME || '').toLowerCase().includes(searchTerm) ||
            (rule.KEYWORDS || '').toLowerCase().includes(searchTerm) ||
            (rule.REPLY_TEXT || '').toLowerCase().includes(searchTerm) ||
            (rule.RULE_TYPE || '').toLowerCase().includes(searchTerm) ||
            rule.RULE_NUMBER.toString().includes(searchTerm)
        );
        if (filteredRules.length === 0 && searchTerm) {
            rulesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search fa-3x"></i>
                    <h6>No Search Results</h6>
                    <p>No rules match your search term "${searchTerm}"</p>
                </div>
            `;
            return;
        }
        rulesList.innerHTML = '';
        filteredRules.forEach(rule => {
            const ruleElement = createRuleElement(rule);
            rulesList.appendChild(ruleElement);
        });
    }

    function createRuleElement(rule) {
        const ruleDiv = document.createElement('div');
        ruleDiv.className = 'rule-item';
        ruleDiv.setAttribute('data-rule-number', rule.RULE_NUMBER);
        const ruleTypeClass = (rule.RULE_TYPE || '').toLowerCase();
        const targetUsersDisplay = Array.isArray(rule.TARGET_USERS) 
            ? rule.TARGET_USERS.join(', ') 
            : (rule.TARGET_USERS || 'ALL');
        ruleDiv.innerHTML = `
            <div class="rule-header-new">
                <div class="rule-title">
                    <span class="rule-number-new">${rule.RULE_NUMBER}</span>
                    <span class="rule-name-new">${rule.RULE_NAME || 'Untitled Rule'}</span>
                </div>
                <span class="rule-type ${ruleTypeClass}">${rule.RULE_TYPE}</span>
            </div>
            <div class="rule-content-new">
                <div class="rule-line">
                    <strong>Keywords:</strong> ${rule.KEYWORDS || 'N/A'}
                </div>
                <div class="rule-line">
                    <strong>Users:</strong> ${targetUsersDisplay}
                </div>
                <div class="rule-reply">
                    <strong>Reply:</strong>
                    <div class="reply-text">${(rule.REPLY_TEXT || 'No reply text').substring(0, 200)}${rule.REPLY_TEXT && rule.REPLY_TEXT.length > 200 ? '...' : ''}</div>
                </div>
            </div>
        `;
        ruleDiv.addEventListener('click', () => editRule(rule));
        return ruleDiv;
    }

    // FIXED: Form validation with proper server communication
    function validateRuleForm() {
        const ruleNumber = document.getElementById('ruleNumber').value.trim();
        const keywords = document.getElementById('keywords').value.trim();
        const replyText = document.getElementById('replyText').value.trim();
        
        if (!ruleNumber || !keywords || !replyText) {
            showToast('Please fill all required fields', 'warning');
            return false;
        }
        
        const ruleNum = parseInt(ruleNumber);
        if (isNaN(ruleNum) || ruleNum < 1) {
            showToast('Rule number must be a valid number', 'warning');
            return false;
        }
        
        return true;
    }

    // FIXED: Save rule function with proper error handling
    async function saveRule() {
        console.log('💾 Save button clicked - starting save process');
        
        // Validate form data first
        if (!validateRuleForm()) {
            console.log('❌ Form validation failed');
            return;
        }

        // Show loading state
        const saveBtn = document.getElementById('saveRuleBtn');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;

        try {
            // Get form data
            const ruleData = {
                ruleNumber: parseInt(document.getElementById('ruleNumber').value),
                ruleName: document.getElementById('ruleName').value.trim(),
                ruleType: document.getElementById('ruleType').value,
                keywords: document.getElementById('keywords').value.trim(),
                repliesType: document.getElementById('repliesType').value,
                replyText: document.getElementById('replyText').value.trim(),
                targetUsers: document.getElementById('targetUsers').value.trim() || 'ALL'
            };

            console.log('📤 Sending rule data:', ruleData);

            // Determine if adding or editing
            const isEditing = currentRuleNumber !== null;
            const requestData = {
                type: isEditing ? 'edit' : 'add',
                rule: ruleData,
                oldRuleNumber: currentRuleNumber
            };

            // Send API request
            const response = await fetch('/api/rules/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            console.log('📥 Server response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Server response:', result);

            if (result.success) {
                showToast(result.message || 'Rule saved successfully!', 'success');
                ruleModal.hide();
                await fetchRules(); // Reload rules list
                currentRuleNumber = null; // Reset editing state
            } else {
                throw new Error(result.message || 'Failed to save rule');
            }

        } catch (error) {
            console.error('❌ Save rule error:', error);
            showToast('Failed to save rule: ' + error.message, 'fail');
        } finally {
            // Restore button state
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    function editRule(rule) {
        currentRuleNumber = rule.RULE_NUMBER;
        document.getElementById('formTitle').textContent = 'Edit Rule';
        document.getElementById('ruleNumber').value = rule.RULE_NUMBER;
        document.getElementById('ruleName').value = rule.RULE_NAME || '';
        document.getElementById('ruleType').value = rule.RULE_TYPE;
        document.getElementById('keywords').value = rule.KEYWORDS || '';
        document.getElementById('repliesType').value = rule.REPLIES_TYPE;
        document.getElementById('replyText').value = rule.REPLY_TEXT || '';
        if (Array.isArray(rule.TARGET_USERS)) {
            document.getElementById('targetUsers').value = rule.TARGET_USERS.join(',');
            document.getElementById('targetUsersToggle').value = 'TARGET';
            targetUsersField.style.display = 'block';
        } else {
            document.getElementById('targetUsers').value = rule.TARGET_USERS || 'ALL';
            document.getElementById('targetUsersToggle').value = 'ALL';
            targetUsersField.style.display = 'none';
        }
        toggleFormFields(rule.RULE_TYPE);
        setupRuleNumberValidation(true);
        configureModalButtons('rule', 'edit');
        ruleModal.show();
    }

    function addNewRule() {
        currentRuleNumber = null;
        document.getElementById('formTitle').textContent = 'Add New Rule';
        ruleForm.reset();
        document.getElementById('ruleNumber').value = totalRules + 1;
        document.getElementById('ruleType').value = 'EXACT';
        document.getElementById('repliesType').value = 'RANDOM';
        document.getElementById('targetUsersToggle').value = 'ALL';
        targetUsersField.style.display = 'none';
        toggleFormFields('EXACT');
        setupRuleNumberValidation(false);
        configureModalButtons('rule', 'add');
        ruleModal.show();
    }

    async function deleteRule() {
        if (currentRuleNumber === null) return;
        if (!confirm('Are you sure you want to delete this rule?')) return;
        try {
            const response = await fetch('/api/rules/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'delete',
                    rule: { ruleNumber: currentRuleNumber }
                })
            });
            const result = await response.json();
            if (result.success) {
                showToast('Rule deleted successfully!', 'success');
                ruleModal.hide();
                await fetchRules();
                currentRuleNumber = null;
            } else {
                showToast(result.message || 'Failed to delete rule', 'fail');
            }
        } catch (error) {
            console.error('Failed to delete rule:', error);
            showToast('Network error: Failed to delete rule', 'fail');
        }
    }

    async function fetchVariables() {
        try {
            const response = await fetch('/api/variables');
            const data = await response.json();
            allVariables = data;
            displayVariables(data);
        } catch (error) {
            console.error('Failed to fetch variables:', error);
            variablesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-3x"></i>
                    <h6>Error Loading Variables</h6>
                    <p>Please try refreshing the page</p>
                </div>
            `;
        }
    }

    function displayVariables(variables) {
        if (variables.length === 0) {
            variablesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-plus-circle fa-3x"></i>
                    <h6>No Variables Found</h6>
                    <p>Create variables to use dynamic content in your rules.</p>
                </div>
            `;
            return;
        }
        variablesList.innerHTML = '';
        variables.forEach(variable => {
            const variableElement = createVariableElement(variable);
            variablesList.appendChild(variableElement);
        });
    }

    function createVariableElement(variable) {
        const variableDiv = document.createElement('div');
        variableDiv.className = 'variable-item';
        variableDiv.innerHTML = `
            <div class="variable-header">
                <span class="variable-name">%${variable.name}%</span>
            </div>
            <div class="variable-value">${variable.value.substring(0, 100)}${variable.value.length > 100 ? '...' : ''}</div>
        `;
        variableDiv.addEventListener('click', () => editVariable(variable));
        return variableDiv;
    }

    function editVariable(variable) {
        currentVariableName = variable.name;
        document.getElementById('variableName').value = variable.name;
        document.getElementById('variableValue').value = variable.value;
        configureModalButtons('variable', 'edit');
        variableModal.show();
    }

    function addNewVariable() {
        currentVariableName = null;
        document.getElementById('variableName').value = '';
        document.getElementById('variableValue').value = '';
        configureModalButtons('variable', 'add');
        variableModal.show();
    }

    async function saveVariable() {
        const name = document.getElementById('variableName').value.trim();
        const value = document.getElementById('variableValue').value.trim();
        if (!name || !value) {
            showToast('Please fill all required fields', 'warning');
            return;
        }
        try {
            const isEditing = currentVariableName !== null;
            const response = await fetch('/api/variables/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: isEditing ? 'edit' : 'add',
                    variable: { name, value },
                    oldName: currentVariableName
                })
            });
            const result = await response.json();
            if (result.success) {
                showToast(result.message || 'Variable saved successfully!', 'success');
                variableModal.hide();
                await fetchVariables();
                currentVariableName = null;
            } else {
                showToast(result.message || 'Failed to save variable', 'fail');
            }
        } catch (error) {
            console.error('Failed to save variable:', error);
            showToast('Network error: Failed to save variable', 'fail');
        }
    }

    async function deleteVariable() {
        if (currentVariableName === null) return;
        if (!confirm('Are you sure you want to delete this variable?')) return;
        try {
            const response = await fetch('/api/variables/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'delete',
                    variable: { name: currentVariableName }
                })
            });
            const result = await response.json();
            if (result.success) {
                showToast('Variable deleted successfully!', 'success');
                variableModal.hide();
                await fetchVariables();
                currentVariableName = null;
            } else {
                showToast(result.message || 'Failed to delete variable', 'fail');
            }
        } catch (error) {
            console.error('Failed to delete variable:', error);
            showToast('Network error: Failed to delete variable', 'fail');
        }
    }

    // NEW: Settings Functions
    async function fetchSettings() {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();
            currentSettings = data;
            updateBotStatusUI();
            updateOverrideUsersList();
            updateRepeatingRuleUI();
            updateTempHideUI();
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        }
    }

    // NEW: Bot Status Functions
    function updateBotStatusUI() {
        if (botStatusBtn) {
            const isOnline = currentSettings.isBotOnline;
            botStatusBtn.className = isOnline ? 'bot-on' : 'bot-off';
            const statusText = document.getElementById('botStatusText');
            if (statusText) {
                statusText.textContent = isOnline ? 'Bot is Online' : 'Bot is Offline';
            }
        }
    }

    async function toggleBotStatus() {
        if (botStatusBtn) {
            botStatusBtn.className = 'bot-loading';
            const statusText = document.getElementById('botStatusText');
            if (statusText) {
                statusText.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Updating...';
            }
        }
        
        try {
            const newStatus = !currentSettings.isBotOnline;
            const response = await fetch('/api/bot/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isOnline: newStatus })
            });
            
            const result = await response.json();
            if (result.success) {
                currentSettings.isBotOnline = newStatus;
                updateBotStatusUI();
                showToast(result.message, 'success');
            } else {
                showToast(result.message || 'Failed to update bot status', 'fail');
                updateBotStatusUI(); // Revert UI
            }
        } catch (error) {
            console.error('Failed to toggle bot status:', error);
            showToast('Network error: Failed to update bot status', 'fail');
            updateBotStatusUI(); // Revert UI
        }
    }

    // NEW: Override Users Functions
    function updateOverrideUsersList() {
        ignoredOverrideUsers = currentSettings.ignoredOverrideUsers || [];
        specificOverrideUsers = currentSettings.specificOverrideUsers || [];
    }

    function showIgnoredOverrideModal() {
        currentOverrideType = 'ignored';
        overrideModalTitle.textContent = 'Ignored Contact Override';
        overrideModalDescription.textContent = 'Globally ignore these users for ALL rules.';
        const usersText = ignoredOverrideUsers.map(user => 
            typeof user === 'string' ? user : `${user.name}:${user.context}`
        ).join(', ');
        overrideUsersList.value = usersText;
        overrideModal.show();
    }

    function showSpecificOverrideModal() {
        currentOverrideType = 'specific';
        overrideModalTitle.textContent = 'Specific Contact Override';
        overrideModalDescription.textContent = 'Apply ALL rules to these users, regardless of other settings.';
        overrideUsersList.value = specificOverrideUsers.join(', ');
        overrideModal.show();
    }

    async function saveOverrideSettings() {
        const users = overrideUsersList.value.trim();
        const endpoint = currentOverrideType === 'ignored' 
            ? '/api/settings/ignored-override' 
            : '/api/settings/specific-override';
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ users })
            });
            
            const result = await response.json();
            if (result.success) {
                if (currentOverrideType === 'ignored') {
                    ignoredOverrideUsers = users.split(',').map(userString => {
                        const [name, context] = userString.split(':').map(s => s.trim());
                        return { name, context: context || 'DM' };
                    }).filter(item => item.name);
                } else {
                    specificOverrideUsers = users.split(',').map(u => u.trim()).filter(Boolean);
                }
                showToast(result.message, 'success');
                overrideModal.hide();
            } else {
                showToast(result.message || 'Failed to save settings', 'fail');
            }
        } catch (error) {
            console.error('Failed to save override settings:', error);
            showToast('Network error: Failed to save settings', 'fail');
        }
    }

    // NEW: Prevent Repeating Rule Functions
    function updateRepeatingRuleUI() {
        if (preventRepeatingToggle) {
            preventRepeatingToggle.checked = currentSettings.preventRepeatingRule.enabled;
        }
        if (cooldownTimeInput) {
            cooldownTimeInput.value = currentSettings.preventRepeatingRule.cooldown;
        }
        toggleCooldownField();
    }

    function toggleCooldownField() {
        if (cooldownField) {
            cooldownField.style.display = preventRepeatingToggle.checked ? 'block' : 'none';
        }
    }

    function showPreventRepeatingModal() {
        updateRepeatingRuleUI();
        preventRepeatingModal.show();
    }

    async function saveRepeatingRuleSettings() {
        const enabled = preventRepeatingToggle.checked;
        const cooldown = parseInt(cooldownTimeInput.value) || 2;
        
        try {
            const response = await fetch('/api/settings/prevent-repeating-rule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled, cooldown })
            });
            
            const result = await response.json();
            if (result.success) {
                currentSettings.preventRepeatingRule = { enabled, cooldown };
                showToast(result.message, 'success');
                preventRepeatingModal.hide();
            } else {
                showToast(result.message || 'Failed to save settings', 'fail');
            }
        } catch (error) {
            console.error('Failed to save repeating rule settings:', error);
            showToast('Network error: Failed to save settings', 'fail');
        }
    }

    // NEW: Temporary Hide Functions
    function updateTempHideUI() {
        if (tempHideToggle) {
            tempHideToggle.checked = currentSettings.temporaryHide.enabled;
        }
        if (tempHideMatchTypeSelect) {
            tempHideMatchTypeSelect.value = currentSettings.temporaryHide.matchType;
        }
        if (tempHideTriggerTextarea) {
            tempHideTriggerTextarea.value = currentSettings.temporaryHide.triggerText;
        }
        if (tempUnhideToggle) {
            tempUnhideToggle.checked = currentSettings.temporaryHide.unhideEnabled;
        }
        if (tempUnhideMatchTypeSelect) {
            tempUnhideMatchTypeSelect.value = currentSettings.temporaryHide.unhideMatchType;
        }
        if (tempUnhideTriggerTextarea) {
            tempUnhideTriggerTextarea.value = currentSettings.temporaryHide.unhideTriggerText;
        }
    }

    function showTempHideModal() {
        updateTempHideUI();
        tempHideModal.show();
    }

    async function saveTempHideSettings() {
        const enabled = tempHideToggle.checked;
        const matchType = tempHideMatchTypeSelect.value;
        const triggerText = tempHideTriggerTextarea.value.trim();
        const unhideEnabled = tempUnhideToggle.checked;
        const unhideMatchType = tempUnhideMatchTypeSelect.value;
        const unhideTriggerText = tempUnhideTriggerTextarea.value.trim();
        
        try {
            const response = await fetch('/api/settings/temporary-hide', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    enabled,
                    matchType,
                    triggerText,
                    unhideEnabled,
                    unhideTriggerText,
                    unhideMatchType
                })
            });
            
            const result = await response.json();
            if (result.success) {
                currentSettings.temporaryHide = {
                    enabled,
                    matchType,
                    triggerText,
                    unhideEnabled,
                    unhideTriggerText,
                    unhideMatchType
                };
                showToast(result.message, 'success');
                tempHideModal.hide();
            } else {
                showToast(result.message || 'Failed to save settings', 'fail');
            }
        } catch (error) {
            console.error('Failed to save temporary hide settings:', error);
            showToast('Network error: Failed to save settings', 'fail');
        }
    }

    // Event Listeners
    if (addRuleBtn) {
        addRuleBtn.addEventListener('click', addNewRule);
    }

    if (saveRuleBtn) {
        saveRuleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveRule();
        });
    }

    if (deleteRuleBtn) {
        deleteRuleBtn.addEventListener('click', deleteRule);
    }

    if (ruleTypeSelect) {
        ruleTypeSelect.addEventListener('change', (e) => {
            toggleFormFields(e.target.value);
        });
    }

    if (targetUsersToggle) {
        targetUsersToggle.addEventListener('change', toggleTargetUsersField);
    }

    if (addVariableBtn) {
        addVariableBtn.addEventListener('click', addNewVariable);
    }

    if (saveVariableBtn) {
        saveVariableBtn.addEventListener('click', saveVariable);
    }

    if (deleteVariableBtn) {
        deleteVariableBtn.addEventListener('click', deleteVariable);
    }

    // NEW: Settings Event Listeners
    if (botStatusBtn) {
        botStatusBtn.addEventListener('click', toggleBotStatus);
    }

    if (ignoredOverrideBtn) {
        ignoredOverrideBtn.addEventListener('click', showIgnoredOverrideModal);
    }

    if (specificOverrideBtn) {
        specificOverrideBtn.addEventListener('click', showSpecificOverrideModal);
    }

    if (saveOverrideBtn) {
        saveOverrideBtn.addEventListener('click', saveOverrideSettings);
    }

    if (preventRepeatingBtn) {
        preventRepeatingBtn.addEventListener('click', showPreventRepeatingModal);
    }

    if (preventRepeatingToggle) {
        preventRepeatingToggle.addEventListener('change', toggleCooldownField);
    }

    if (saveRepeatingBtn) {
        saveRepeatingBtn.addEventListener('click', saveRepeatingRuleSettings);
    }

    if (tempHideBtn) {
        tempHideBtn.addEventListener('click', showTempHideModal);
    }

    if (saveTempHideBtn) {
        saveTempHideBtn.addEventListener('click', saveTempHideSettings);
    }

    // Search functionality
    const rulesSearchInput = document.getElementById('searchRules');
    if (rulesSearchInput) {
        rulesSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            displayRulesWithSearch(allRules, searchTerm);
        });
    }
    
    // Variables search functionality
    const variablesSearchInput = document.getElementById('searchVariables');
    if (variablesSearchInput) {
        variablesSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredVariables = allVariables.filter(variable =>
                (variable.name || '').toLowerCase().includes(searchTerm) ||
                (variable.value || '').toLowerCase().includes(searchTerm)
            );
            displayVariables(filteredVariables);
        });
    }


    // Initialize the app
    init();
});
