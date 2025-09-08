// file: public/rules.js

let currentRuleNumber = null;
let allRules = [];
let totalRules = 0;

const ruleModal = new bootstrap.Modal(document.getElementById("ruleModal"));
const ruleForm = document.getElementById("ruleForm");
const ruleNumberInput = document.getElementById('ruleNumber');
const ruleNumberError = document.getElementById('ruleNumberError');
const ruleTypeSelect = document.getElementById('ruleType');
const keywordsField = document.getElementById('keywordsField');
const repliesTypeField = document.getElementById('repliesTypeField');
const replyTextField = document.getElementById('replyTextField');
const targetUsersToggle = document.getElementById('targetUsersToggle');
const targetUsersField = document.getElementById('targetUsersField');
const rulesList = document.getElementById("rulesList");

/**
 * Initializes rules management and sets up event listeners.
 */
function initRules() {
    document.getElementById("addRuleBtn")?.addEventListener('click', addNewRule);
    document.getElementById("saveRuleBtn")?.addEventListener('click', saveRule);
    document.getElementById("deleteRuleBtn")?.addEventListener('click', deleteRule);
    rulesList?.addEventListener('click', handleRuleClick);
    ruleTypeSelect?.addEventListener('change', (e) => toggleFormFields(e.target.value));
    targetUsersToggle?.addEventListener('change', toggleTargetUsersField);
    
    const rulesSearchInput = document.getElementById('searchRules');
    if (rulesSearchInput) {
        rulesSearchInput.addEventListener('input', (e) => {
            displayRulesWithSearch(allRules, e.target.value.toLowerCase());
        });
    }
}

/**
 * Handles clicks on the rules list to open the edit modal.
 * @param {Event} e - The click event.
 */
function handleRuleClick(e) {
    const ruleItem = e.target.closest('.rule-item');
    if (ruleItem) {
        const ruleNumber = parseInt(ruleItem.dataset.ruleNumber);
        const rule = allRules.find(r => r.RULE_NUMBER === ruleNumber);
        if (rule) {
            editRule(rule);
        }
    }
}

/**
 * Fetches all rules from the server and displays them.
 */
async function fetchRules() {
    if (!rulesList) return;
    rulesList.innerHTML = '';
    
    toggleLoading(true);
    
    try {
        const data = await fetchRulesApi();
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
    } finally {
        toggleLoading(false);
    }
}

/**
 * Displays rules based on a search term.
 * @param {Array<object>} rules - The array of rules.
 * @param {string} searchTerm - The search term.
 */
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

/**
 * Creates a single rule DOM element.
 * @param {object} rule - The rule object.
 * @returns {HTMLElement} The created rule element.
 */
function createRuleElement(rule) {
    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'rule-item';
    ruleDiv.setAttribute('data-rule-number', rule.RULE_NUMBER);
    const ruleTypeClass = (rule.RULE_TYPE || '').toLowerCase();
    const targetUsersDisplay = Array.isArray(rule.TARGET_USERS) 
        ? rule.TARGET_USERS.join(', ') 
        : (rule.TARGET_USERS || 'ALL');
    
    const delayInfo = (rule.REPLIES_TYPE === 'ALL' && rule.ENABLE_DELAY)
        ? `<span class="rule-delay-info">⏰ ${rule.REPLY_DELAY}s delay</span>` 
        : '';

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
    return ruleDiv;
}

/**
 * Opens the modal to add a new rule.
 */
function addNewRule() {
    currentRuleNumber = null;
    document.getElementById('formTitle').textContent = 'Add New Rule';
    ruleForm.reset();
    ruleNumberInput.value = totalRules + 1;
    document.getElementById('ruleType').value = 'EXACT';
    document.getElementById('repliesType').value = 'RANDOM';
    document.getElementById('targetUsersToggle').value = 'ALL';
    targetUsersField.style.display = 'none';
    toggleFormFields('EXACT');
    setupRuleNumberValidation(false);
    configureModalButtons('rule', 'add');
    ruleModal.show();
}

/**
 * Opens the modal to edit an existing rule.
 * @param {object} rule - The rule object to edit.
 */
