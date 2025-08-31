// file: script.js

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const rulesList = document.getElementById("rulesList");
    const addRuleBtn = document.getElementById("addRuleBtn");
    const ruleModal = new bootstrap.Modal(document.getElementById("ruleModal"));
    const variableModal = new bootstrap.Modal(document.getElementById("variableModal"));
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

    // Variables
    let currentRuleNumber = null;
    let currentVariableName = null;
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
                    <strong>Bot:</strong> Reply sent to ${escapeHtml(userName)}
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
        // Add chat tab to bottom navigation if it doesn't exist
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

    // FIXED: Rule Number Validation - NO DOM MANIPULATION
    function validateRuleNumber(num, isEditing = false) {
        const maxAllowed = isEditing ? totalRules : totalRules + 1;

        if (num > maxAllowed) {
            ruleNumberError.style.display = 'block';
            if (isEditing) {
                ruleNumberError.innerText = `In edit mode, rule number cannot be greater than ${totalRules}`;
            } else {
                ruleNumberError.innerText = `In add mode, rule number cannot be greater than ${totalRules + 1}`;
            }
            return false;
        } else if (num < 1) {
            ruleNumberError.style.display = 'block';
            ruleNumberError.innerText = `Rule number must be at least 1`;
            return false;
        }

        ruleNumberError.style.display = 'none';
        return true;
    }

    // FIXED: Safe Input Setup WITHOUT DOM Recreation
    function setupRuleNumberValidation(isEditing = false) {
        const maxAllowed = isEditing ? totalRules : totalRules + 1;

        // Set HTML attributes safely
        ruleNumberInput.setAttribute('max', maxAllowed);
        ruleNumberInput.setAttribute('min', 1);

        console.log(`🔢 Rule number validation setup: min=1, max=${maxAllowed} (${isEditing ? 'Edit' : 'Add'} mode)`);

        // Remove existing event listeners by storing references
        const newHandler = function(e) {
            let value = parseInt(e.target.value);
            if (isNaN(value)) {
                return;
            }

            // Auto-correct out-of-bounds values
            if (value < 1) {
                e.target.value = 1;
                value = 1;
            } else if (value > maxAllowed) {
                e.target.value = maxAllowed;
                value = maxAllowed;
                if (isEditing) {
                    showToast(`Maximum rule number in edit mode is ${totalRules}`, 'warning');
                } else {
                    showToast(`Maximum rule number in add mode is ${totalRules + 1}`, 'warning');
                }
            }

            // Validate the corrected value
            validateRuleNumber(value, isEditing);
        };

        // Remove previous listeners and add new one
        if (ruleNumberInput._currentHandler) {
            ruleNumberInput.removeEventListener('input', ruleNumberInput._currentHandler);
        }
        ruleNumberInput.addEventListener('input', newHandler);
        ruleNumberInput._currentHandler = newHandler; // Store for future removal

        // Prevent invalid input on keydown
        const keydownHandler = function(e) {
            // Allow backspace, delete, tab, escape, enter
            if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
                // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                (e.keyCode === 65 && e.ctrlKey === true) ||
                (e.keyCode === 67 && e.ctrlKey === true) ||
                (e.keyCode === 86 && e.ctrlKey === true) ||
                (e.keyCode === 88 && e.ctrlKey === true) ||
                // Allow home, end, left, right
                (e.keyCode >= 35 && e.keyCode <= 39)) {
                return;
            }
            // Ensure that it is a number and stop the keypress
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

        console.log(`🔄 Reordering: Rule ${oldRuleNumber} → Rule ${newRuleNumber}`);

        // Find actual array indices (not rule numbers)
        const fromIndex = rules.findIndex(r => r.RULE_NUMBER === oldRuleNumber);
        const toIndex = newRuleNumber - 1; // Convert to 0-based index

        if (fromIndex === -1) {
            console.error('❌ Rule not found:', oldRuleNumber);
            return rules;
        }

        if (toIndex < 0 || toIndex >= rules.length) {
            console.error('❌ Invalid target position:', newRuleNumber);
            return rules;
        }

        console.log(`📍 Moving from array index ${fromIndex} to index ${toIndex}`);

        // Create copy and perform the move
        const newRules = [...rules];

        // Remove element from original position
        const [movingRule] = newRules.splice(fromIndex, 1);
        console.log(`📤 Removed rule: ${movingRule.RULE_NAME || 'Unnamed'} (was #${movingRule.RULE_NUMBER})`);

        // Insert element at new position
        newRules.splice(toIndex, 0, movingRule);
        console.log(`📥 Inserted at position ${toIndex}`);

        // Reassign rule numbers sequentially (this is critical!)
        const finalRules = newRules.map((rule, index) => ({
            ...rule,
            RULE_NUMBER: index + 1
        }));

        console.log('✅ New rule order:', finalRules.map(r => `#${r.RULE_NUMBER}: ${r.RULE_NAME || 'Unnamed'}`));

        return finalRules;
    }

    // Bulk Update Rules API Call
    async function bulkUpdateRules(reorderedRules) {
        try {
            console.log('📡 Sending bulk update for', reorderedRules.length, 'rules');
            console.log('📊 Sample rule ', {
                _id: reorderedRules[0]._id,
                RULE_NUMBER: reorderedRules[0].RULE_NUMBER,
                RULE_NAME: reorderedRules[0].RULE_NAME
            });

            const response = await fetch('/api/rules/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules: reorderedRules })
            });

            const result = await response.json();
            console.log('📨 Bulk update response:', result);

            if (result.success) {
                console.log('✅ Bulk update successful');
                if (result.errors && result.errors.length > 0) {
                    console.warn('⚠️ Some errors occurred:', result.errors);
                }
                return true;
            } else {
                console.error('❌ Bulk update failed:', result.message);
                showToast(result.message || 'Failed to update rules order', 'fail');
                return false;
            }
        } catch (error) {
            console.error('❌ Network error during bulk update:', error);
            showToast('Network error during bulk update: ' + error.message, 'fail');
            return false;
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
            console.error('Modal elements not found:', modalType);
            return;
        }

        console.log(`🔧 Configuring ${modalType} modal for ${mode} mode`);

        // Handle delete button visibility
        if (mode === 'add') {
            deleteBtn.style.display = 'none';
            deleteBtn.style.visibility = 'hidden';
            deleteBtn.classList.add('d-none');
            console.log('🚫 Delete button hidden for add mode');
        } else if (mode === 'edit') {
            deleteBtn.style.display = 'inline-flex';
            deleteBtn.style.visibility = 'visible';
            deleteBtn.classList.remove('d-none');
            console.log('👁️ Delete button shown for edit mode');
        }

        // Apply consistent styling to all buttons
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

        console.log(`✅ ${modalType} modal configured successfully for ${mode} mode`);
    }

    // Bottom Navigation Handler
    function initBottomNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const tabPanes = document.querySelectorAll('.tab-pane');

        // Set first tab as active
        if (navItems.length > 0) {
            navItems[0].classList.add('active');
        }

        navItems.forEach(navItem => {
            navItem.addEventListener('click', () => {
                const tabName = navItem.getAttribute('data-tab');

                // Remove active class from all nav items
                navItems.forEach(item => item.classList.remove('active'));

                // Add active class to clicked nav item
                navItem.classList.add('active');

                // Hide all tab panes
                tabPanes.forEach(pane => {
                    pane.classList.remove('show', 'active');
                });

                // Show selected tab pane
                const targetPane = document.getElementById(`${tabName}-pane`);
                if (targetPane) {
                    targetPane.classList.add('show', 'active');
                }

                // Load data based on tab
                if (tabName === 'rules' && allRules.length === 0) {
                    fetchRules();
                } else if (tabName === 'settings' && allVariables.length === 0) {
                    fetchVariables();
                }
            });
        });
    }

    // Initialize
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

    // Stats Functions
    function updateStatsDisplay(data) {
        // Update main stats cards
        const totalUsers = document.getElementById('totalUsers');
        const todayUsers = document.getElementById('todayUsers');
        const totalMsgs = document.getElementById('totalMsgs');
        const todayMsgs = document.getElementById('todayMsgs');

        if (totalUsers) totalUsers.textContent = data.totalUsers || 0;
        if (todayUsers) todayUsers.textContent = data.todayUsers || 0;
        if (totalMsgs) totalMsgs.textContent = (data.totalMsgs || 0).toLocaleString();
        if (todayMsgs) todayMsgs.textContent = (data.todayMsgs || 0).toLocaleString();

        // Update header mini stats
        const headerTotalUsers = document.getElementById('headerTotalUsers');
        const headerTotalMsgs = document.getElementById('headerTotalMsgs');

        if (headerTotalUsers) headerTotalUsers.textContent = data.totalUsers || 0;
        if (headerTotalMsgs) headerTotalMsgs.textContent = (data.totalMsgs || 0).toLocaleString();

        // Update last update time
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
                rulesList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-robot fa-3x"></i>
                        <h5>No Rules Found</h5>
                        <p>Add your first rule to get started!</p>
                    </div>
                `;
                return;
            }

            renderRules(data);

        } catch (error) {
            console.error('Failed to fetch rules:', error);
            loadingMessage.style.display = 'none';
            rulesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-3x"></i>
                    <h5>Error Loading Rules</h5>
                    <p>Please try refreshing the page</p>
                </div>
            `;
        }
    }

    function renderRules(rules, searchTerm = '') {
        rulesList.innerHTML = '';

        if (rules.length === 0) {
            if (searchTerm) {
                rulesList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-search fa-3x"></i>
                        <h5>No Results Found</h5>
                        <p>No rules match your search term "${searchTerm}"</p>
                    </div>
                `;
            } else {
                rulesList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-robot fa-3x"></i>
                        <h5>No Rules Found</h5>
                        <p>Add your first rule to get started!</p>
                    </div>
                `;
            }
            return;
        }

        rules.forEach(rule => {
            const ruleElement = createRuleElement(rule);
            rulesList.appendChild(ruleElement);
        });
    }

    function createRuleElement(rule) {
        const div = document.createElement('div');
        div.className = 'rule-item';
        div.onclick = () => openEditRuleModal(rule);

        const typeClass = rule.RULE_TYPE.toLowerCase();
        const targetUsers = Array.isArray(rule.TARGET_USERS) ? rule.TARGET_USERS.join(', ') : rule.TARGET_USERS;
        const isTargetSpecific = targetUsers !== 'ALL';

        const truncatedReply = rule.REPLY_TEXT.length > 150 ?
            rule.REPLY_TEXT.substring(0, 150) + '...' :
            rule.REPLY_TEXT;

        div.innerHTML = `
            <div class="rule-header-new">
                <div class="rule-title">
                    <span class="rule-number-new">${rule.RULE_NUMBER}</span>
                    <span class="rule-name-new">${rule.RULE_NAME || 'Unnamed Rule'}</span>
                </div>
                <span class="rule-type ${typeClass}">${rule.RULE_TYPE}</span>
            </div>
            <div class="rule-content-new">
                ${rule.RULE_TYPE !== 'WELCOME' && rule.RULE_TYPE !== 'DEFAULT' ? `
                    <div class="rule-line">
                        <strong>Keywords:</strong> ${rule.KEYWORDS}
                    </div>
                ` : ''}
                <div class="rule-line">
                    <strong>Type:</strong> ${rule.REPLIES_TYPE}
                </div>
                ${isTargetSpecific ? `
                    <div class="rule-line">
                        <strong>Target:</strong> ${targetUsers}
                    </div>
                ` : ''}
                <div class="rule-reply">
                    <strong>Reply:</strong>
                    <div class="reply-text">${truncatedReply}</div>
                </div>
            </div>
        `;

        return div;
    }

    // Search functionality
    function setupSearch() {
        const searchInput = document.getElementById('searchRules');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            if (!searchTerm) {
                renderRules(allRules);
                return;
            }

            const filteredRules = allRules.filter(rule => {
                return (
                    (rule.RULE_NAME || '').toLowerCase().includes(searchTerm) ||
                    rule.RULE_TYPE.toLowerCase().includes(searchTerm) ||
                    rule.KEYWORDS.toLowerCase().includes(searchTerm) ||
                    rule.REPLY_TEXT.toLowerCase().includes(searchTerm) ||
                    rule.REPLIES_TYPE.toLowerCase().includes(searchTerm)
                );
            });

            renderRules(filteredRules, searchTerm);
        });
    }

    // Rule Modal Functions
    function openAddRuleModal() {
        currentRuleNumber = null;
        setupRuleNumberValidation(false);
        
        formTitle.textContent = 'Add New Rule';
        
        ruleForm.reset();
        document.getElementById('ruleNumber').value = totalRules + 1;
        document.getElementById('ruleType').value = 'EXACT';
        document.getElementById('repliesType').value = 'RANDOM';
        document.getElementById('targetUsersToggle').value = 'ALL';
        
        toggleFormFields('EXACT');
        toggleTargetUsersField();
        
        configureModalButtons('rule', 'add');
        ruleModal.show();
    }

    function openEditRuleModal(rule) {
        currentRuleNumber = rule.RULE_NUMBER;
        setupRuleNumberValidation(true);
        
        formTitle.textContent = 'Edit Rule';
        
        document.getElementById('ruleNumber').value = rule.RULE_NUMBER;
        document.getElementById('ruleName').value = rule.RULE_NAME || '';
        document.getElementById('ruleType').value = rule.RULE_TYPE;
        document.getElementById('keywords').value = rule.KEYWORDS;
        document.getElementById('repliesType').value = rule.REPLIES_TYPE;
        document.getElementById('replyText').value = rule.REPLY_TEXT;
        
        if (Array.isArray(rule.TARGET_USERS)) {
            document.getElementById('targetUsersToggle').value = 'TARGET';
            document.getElementById('targetUsers').value = rule.TARGET_USERS.join(', ');
        } else if (rule.TARGET_USERS === 'ALL') {
            document.getElementById('targetUsersToggle').value = 'ALL';
            document.getElementById('targetUsers').value = '';
        }
        
        toggleFormFields(rule.RULE_TYPE);
        toggleTargetUsersField();
        
        configureModalButtons('rule', 'edit');
        ruleModal.show();
    }

    async function saveRule() {
        const formData = new FormData(ruleForm);
        const ruleNumber = parseInt(formData.get('ruleNumber'));
        
        if (!validateRuleNumber(ruleNumber, currentRuleNumber !== null)) {
            return;
        }

        const ruleData = {
            ruleNumber: ruleNumber,
            ruleName: formData.get('ruleName'),
            ruleType: formData.get('ruleType'),
            keywords: formData.get('keywords'),
            repliesType: formData.get('repliesType'),
            replyText: formData.get('replyText'),
            targetUsers: formData.get('targetUsersToggle') === 'ALL' ? 'ALL' : 
                        formData.get('targetUsers').split(',').map(u => u.trim()).filter(u => u)
        };

        const payload = {
            type: currentRuleNumber ? 'edit' : 'add',
            rule: ruleData,
            oldRuleNumber: currentRuleNumber
        };

        try {
            const response = await fetch('/api/rules/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showToast(result.message, 'success');
                ruleModal.hide();
                await fetchRules();
            } else {
                showToast(result.message || 'Failed to save rule', 'fail');
            }
        } catch (error) {
            console.error('Error saving rule:', error);
            showToast('Network error occurred', 'fail');
        }
    }

    async function deleteRule() {
        if (!currentRuleNumber) return;

        if (!confirm('Are you sure you want to delete this rule?')) return;

        try {
            const response = await fetch('/api/rules/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'delete',
                    rule: { ruleNumber: currentRuleNumber }
                })
            });

            const result = await response.json();

            if (result.success) {
                showToast('Rule deleted successfully', 'success');
                ruleModal.hide();
                await fetchRules();
            } else {
                showToast(result.message || 'Failed to delete rule', 'fail');
            }
        } catch (error) {
            console.error('Error deleting rule:', error);
            showToast('Network error occurred', 'fail');
        }
    }

    // Variable Functions
    async function fetchVariables() {
        try {
            const response = await fetch('/api/variables');
            const data = await response.json();
            allVariables = data;
            renderVariables(data);
        } catch (error) {
            console.error('Failed to fetch variables:', error);
        }
    }

    function renderVariables(variables) {
        if (!variablesList) return;

        variablesList.innerHTML = '';

        if (variables.length === 0) {
            variablesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-code fa-3x"></i>
                    <h6>No Variables Found</h6>
                    <p>Create variables to use dynamic content in your rules.</p>
                </div>
            `;
            return;
        }

        variables.forEach(variable => {
            const variableElement = createVariableElement(variable);
            variablesList.appendChild(variableElement);
        });
    }

    function createVariableElement(variable) {
        const div = document.createElement('div');
        div.className = 'variable-item';
        div.onclick = () => openEditVariableModal(variable);
        
        const truncatedValue = variable.value.length > 150 ?
            variable.value.substring(0, 150) + '...' :
            variable.value;

        div.innerHTML = `
            <div class="variable-header">
                <span class="variable-name">%${variable.name}%</span>
            </div>
            <div class="variable-value">${truncatedValue}</div>
        `;

        return div;
    }

    function openAddVariableModal() {
        currentVariableName = null;
        
        variableFormContainer.style.display = 'block';
        
        // Reset form for new data
        document.getElementById('variableName').value = '';
        document.getElementById('variableValue').value = '';
        
        configureModalButtons('variable', 'add');
    }

    function openEditVariableModal(variable) {
        currentVariableName = variable.name;
        
        variableFormContainer.style.display = 'block';
        
        document.getElementById('variableName').value = variable.name;
        document.getElementById('variableValue').value = variable.value;

        configureModalButtons('variable', 'edit');
    }

    // Global function for cancel variable edit
    window.cancelVariableEdit = function() {
        variableFormContainer.style.display = 'none';
        variableForm.reset();
        currentVariableName = null;
    }

    async function saveVariable() {
        const variableName = document.getElementById('variableName').value.trim();
        const variableValue = document.getElementById('variableValue').value.trim();

        if (!variableName || !variableValue) {
            showToast("Variable name and value cannot be empty.", "warning");
            return;
        }

        const variableData = {
            name: variableName,
            value: variableValue
        };

        const payload = {
            type: currentVariableName ? 'edit' : 'add',
            variable: variableData,
            oldName: currentVariableName
        };

        try {
            const response = await fetch('/api/variables/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showToast(result.message, 'success');
                cancelVariableEdit();
                await fetchVariables();
            } else {
                showToast(result.message || 'Failed to save variable', 'fail');
            }
        } catch (error) {
            console.error('Error saving variable:', error);
            showToast('Network error occurred', 'fail');
        }
    }

    async function deleteVariable() {
        if (!currentVariableName) return;

        if (!confirm('Are you sure you want to delete this variable?')) return;

        try {
            const response = await fetch('/api/variables/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'delete',
                    variable: { name: currentVariableName }
                })
            });

            const result = await response.json();

            if (result.success) {
                showToast('Variable deleted successfully', 'success');
                cancelVariableEdit();
                await fetchVariables();
            } else {
                showToast(result.message || 'Failed to delete variable', 'fail');
            }
        } catch (error) {
            console.error('Error deleting variable:', error);
            showToast('Network error occurred', 'fail');
        }
    }

    // Event Listeners
    if (addRuleBtn) {
        addRuleBtn.addEventListener('click', openAddRuleModal);
    }

    if (saveRuleBtn) {
        saveRuleBtn.addEventListener('click', saveRule);
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

    if (variablesMenuBtn) {
        variablesMenuBtn.addEventListener('click', () => {
            fetchVariables();
            variableModal.show();
        });
    }

    if (addVariableBtn) {
        addVariableBtn.addEventListener('click', openAddVariableModal);
    }

    if (saveVariableBtn) {
        saveVariableBtn.addEventListener('click', saveVariable);
    }

    if (deleteVariableBtn) {
        deleteVariableBtn.addEventListener('click', deleteVariable);
    }
    
    // Initialize the app
    setupSearch();
    init();

    // Socket event listeners
    socket.on('rulesUpdated', () => {
        fetchRules();
    });

    socket.on('variablesUpdated', () => {
        fetchVariables();
    });
});
