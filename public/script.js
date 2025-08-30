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
            console.log('📊 Sample rule data:', {
                _id: reorderedRules[0]._id,
                RULE_NUMBER: reorderedRules[0].RULE_NUMBER,
                RULE_NAME: reorderedRules[0].RULE_NAME
            });
            
            const response = await fetch('/api/rules/bulk-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rules: reorderedRules
                })
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
                    <div class="empty-state text-center py-5">
                        <i class="fas fa-list-check fa-4x mb-3 text-muted"></i>
                        <h5 class="text-muted">No rules found</h5>
                        <p class="text-muted">Add your first rule to get started!</p>
                        <button class="btn btn-primary mt-3" onclick="openAddRuleModal()">
                            <i class="fas fa-plus"></i> Add First Rule
                        </button>
                    </div>`;
            } else {
                renderRules(data);
            }
        } catch (error) {
            loadingMessage.innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle"></i> Failed to load rules.</div>';
            showToast("Failed to fetch rules.", "fail");
            console.error('Error fetching rules:', error);
        }
    }

    // Render Rules Function
    function renderRules(rules) {
        if (!rulesList) return;
        
        rulesList.innerHTML = '';
        
        rules.forEach((rule, index) => {
            const ruleTypeClass = `type-${rule.RULE_TYPE.toLowerCase()}`;
            const item = document.createElement("div");
            item.className = "rule-item";
            item.style.animationDelay = `${index * 0.1}s`;
            
            // Create click handler for editing
            item.addEventListener('click', () => editRule(rule));
            
            // Format rule number with leading zero
            const ruleNumber = rule.RULE_NUMBER.toString().padStart(2, '0');
            
            // Rule name - show (no name) if empty
            const ruleName = rule.RULE_NAME && rule.RULE_NAME.trim() ? rule.RULE_NAME : '(no name)';
            
            // Keywords - show * for ALL
            let keywords = rule.KEYWORDS;
            if (!keywords || keywords.trim() === '' || keywords.toUpperCase() === 'ALL') {
                keywords = '*';
            }
            
            // Reply text as is
            const replyText = rule.REPLY_TEXT || '';
            
            // Truncate long text for display
            const truncateText = (text, maxLength = 80) => {
                return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
            };
            
            item.innerHTML = `
                <div class="rule-header-new">
                    <div class="rule-title">
                        <span class="rule-number-new">#${ruleNumber}</span>
                        <span class="rule-name-new">${ruleName}</span>
                    </div>
                    <span class="rule-type ${ruleTypeClass}">${rule.RULE_TYPE}</span>
                </div>
                <div class="rule-content-new">
                    <div class="rule-line">
                        <strong>KEYWORD:</strong>
                        <span>${keywords}</span>
                    </div>
                    <div class="rule-reply">
                        <strong>reply:</strong>
                        <div class="reply-text">${truncateText(replyText)}</div>
                    </div>
                </div>
            `;
            
            rulesList.appendChild(item);
        });
    }

    // FIXED: Add Rule Modal with Safe Input Validation
    function openAddRuleModal() {
        try {
            currentRuleNumber = null;
            formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Rule';
            
            // Reset form
            if (ruleForm) ruleForm.reset();
            
            // FIXED: Setup input validation for ADD mode WITHOUT DOM recreation
            setupRuleNumberValidation(false); // false = Add mode
            ruleNumberInput.value = totalRules + 1; // Set to next available number
            
            // Set default values
            const repliesTypeSelect = document.getElementById('repliesType');
            const targetUsersToggle = document.getElementById('targetUsersToggle');
            
            if (repliesTypeSelect) repliesTypeSelect.value = 'RANDOM';
            if (targetUsersToggle) targetUsersToggle.value = 'ALL';
            
            // Reset field visibility
            toggleFormFields('');
            toggleTargetUsersField();
            
            console.log(`➕ Opening ADD modal - Rule number range: 1 to ${totalRules + 1}`);
            
            // Show modal
            ruleModal.show();
            
            // Configure buttons
            setTimeout(() => {
                configureModalButtons('rule', 'add');
            }, 100);
            
        } catch (error) {
            console.error('Error opening add rule modal:', error);
            showToast('Failed to open add rule form', 'fail');
        }
    }

    // FIXED: Edit Rule Modal with Safe Input Validation  
    function editRule(rule) {
        try {
            if (!rule) {
                showToast('Invalid rule data', 'fail');
                return;
            }
            
            console.log('🔧 Editing rule:', rule.RULE_NUMBER, rule.RULE_NAME);
            
            currentRuleNumber = rule.RULE_NUMBER;
            formTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Rule';
            
            // FIXED: Setup input validation for EDIT mode WITHOUT DOM recreation
            setupRuleNumberValidation(true); // true = Edit mode
            ruleNumberInput.value = rule.RULE_NUMBER;
            
            // Populate form fields safely
            const fields = {
                'ruleName': rule.RULE_NAME || '',
                'ruleType': rule.RULE_TYPE,
                'keywords': rule.KEYWORDS,
                'repliesType': rule.REPLIES_TYPE,
                'replyText': rule.REPLY_TEXT
            };
            
            Object.keys(fields).forEach(fieldId => {
                const element = document.getElementById(fieldId);
                if (element) {
                    element.value = fields[fieldId];
                }
            });
            
            // Handle target users properly
            const targetUsersToggleEl = document.getElementById('targetUsersToggle');
            const targetUsersEl = document.getElementById('targetUsers');
            
            if (rule.TARGET_USERS === 'ALL' || !rule.TARGET_USERS) {
                if (targetUsersToggleEl) targetUsersToggleEl.value = 'ALL';
                if (targetUsersEl) targetUsersEl.value = 'ALL';
            } else if (Array.isArray(rule.TARGET_USERS)) {
                if (targetUsersToggleEl) targetUsersToggleEl.value = 'TARGET';
                if (targetUsersEl) targetUsersEl.value = rule.TARGET_USERS.join(', ');
            } else {
                if (targetUsersToggleEl) targetUsersToggleEl.value = 'TARGET';
                if (targetUsersEl) targetUsersEl.value = rule.TARGET_USERS;
            }
            
            // Update field visibility
            toggleFormFields(rule.RULE_TYPE);
            toggleTargetUsersField();
            
            console.log(`✏️ Opening EDIT modal - Rule number range: 1 to ${totalRules}`);
            
            // Show modal
            ruleModal.show();
            
            // Configure buttons  
            setTimeout(() => {
                configureModalButtons('rule', 'edit');
            }, 100);
            
        } catch (error) {
            console.error('Error editing rule:', error);
            showToast('Failed to load rule for editing', 'fail');
        }
    }

    // Save Rule Function
    async function saveRule(event) {
        event.preventDefault();
        
        const newRuleNumber = parseInt(document.getElementById('ruleNumber').value);
        const isEditing = currentRuleNumber !== null;
        
        // FIXED: Validate with correct mode
        if (!validateRuleNumber(newRuleNumber, isEditing)) {
            return;
        }
        
        const ruleData = {
            ruleNumber: newRuleNumber,
            ruleName: document.getElementById('ruleName').value,
            ruleType: document.getElementById('ruleType').value,
            keywords: document.getElementById('keywords').value,
            repliesType: document.getElementById('repliesType').value,
            replyText: document.getElementById('replyText').value,
            targetUsers: document.getElementById('targetUsersToggle').value === 'ALL' ? 
                'ALL' : 
                document.getElementById('targetUsers').value.split(',').map(u => u.trim()).filter(Boolean)
        };
        
        if (!ruleData.ruleType || !ruleData.replyText.trim()) {
            showToast('Please fill in all required fields', 'fail');
            return;
        }
        
        // Show loading
        const saveBtn = document.getElementById('saveRuleBtn');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
        saveBtn.disabled = true;
        
        try {
            if (currentRuleNumber) {
                // EDIT MODE: Check if rule number changed
                if (currentRuleNumber !== newRuleNumber) {
                    console.log(`🔄 Rule number changed: ${currentRuleNumber} → ${newRuleNumber}`);
                    
                    // Reorder all rules based on new number with correct logic
                    const reorderedRules = reorderRulesArray(allRules, currentRuleNumber, newRuleNumber);
                    
                    // Update the specific rule data in reordered array
                    const targetRule = reorderedRules.find(r => r.RULE_NUMBER === newRuleNumber);
                    if (targetRule) {
                        console.log('🎯 Updating target rule data');
                        Object.assign(targetRule, {
                            RULE_NAME: ruleData.ruleName,
                            RULE_TYPE: ruleData.ruleType,
                            KEYWORDS: ruleData.keywords,
                            REPLIES_TYPE: ruleData.repliesType,
                            REPLY_TEXT: ruleData.replyText,
                            TARGET_USERS: ruleData.targetUsers
                        });
                    }
                    
                    console.log('📤 Sending bulk update to server...');
                    
                    // Send bulk update
                    const bulkSuccess = await bulkUpdateRules(reorderedRules);
                    if (bulkSuccess) {
                        showToast(`Rule moved to position ${newRuleNumber} and all rules reordered successfully!`, 'success');
                        allRules = reorderedRules; // Update local array
                        console.log('✅ Local rules array updated');
                    } else {
                        throw new Error('Bulk update failed');
                    }
                } else {
                    console.log('📝 Normal edit without number change');
                    // Normal edit without number change
                    const response = await fetch('/api/rules/update', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            type: 'edit',
                            rule: ruleData,
                            oldRuleNumber: currentRuleNumber
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showToast(result.message, 'success');
                    } else {
                        throw new Error(result.message || 'Failed to save rule');
                    }
                }
            } else {
                console.log('➕ Adding new rule');
                // ADD MODE: Regular add
                const response = await fetch('/api/rules/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'add',
                        rule: ruleData
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showToast(result.message, 'success');
                } else {
                    throw new Error(result.message || 'Failed to save rule');
                }
            }
            
            ruleModal.hide();
            await fetchRules(); // Refresh rules list
            
        } catch (error) {
            console.error('❌ Error saving rule:', error);
            showToast(error.message || 'Failed to save rule', 'fail');
        } finally {
            // Restore button
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    async function deleteRule() {
        if (!currentRuleNumber) return;
        
        if (!confirm('Are you sure you want to delete this rule?')) {
            return;
        }
        
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
                showToast('Rule deleted successfully', 'success');
                ruleModal.hide();
                await fetchRules();
            } else {
                showToast('Failed to delete rule', 'fail');
            }
        } catch (error) {
            console.error('Error deleting rule:', error);
            showToast('Failed to delete rule', 'fail');
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
            console.error('Error fetching variables:', error);
            if (variablesList) {
                variablesList.innerHTML = '<div class="alert alert-danger">Failed to load variables.</div>';
            }
            showToast("Failed to fetch variables.", "fail");
        }
    }

    function renderVariables(variables) {
        if (!variablesList) return;
        
        variablesList.innerHTML = '';
        
        if (variables.length === 0) {
            variablesList.innerHTML = `
                <div class="empty-state text-center py-4">
                    <i class="fas fa-code fa-3x mb-3 text-muted"></i>
                    <h6 class="text-muted">No variables found</h6>
                    <p class="text-muted mb-0">Create variables to use dynamic content in your rules.</p>
                </div>`;
            return;
        }
        
        variables.forEach((variable, index) => {
            const item = document.createElement('div');
            item.className = 'variable-item';
            item.style.animationDelay = `${index * 0.1}s`;
            
            item.addEventListener('click', () => editVariable(variable));
            
            const truncateValue = (text, maxLength = 100) => {
                return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
            };
            
            item.innerHTML = `
                <div class="variable-header">
                    <span class="variable-name">%${variable.name}%</span>
                </div>
                <div class="variable-value">${truncateValue(variable.value)}</div>
            `;
            
            variablesList.appendChild(item);
        });
    }

    // Add Variable Modal
    function openAddVariableModal() {
        currentVariableName = null;
        document.getElementById('variableFormContainer').style.display = 'block';
        
        variableForm.reset();
        document.getElementById('variableName').focus();
        
        // Configure buttons
        setTimeout(() => {
            configureModalButtons('variable', 'add');
        }, 100);
    }

    // Edit Variable Modal  
    function editVariable(variable) {
        currentVariableName = variable.name;
        document.getElementById('variableFormContainer').style.display = 'block';
        
        document.getElementById('variableName').value = variable.name;
        document.getElementById('variableValue').value = variable.value;
        
        document.getElementById('variableName').focus();
        
        // Configure buttons
        setTimeout(() => {
            configureModalButtons('variable', 'edit');
        }, 100);
    }

    async function saveVariable(event) {
        event.preventDefault();
        
        const variableData = {
            name: document.getElementById('variableName').value.trim(),
            value: document.getElementById('variableValue').value.trim()
        };
        
        // Validation
        if (!variableData.name || !variableData.value) {
            showToast('Please fill in all fields', 'fail');
            return;
        }
        
        // Validate variable name (alphanumeric and underscore only)
        if (!/^[a-zA-Z0-9_]+$/.test(variableData.name)) {
            showToast('Variable name can only contain letters, numbers, and underscores', 'fail');
            return;
        }
        
        // Show loading
        const saveBtn = document.getElementById('saveVariableBtn');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
        saveBtn.disabled = true;
        
        try {
            const response = await fetch('/api/variables/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: currentVariableName ? 'edit' : 'add',
                    variable: variableData,
                    oldName: currentVariableName
                })
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
            showToast('Failed to save variable', 'fail');
        } finally {
            // Restore button
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    async function deleteVariable() {
        if (!currentVariableName) return;
        
        if (!confirm(`Are you sure you want to delete variable "${currentVariableName}"?`)) {
            return;
        }
        
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
                showToast('Variable deleted successfully', 'success');
                cancelVariableEdit();
                await fetchVariables();
            } else {
                showToast('Failed to delete variable', 'fail');
            }
        } catch (error) {
            console.error('Error deleting variable:', error);
            showToast('Failed to delete variable', 'fail');
        }
    }

    function cancelVariableEdit() {
        document.getElementById('variableFormContainer').style.display = 'none';
        document.getElementById('variableName').value = '';
        document.getElementById('variableValue').value = '';
        document.getElementById('deleteVariableBtn').style.display = 'none';
        currentVariableName = null;
    }

    // Search functionality
    function setupSearch() {
        const searchInput = document.getElementById('searchRules');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', function(e) {
                const searchTerm = e.target.value.toLowerCase().trim();
                
                // Clear previous timeout
                clearTimeout(searchTimeout);
                
                // Debounce search
                searchTimeout = setTimeout(() => {
                    filterRules(searchTerm);
                }, 300);
            });
        }
    }

    function filterRules(searchTerm) {
        if (!searchTerm) {
            renderRules(allRules);
            return;
        }
        
        const filteredRules = allRules.filter(rule => {
            const searchableText = [
                rule.RULE_NAME || '',
                rule.RULE_TYPE || '',
                rule.KEYWORDS || '',
                rule.REPLY_TEXT || '',
                rule.RULE_NUMBER.toString()
            ].join(' ').toLowerCase();
            
            return searchableText.includes(searchTerm);
        });
        
        renderRules(filteredRules);
        
        // Show search results info
        if (filteredRules.length === 0) {
            rulesList.innerHTML = `
                <div class="empty-state text-center py-4">
                    <i class="fas fa-search fa-3x mb-3 text-muted"></i>
                    <h6 class="text-muted">No rules found</h6>
                    <p class="text-muted">No rules match your search term "${searchTerm}"</p>
                    <button class="btn btn-outline-primary btn-sm" onclick="clearSearch()">
                        <i class="fas fa-times"></i> Clear Search
                    </button>
                </div>`;
        }
    }

    function clearSearch() {
        const searchInput = document.getElementById('searchRules');
        if (searchInput) {
            searchInput.value = '';
            renderRules(allRules);
        }
    }

    // Make clearSearch global for HTML onclick
    window.clearSearch = clearSearch;

    // Event Listeners
    if (addRuleBtn) addRuleBtn.addEventListener('click', openAddRuleModal);
    if (variablesMenuBtn) variablesMenuBtn.addEventListener('click', () => variableModal.show());
    
    // Form event listeners
    if (ruleForm) ruleForm.addEventListener('submit', saveRule);
    if (variableForm) variableForm.addEventListener('submit', saveVariable);
    if (deleteRuleBtn) deleteRuleBtn.addEventListener('click', deleteRule);
    if (deleteVariableBtn) deleteVariableBtn.addEventListener('click', deleteVariable);
    if (addVariableBtn) addVariableBtn.addEventListener('click', openAddVariableModal);
    
    // Form field listeners
    if (ruleTypeSelect) ruleTypeSelect.addEventListener('change', (e) => toggleFormFields(e.target.value));
    if (targetUsersToggle) targetUsersToggle.addEventListener('change', toggleTargetUsersField);

    // Setup search after DOM is loaded
    setupSearch();

    // Make functions globally available for HTML onclick handlers
    window.openAddRuleModal = openAddRuleModal;
    window.editRule = editRule;
    window.editVariable = editVariable;
    window.cancelVariableEdit = cancelVariableEdit;

// ADD THIS SECTION TO YOUR EXISTING script.js

// Live Messages Functionality
let messagesContainer;
let liveMessagesSocket;

// Initialize Live Messages
function initLiveMessages() {
  messagesContainer = document.getElementById('messagesContainer');
  
  // Connect to socket for live messages
  liveMessagesSocket = io();
  
  liveMessagesSocket.on('connect', () => {
    console.log('📡 Connected to live messages socket');
  });
  
  liveMessagesSocket.on('newLiveMessage', (data) => {
    console.log('📨 New live message received:', data);
    updateLiveMessages(data.messages);
  });
  
  liveMessagesSocket.on('disconnect', () => {
    console.log('📡 Disconnected from live messages socket');
  });
}

// Update Live Messages Display
function updateLiveMessages(messages) {
  if (!messagesContainer) return;
  
  if (!messages || messages.length === 0) {
    messagesContainer.innerHTML = `
      <div style="text-align: center; color: #666; padding: 2rem;">
        <i class="fas fa-inbox"></i>
        <p>No messages yet...</p>
      </div>
    `;
    return;
  }
  
  messagesContainer.innerHTML = messages.map(msg => `
    <div class="message-item" style="
      background: white;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.75rem;
      border-left: 4px solid #667eea;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    ">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
        <div style="font-weight: 600; color: #667eea; font-size: 0.875rem;">
          <i class="fas fa-user"></i> ${msg.sessionId}
        </div>
        <div style="font-size: 0.75rem; color: #666;">
          <i class="fas fa-clock"></i> ${msg.timestamp}
        </div>
      </div>
      <div style="margin-bottom: 0.5rem;">
        <strong style="color: #333; font-size: 0.875rem;">Message:</strong>
        <div style="background: #f8f9fa; padding: 0.5rem; border-radius: 4px; margin-top: 0.25rem; font-size: 0.875rem;">
          ${msg.message}
        </div>
      </div>
      <div>
        <strong style="color: #333; font-size: 0.875rem;">Reply:</strong>
        <div style="background: #e8f4fd; padding: 0.5rem; border-radius: 4px; margin-top: 0.25rem; font-size: 0.875rem; color: #0066cc;">
          ${msg.reply}
        </div>
      </div>
    </div>
  `).join('');
  
  // Auto scroll to top for latest message
  const liveArea = document.getElementById('liveMessagesArea');
  if (liveArea) {
    liveArea.scrollTop = 0;
  }
}

// ADD TO YOUR EXISTING init() FUNCTION
async function init() {
  try {
    initBottomNavigation();
    initLiveMessages(); // ADD THIS LINE
    await fetchStats();
    await fetchRules();
    await fetchVariables();
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Failed to initialize application', 'fail');
  }
}


    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + N for new rule
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            openAddRuleModal();
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            if (document.getElementById('variableFormContainer').style.display === 'block') {
                cancelVariableEdit();
            }
        }
    });

    // Auto-refresh stats every 30 seconds
    setInterval(fetchStats, 30000);

    // Initialize everything
    init();

    console.log('🤖 Chatbot Admin Panel loaded successfully!');
});
