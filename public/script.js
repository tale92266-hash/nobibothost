document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const rulesList = document.getElementById("rulesList");
    const addRuleBtn = document.getElementById("addRuleBtn");
    const settingsBtn = document.getElementById("settingsBtn");
    const ruleModal = new bootstrap.Modal(document.getElementById("ruleModal"));
    const settingsModal = new bootstrap.Modal(document.getElementById("settingsModal"));
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
    const variablesMenuBtn2 = document.getElementById('variablesMenuBtn2');
    const backToSettingsBtn = document.getElementById('backToSettingsBtn');
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

    // Initialize
    init();

    async function init() {
        try {
            await fetchRules();
            await fetchVariables();
            await fetchStats();
        } catch (error) {
            console.error('Initialization error:', error);
            showToast('Failed to initialize application', 'fail');
        }
    }

    // Stats Functions
    function updateStatsDisplay(data) {
        // Update main stats cards
        document.getElementById('totalUsers').textContent = data.totalUsers || 0;
        document.getElementById('todayUsers').textContent = data.todayUsers || 0;
        document.getElementById('totalMsgs').textContent = (data.totalMsgs || 0).toLocaleString();
        document.getElementById('todayMsgs').textContent = (data.todayMsgs || 0).toLocaleString();
        
        // Update header mini stats
        const headerTotalUsers = document.getElementById('headerTotalUsers');
        const headerTotalMsgs = document.getElementById('headerTotalMsgs');
        if (headerTotalUsers) headerTotalUsers.textContent = data.totalUsers || 0;
        if (headerTotalMsgs) headerTotalMsgs.textContent = (data.totalMsgs || 0).toLocaleString();
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
        toastElement.classList.remove('success', 'fail');
        toastElement.classList.add(type);
        
        const toastInstance = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 4000
        });
        toastInstance.show();
    }

    function showSpinner(spinnerId) {
        const spinner = document.getElementById(spinnerId);
        if (spinner) spinner.style.display = 'inline-block';
    }

    function hideSpinner(spinnerId) {
        const spinner = document.getElementById(spinnerId);
        if (spinner) spinner.style.display = 'none';
    }

    // Rule Functions
    function validateRuleNumber(num) {
        if (num > totalRules + 1) {
            ruleNumberError.style.display = 'block';
            ruleNumberError.innerText = `Rule number cannot be greater than ${totalRules + 1}`;
            return false;
        }
        ruleNumberError.style.display = 'none';
        return true;
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
        loadingMessage.style.display = 'block';
        rulesList.innerHTML = '';
        
        try {
            const response = await fetch('/api/rules');
            const data = await response.json();
            allRules = data;
            totalRules = data.length;
            
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

    function renderRules(rules) {
        rulesList.innerHTML = '';
        
        rules.forEach((rule, index) => {
            const ruleTypeClass = `type-${rule.RULE_TYPE.toLowerCase()}`;
            const item = document.createElement("div");
            item.className = "rule-item";
            item.style.animationDelay = `${index * 0.1}s`;
            
            // Create click handler for editing
            item.addEventListener('click', () => editRule(rule));
            
            // Truncate long text
            const truncateText = (text, maxLength = 100) => {
                return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
            };
            
            const keywords = rule.KEYWORDS === 'ALL' ? 
                '<em>All messages</em>' : 
                rule.KEYWORDS.split('//').slice(0, 3).join(', ');
            
            const reply = rule.REPLY_TEXT.split('<#>')[0];
            
            item.innerHTML = `
                <div class="rule-header">
                    <span class="rule-number">#${rule.RULE_NUMBER}</span>
                    <span class="rule-type ${ruleTypeClass}">${rule.RULE_TYPE}</span>
                </div>
                <div class="rule-content">
                    ${rule.RULE_NAME ? `
                        <div class="rule-field">
                            <strong>Name:</strong>
                            <span>${rule.RULE_NAME}</span>
                        </div>
                    ` : ''}
                    <div class="rule-field">
                        <strong>Keywords:</strong>
                        <span>${keywords}</span>
                    </div>
                    <div class="rule-field">
                        <strong>Reply:</strong>
                        <span>${truncateText(reply)}</span>
                    </div>
                    ${rule.TARGET_USERS && rule.TARGET_USERS !== 'ALL' ? `
                        <div class="rule-field">
                            <strong>Target:</strong>
                            <span>${Array.isArray(rule.TARGET_USERS) ? rule.TARGET_USERS.join(', ') : rule.TARGET_USERS}</span>
                        </div>
                    ` : ''}
                </div>
            `;
            
            rulesList.appendChild(item);
        });
    }

    function openAddRuleModal() {
        currentRuleNumber = null;
        formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Rule';
        deleteRuleBtn.style.display = 'none';
        ruleForm.reset();
        
        // Set default values
        document.getElementById('ruleNumber').value = totalRules + 1;
        document.getElementById('repliesType').value = 'RANDOM';
        document.getElementById('targetUsersToggle').value = 'ALL';
        
        // Reset field visibility
        toggleFormFields('');
        toggleTargetUsersField();
        
        ruleModal.show();
    }

    function editRule(rule) {
        currentRuleNumber = rule.RULE_NUMBER;
        formTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Rule';
        deleteRuleBtn.style.display = 'inline-block';
        
        // Populate form fields
        document.getElementById('ruleNumber').value = rule.RULE_NUMBER;
        document.getElementById('ruleName').value = rule.RULE_NAME || '';
        document.getElementById('ruleType').value = rule.RULE_TYPE;
        document.getElementById('keywords').value = rule.KEYWORDS;
        document.getElementById('repliesType').value = rule.REPLIES_TYPE;
        document.getElementById('replyText').value = rule.REPLY_TEXT;
        
        // Handle target users
        if (rule.TARGET_USERS === 'ALL' || !rule.TARGET_USERS) {
            document.getElementById('targetUsersToggle').value = 'ALL';
            document.getElementById('targetUsers').value = 'ALL';
        } else if (Array.isArray(rule.TARGET_USERS)) {
            document.getElementById('targetUsersToggle').value = 'TARGET';
            document.getElementById('targetUsers').value = rule.TARGET_USERS.join(', ');
        } else {
            document.getElementById('targetUsersToggle').value = 'TARGET';
            document.getElementById('targetUsers').value = rule.TARGET_USERS;
        }
        
        // Update field visibility
        toggleFormFields(rule.RULE_TYPE);
        toggleTargetUsersField();
        
        ruleModal.show();
    }

    async function saveRule(event) {
        event.preventDefault();
        
        const formData = new FormData(ruleForm);
        const ruleData = {
            ruleNumber: parseInt(document.getElementById('ruleNumber').value),
            ruleName: document.getElementById('ruleName').value,
            ruleType: document.getElementById('ruleType').value,
            keywords: document.getElementById('keywords').value,
            repliesType: document.getElementById('repliesType').value,
            replyText: document.getElementById('replyText').value,
            targetUsers: document.getElementById('targetUsersToggle').value === 'ALL' ? 
                'ALL' : 
                document.getElementById('targetUsers').value.split(',').map(u => u.trim()).filter(Boolean)
        };
        
        // Validation
        if (!validateRuleNumber(ruleData.ruleNumber)) {
            return;
        }
        
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
            const response = await fetch('/api/rules/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: currentRuleNumber ? 'edit' : 'add',
                    rule: ruleData,
                    oldRuleNumber: currentRuleNumber
                })
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
            showToast('Failed to save rule', 'fail');
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
            variablesList.innerHTML = '<div class="alert alert-danger">Failed to load variables.</div>';
            showToast("Failed to fetch variables.", "fail");
        }
    }

    function renderVariables(variables) {
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

    function openAddVariableModal() {
        currentVariableName = null;
        document.getElementById('variableFormContainer').style.display = 'block';
        document.getElementById('deleteVariableBtn').style.display = 'none';
        variableForm.reset();
        document.getElementById('variableName').focus();
    }

    function editVariable(variable) {
        currentVariableName = variable.name;
        document.getElementById('variableFormContainer').style.display = 'block';
        document.getElementById('deleteVariableBtn').style.display = 'inline-block';
        
        document.getElementById('variableName').value = variable.name;
        document.getElementById('variableValue').value = variable.value;
        
        document.getElementById('variableName').focus();
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
    addRuleBtn?.addEventListener('click', openAddRuleModal);
    settingsBtn?.addEventListener('click', () => settingsModal.show());
    variablesMenuBtn?.addEventListener('click', () => {
        settingsModal.hide();
        variableModal.show();
    });
    variablesMenuBtn2?.addEventListener('click', () => {
        settingsModal.hide();
        variableModal.show();
    });
    backToSettingsBtn?.addEventListener('click', () => {
        variableModal.hide();
        settingsModal.show();
    });
    
    // Form event listeners
    ruleForm?.addEventListener('submit', saveRule);
    variableForm?.addEventListener('submit', saveVariable);
    deleteRuleBtn?.addEventListener('click', deleteRule);
    deleteVariableBtn?.addEventListener('click', deleteVariable);
    addVariableBtn?.addEventListener('click', openAddVariableModal);
    
    // Form field listeners
    ruleTypeSelect?.addEventListener('change', (e) => toggleFormFields(e.target.value));
    targetUsersToggle?.addEventListener('change', toggleTargetUsersField);
    ruleNumberInput?.addEventListener('input', (e) => validateRuleNumber(parseInt(e.target.value)));

    // Setup search after DOM is loaded
    setupSearch();

    // Make functions globally available for HTML onclick handlers
    window.openAddRuleModal = openAddRuleModal;
    window.editRule = editRule;
    window.editVariable = editVariable;
    window.cancelVariableEdit = cancelVariableEdit;

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

    console.log('Chatbot Admin Panel loaded successfully! 🤖');
});
