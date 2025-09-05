// file: public/automationRules.js

let currentAutomationRuleNumber = null;
let allAutomationRules = [];
let totalAutomationRules = 0;

const automationRuleModal = new bootstrap.Modal(document.getElementById("automationRuleModal"));
const automationRuleForm = document.getElementById("automationRuleForm");
const automationRuleNumberInput = document.getElementById('automationRuleNumber');
const automationRuleNumberError = document.getElementById('automationRuleNumberError');
const automationRuleTypeSelect = document.getElementById('automationRuleType');
const automationKeywordsField = document.getElementById('automationKeywordsField');
const automationRepliesTypeSelect = document.getElementById('automationRepliesType');
const automationReplyTextarea = document.getElementById('automationReplyText');
const userAccessTypeSelect = document.getElementById('userAccessType');
const definedUsersField = document.getElementById('definedUsersField');
const definedUsersInput = document.getElementById('definedUsers');
const minDelayInput = document.getElementById('minDelay');
const maxDelayInput = document.getElementById('maxDelay');
const cooldownInput = document.getElementById('cooldown');
const automationRulesList = document.getElementById("automationRulesList");
const loadingMessageAutomation = document.getElementById("loadingMessageAutomation");

/**
 * Initializes automation rules management and sets up event listeners.
 */
function initAutomationRules() {
    document.getElementById("addAutomationRuleBtn")?.addEventListener('click', addNewAutomationRule);
    document.getElementById("saveAutomationRuleBtn")?.addEventListener('click', saveAutomationRule);
    document.getElementById("deleteAutomationRuleBtn")?.addEventListener('click', deleteAutomationRule);
    automationRulesList?.addEventListener('click', handleAutomationRuleClick);
    userAccessTypeSelect?.addEventListener('change', (e) => toggleUserAccessField(e.target.value));
    
    const automationRulesSearchInput = document.getElementById('searchAutomationRules');
    if (automationRulesSearchInput) {
        automationRulesSearchInput.addEventListener('input', (e) => {
            displayAutomationRulesWithSearch(allAutomationRules, e.target.value.toLowerCase());
        });
    }
}

/**
 * Handles clicks on the automation rules list to open the edit modal.
 * @param {Event} e - The click event.
 */
function handleAutomationRuleClick(e) {
    const ruleItem = e.target.closest('.rule-item');
    if (ruleItem) {
        const ruleNumber = parseInt(ruleItem.dataset.ruleNumber);
        const rule = allAutomationRules.find(r => r.RULE_NUMBER === ruleNumber);
        if (rule) {
            editAutomationRule(rule);
        }
    }
}

/**
 * Fetches all automation rules from the server and displays them.
 */