function editRule(rule) {
    currentRuleNumber = rule.RULE_NUMBER;
    document.getElementById('formTitle').textContent = 'Edit Rule';
    ruleNumberInput.value = rule.RULE_NUMBER;
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

/**
 * Saves or updates a rule.
 */
async function saveRule() {
    if (!validateRuleForm()) return;

    const saveBtn = document.getElementById('saveRuleBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;

    try {
        const ruleData = {
            ruleNumber: parseInt(ruleNumberInput.value),
            ruleName: document.getElementById('ruleName').value.trim(),
            ruleType: ruleTypeSelect.value,
            keywords: document.getElementById('keywords').value.trim(),
            repliesType: document.getElementById('repliesType').value,
            replyText: document.getElementById('replyText').value.trim(),
            targetUsers: document.getElementById('targetUsers').value.trim() || 'ALL'
        };

        const isEditing = currentRuleNumber !== null;
        const requestData = {
            type: isEditing ? 'edit' : 'add',
            rule: ruleData,
            oldRuleNumber: currentRuleNumber
        };

        const result = await updateRuleApi(requestData);
        showToast(result.message || 'Rule saved successfully!', 'success');
        ruleModal.hide();
        await fetchRules();
        currentRuleNumber = null;
    } catch (error) {
        showToast('Failed to save rule: ' + error.message, 'fail');
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

/**
 * Deletes an existing rule.
 */
async function deleteRule() {
    if (currentRuleNumber === null) return;
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
        const result = await updateRuleApi({
            type: 'delete',
            rule: { ruleNumber: currentRuleNumber }
        });
        showToast(result.message || 'Rule deleted successfully!', 'success');
        ruleModal.hide();
        await fetchRules();
        currentRuleNumber = null;
    } catch (error) {
        showToast('Failed to delete rule: ' + error.message, 'fail');
    }
}

/**
 * Validates the rule form fields.
 * @returns {boolean} - True if the form is valid, false otherwise.
 */
function validateRuleForm() {
    const ruleNumber = ruleNumberInput.value.trim();
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

/**
 * Toggles the visibility of form fields based on the rule type.
 * @param {string} ruleType - The type of rule.
 */
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

/**
 * Toggles the visibility of the target users field.
 */
function toggleTargetUsersField() {
    const isTargetOrIgnored = targetUsersToggle.value === 'TARGET' || targetUsersToggle.value === 'IGNORED';
    targetUsersField.style.display = isTargetOrIgnored ? 'block' : 'none';
    if (!isTargetOrIgnored) {
        document.getElementById('targetUsers').value = "ALL";
    }
}

/**
 * Sets up the validation for the rule number input.
 * @param {boolean} isEditing - True if in edit mode, false for add mode.
 */
function setupRuleNumberValidation(isEditing = false) {
    const maxAllowed = isEditing ? totalRules : totalRules + 1;
    ruleNumberInput.setAttribute('max', maxAllowed);
    ruleNumberInput.setAttribute('min', 1);
    
    const handler = (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value)) return;
        if (value < 1) e.target.value = 1;
        if (value > maxAllowed) {
            e.target.value = maxAllowed;
            showToast(`Maximum rule number in ${isEditing ? 'edit' : 'add'} mode is ${maxAllowed}`, 'warning');
        }
        if (!validateRuleNumber(e.target.value, isEditing)) {
             ruleNumberInput.classList.add('is-invalid');
        } else {
             ruleNumberInput.classList.remove('is-invalid');
        }
    };
    
    ruleNumberInput.removeEventListener('input', ruleNumberInput._currentHandler);
    ruleNumberInput.addEventListener('input', handler);
    ruleNumberInput._currentHandler = handler;
}

/**
 * Validates the rule number input field.
 * @param {number} num - The rule number.
 * @param {boolean} isEditing - True if in edit mode.
 * @returns {boolean} - True if valid, false otherwise.
 */
function validateRuleNumber(num, isEditing) {
    const maxAllowed = isEditing ? totalRules : totalRules + 1;
    const isNumInvalid = num > maxAllowed || num < 1 || isNaN(num);
    if (isNumInvalid) {
        ruleNumberError.style.display = 'block';
        ruleNumberError.innerText = (num > maxAllowed) ? `In edit mode, rule number cannot be greater than ${totalRules}` : `Rule number must be at least 1`;
        return false;
    }
    ruleNumberError.style.display = 'none';
    return true;
}