async function fetchAutomationRules() {
    if (!automationRulesList) return;
    automationRulesList.innerHTML = '';
    
    toggleLoadingAutomation(true);

    try {
        const data = await fetchAutomationRulesApi();
        allAutomationRules = data;
        totalAutomationRules = data.length;
        if (data.length === 0) {
            automationRulesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-plus-circle fa-3x"></i>
                    <h5>No Automation Rules Found</h5>
                    <p>Add your first automation rule to get started!</p>
                </div>
            `;
        } else {
            const searchTerm = document.getElementById('searchAutomationRules')?.value?.toLowerCase() || '';
            displayAutomationRulesWithSearch(data, searchTerm);
        }
    } catch (error) {
        console.error('Failed to fetch automation rules:', error);
        automationRulesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-3x"></i>
                <h5>Error Loading Automation Rules</h5>
                <p>Please try refreshing the page</p>
            </div>
        `;
    } finally {
        toggleLoadingAutomation(false);
    }
}

/**
 * Displays automation rules based on a search term.
 * @param {Array<object>} rules - The array of automation rules.
 * @param {string} searchTerm - The search term.
 */
function displayAutomationRulesWithSearch(rules, searchTerm = '') {
    const filteredRules = rules.filter(rule =>
        (rule.RULE_NAME || '').toLowerCase().includes(searchTerm) ||
        (rule.KEYWORDS || '').toLowerCase().includes(searchTerm) ||
        (rule.REPLY_TEXT || '').toLowerCase().includes(searchTerm) ||
        (rule.RULE_TYPE || '').toLowerCase().includes(searchTerm) ||
        (rule.USER_ACCESS_TYPE || '').toLowerCase().includes(searchTerm) ||
        (Array.isArray(rule.DEFINED_USERS) && rule.DEFINED_USERS.some(u => u.toLowerCase().includes(searchTerm))) ||
        rule.RULE_NUMBER.toString().includes(searchTerm)
    );
    if (filteredRules.length === 0 && searchTerm) {
        automationRulesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search fa-3x"></i>
                <h6>No Search Results</h6>
                <p>No automation rules match your search term "${searchTerm}"</p>
            </div>
        `;
        return;
    }
    automationRulesList.innerHTML = '';
    filteredRules.forEach(rule => {
        const ruleElement = createAutomationRuleElement(rule);
        automationRulesList.appendChild(ruleElement);
    });
}

/**
 * Creates a single automation rule DOM element.
 * @param {object} rule - The automation rule object.
 * @returns {HTMLElement} The created rule element.
 */
function createAutomationRuleElement(rule) {
    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'rule-item';
    ruleDiv.setAttribute('data-rule-number', rule.RULE_NUMBER);
    const ruleTypeClass = (rule.RULE_TYPE || '').toLowerCase();
    const userAccessDisplay = (rule.USER_ACCESS_TYPE === 'DEFINED' || rule.USER_ACCESS_TYPE === 'OWNER_DEFINED') && Array.isArray(rule.DEFINED_USERS) && rule.DEFINED_USERS.length > 0
        ? rule.DEFINED_USERS.join(', ')
        : (rule.USER_ACCESS_TYPE || 'ALL');
        
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
                <strong>Access:</strong> ${userAccessDisplay}
            </div>
            <div class="rule-line">
                <strong>Delay:</strong> ${rule.MIN_DELAY}s${rule.MAX_DELAY ? ` - ${rule.MAX_DELAY}s` : ''}
            </div>
            <div class="rule-line">
                <strong>Cooldown:</strong> ${rule.COOLDOWN}s
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
 * Opens the modal to add a new automation rule.
 */
function addNewAutomationRule() {
    currentAutomationRuleNumber = null;
    document.getElementById('automationRuleFormTitle').textContent = 'Add New Automation Rule';
    automationRuleForm.reset();
    automationRuleNumberInput.value = totalAutomationRules + 1;
    automationRuleTypeSelect.value = 'EXACT';
    automationRepliesTypeSelect.value = 'RANDOM';
    userAccessTypeSelect.value = 'ALL';
    definedUsersField.style.display = 'none';
    setupAutomationRuleNumberValidation(false);
    configureModalButtons('automationRule', 'add');
    automationRuleModal.show();
}

/**
 * Opens the modal to edit an existing automation rule.
 * @param {object} rule - The automation rule object to edit.
 */
function editAutomationRule(rule) {
    currentAutomationRuleNumber = rule.RULE_NUMBER;
    document.getElementById('automationRuleFormTitle').textContent = 'Edit Automation Rule';
    automationRuleNumberInput.value = rule.RULE_NUMBER;
    document.getElementById('automationRuleName').value = rule.RULE_NAME || '';
    automationRuleTypeSelect.value = rule.RULE_TYPE;
    document.getElementById('automationKeywords').value = rule.KEYWORDS || '';
    automationRepliesTypeSelect.value = rule.REPLIES_TYPE;
    automationReplyTextarea.value = rule.REPLY_TEXT || '';
    userAccessTypeSelect.value = rule.USER_ACCESS_TYPE;
    definedUsersInput.value = Array.isArray(rule.DEFINED_USERS) ? rule.DEFINED_USERS.join(', ') : '';
    minDelayInput.value = rule.MIN_DELAY || 0;
    maxDelayInput.value = rule.MAX_DELAY || 0;
    cooldownInput.value = rule.COOLDOWN || 0;
    
    toggleUserAccessField(rule.USER_ACCESS_TYPE);
    setupAutomationRuleNumberValidation(true);
    configureModalButtons('automationRule', 'edit');
    automationRuleModal.show();
}

/**
 * Saves or updates an automation rule.
 */
async function saveAutomationRule() {
    if (!validateAutomationRuleForm()) return;

    const saveBtn = document.getElementById('saveAutomationRuleBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;

    try {
        let definedUsers = [];
        if (userAccessTypeSelect.value === 'DEFINED' || userAccessTypeSelect.value === 'OWNER_DEFINED') {
            definedUsers = definedUsersInput.value.split(',').map(u => u.trim()).filter(Boolean);
        }

        const ruleData = {
            ruleNumber: parseInt(automationRuleNumberInput.value),
            ruleName: document.getElementById('automationRuleName').value.trim(),
            ruleType: automationRuleTypeSelect.value,
            keywords: document.getElementById('automationKeywords').value.trim(),
            repliesType: automationRepliesTypeSelect.value,
            replyText: automationReplyTextarea.value.trim(),
            userAccessType: userAccessTypeSelect.value,
            definedUsers: definedUsers,
            minDelay: parseInt(minDelayInput.value) || 0,
            maxDelay: parseInt(maxDelayInput.value) || 0,
            cooldown: parseInt(cooldownInput.value) || 0,
        };

        const isEditing = currentAutomationRuleNumber !== null;
        const requestData = {
            type: isEditing ? 'edit' : 'add',
            rule: ruleData,
            oldRuleNumber: currentAutomationRuleNumber
        };

        const result = await updateAutomationRuleApi(requestData);
        showToast(result.message || 'Automation rule saved successfully!', 'success');
        automationRuleModal.hide();
        await fetchAutomationRules();
        currentAutomationRuleNumber = null;
    } catch (error) {
        showToast('Failed to save automation rule: ' + error.message, 'fail');
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

/**
 * Deletes an existing automation rule.
 */
async function deleteAutomationRule() {
    if (currentAutomationRuleNumber === null) return;
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    try {
        const result = await updateAutomationRuleApi({
            type: 'delete',
            rule: { ruleNumber: currentAutomationRuleNumber }
        });
        showToast(result.message || 'Automation rule deleted successfully!', 'success');
        automationRuleModal.hide();
        await fetchAutomationRules();
        currentAutomationRuleNumber = null;
    } catch (error) {
        showToast('Failed to delete automation rule: ' + error.message, 'fail');
    }
}

/**
 * Validates the automation rule form fields.
 * @returns {boolean} - True if the form is valid, false otherwise.
 */
function validateAutomationRuleForm() {
    const ruleNumber = automationRuleNumberInput.value.trim();
    const keywords = document.getElementById('automationKeywords').value.trim();
    const replyText = document.getElementById('automationReplyText').value.trim();
    
    if (!ruleNumber || !keywords || !replyText) {
        showToast('Please fill all required fields', 'warning');
        return false;
    }
    
    const ruleNum = parseInt(ruleNumber);
    if (isNaN(ruleNum) || ruleNum < 1) {
        showToast('Rule number must be a valid number', 'warning');
        return false;
    }

    if ((userAccessTypeSelect.value === 'DEFINED' || userAccessTypeSelect.value === 'OWNER_DEFINED') && definedUsersInput.value.trim() === '') {
        showToast('Please enter at least one defined user.', 'warning');
        return false;
    }
    
    return true;
}

/**
 * Toggles the visibility of user access field.
 * @param {string} userAccessType - The selected user access type.
 */
function toggleUserAccessField(userAccessType) {
    if (userAccessType === 'DEFINED' || userAccessType === 'OWNER_DEFINED') {
        definedUsersField.style.display = 'block';
    } else {
        definedUsersField.style.display = 'none';
    }
}

/**
 * Sets up the validation for the automation rule number input.
 * @param {boolean} isEditing - True if in edit mode, false for add mode.
 */
function setupAutomationRuleNumberValidation(isEditing = false) {
    const maxAllowed = isEditing ? totalAutomationRules : totalAutomationRules + 1;
    automationRuleNumberInput.setAttribute('max', maxAllowed);
    automationRuleNumberInput.setAttribute('min', 1);
    
    const handler = (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value)) return;
        if (value < 1) e.target.value = 1;
        if (value > maxAllowed) {
            e.target.value = maxAllowed;
            showToast(`Maximum rule number in ${isEditing ? 'edit' : 'add'} mode is ${maxAllowed}`, 'warning');
        }
        if (!validateAutomationRuleNumber(e.target.value, isEditing)) {
             automationRuleNumberInput.classList.add('is-invalid');
        } else {
             automationRuleNumberInput.classList.remove('is-invalid');
        }
    };
    
    automationRuleNumberInput.removeEventListener('input', automationRuleNumberInput._currentHandler);
    automationRuleNumberInput.addEventListener('input', handler);
    automationRuleNumberInput._currentHandler = handler;
}

/**
 * Validates the automation rule number input field.
 * @param {number} num - The rule number.
 * @param {boolean} isEditing - True if in edit mode.
 * @returns {boolean} - True if valid, false otherwise.
 */
function validateAutomationRuleNumber(num, isEditing) {
    const maxAllowed = isEditing ? totalAutomationRules : totalAutomationRules + 1;
    const isNumInvalid = num > maxAllowed || num < 1 || isNaN(num);
    if (isNumInvalid) {
        automationRuleNumberError.style.display = 'block';
        automationRuleNumberError.innerText = (num > maxAllowed) ? `In edit mode, rule number cannot be greater than ${totalAutomationRules}` : `Rule number must be at least 1`;
        return false;
    }
    automationRuleNumberError.style.display = 'none';
    return true;
}

/**
 * Toggles the loading state of the automation rules list.
 * @param {boolean} show - True to show loading, false to hide.
 */
function toggleLoadingAutomation(show) {
    if (loadingMessageAutomation) {
        loadingMessageAutomation.style.display = show ? 'flex' : 'none';
    }
}
