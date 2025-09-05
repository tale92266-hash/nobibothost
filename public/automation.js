// file: public/automation.js

import { fetchAutomationRulesApi, updateAutomationRuleApi, deleteAutomationRuleApi } from './api.js';
import { showToast, configureModalButtons } from './ui.js';

let currentAutomationRuleNumber = null;
let allAutomationRules = [];
let totalAutomationRules = 0;

const automationRuleModal = new bootstrap.Modal(document.getElementById("automationRuleModal"));
const automationRuleForm = document.getElementById("automationRuleForm");
const automationRuleNumberInput = document.getElementById('automationRuleNumber');
const automationRuleNumberError = document.getElementById('automationRuleNumberError');
const automationRuleTypeSelect = document.getElementById('automationRuleType');
const automationKeywordsField = document.getElementById('automationKeywordsField');
const automationRepliesTypeField = document.getElementById('automationRepliesTypeField');
const automationReplyTextField = document.getElementById('automationReplyTextField');
const automationUserAccessTypeSelect = document.getElementById('automationUserAccessType');
const automationDefinedUsersField = document.getElementById('automationDefinedUsersField');
const automationDefinedUsersInput = document.getElementById('automationDefinedUsers');
const automationDelayField = document.getElementById('automationDelayField');
const automationMinDelayInput = document.getElementById('automationMinDelay');
const automationMaxDelayInput = document.getElementById('automationMaxDelay');
const automationRulesList = document.getElementById("automationRulesList");
const automationRulesSearchInput = document.getElementById('searchAutomationRules');

/**
 * Initializes automation rules management and sets up event listeners.
 */
export function initAutomationRules() {
    document.getElementById("addAutomationRuleBtn")?.addEventListener('click', addNewAutomationRule);
    document.getElementById("saveAutomationRuleBtn")?.addEventListener('click', saveAutomationRule);
    document.getElementById("deleteAutomationRuleBtn")?.addEventListener('click', deleteAutomationRule);
    automationRulesList?.addEventListener('click', handleAutomationRuleClick);
    automationRuleTypeSelect?.addEventListener('change', (e) => toggleAutomationFormFields(e.target.value));
    automationUserAccessTypeSelect?.addEventListener('change', (e) => toggleAutomationUserAccessFields(e.target.value));

    if (automationRulesSearchInput) {
        automationRulesSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredRules = allAutomationRules.filter(rule =>
                (rule.RULE_NAME || '').toLowerCase().includes(searchTerm) ||
                (rule.KEYWORDS || '').toLowerCase().includes(searchTerm) ||
                (rule.REPLY_TEXT || '').toLowerCase().includes(searchTerm)
            );
            displayAutomationRules(filteredRules);
        });
    }

    // Set up modal to clear form on close
    automationRuleModal._element.addEventListener('hidden.bs.modal', () => {
        automationRuleForm.reset();
        automationRuleNumberInput.disabled = false;
        automationDefinedUsersField.style.display = 'none';
        automationDefinedUsersInput.required = false;
        document.getElementById('deleteAutomationRuleBtn').style.display = 'none';
        automationRuleNumberInput.classList.remove('is-invalid');
    });
}

/**
 * Fetches all automation rules from the server and displays them.
 */
export async function fetchAutomationRules() {
    try {
        const data = await fetchAutomationRulesApi();
        allAutomationRules = data.rules;
        totalAutomationRules = allAutomationRules.length;
        displayAutomationRules(allAutomationRules);
    } catch (error) {
        showToast('Failed to fetch automation rules: ' + error.message, 'fail');
    }
}

/**
 * Displays the list of automation rules on the page.
 * @param {Array<object>} rules - The list of automation rules to display.
 */
function displayAutomationRules(rules) {
    if (!automationRulesList) return;
    automationRulesList.innerHTML = '';
    if (rules.length === 0) {
        automationRulesList.innerHTML = '<div class="alert alert-info">No automation rules found. Add some new rules.</div>';
        return;
    }
    rules.forEach(rule => {
        const ruleItem = document.createElement('div');
        ruleItem.className = 'rule-item rule-item-new';
        ruleItem.dataset.ruleNumber = rule.RULE_NUMBER;
        const keywords = rule.KEYWORDS ? rule.KEYWORDS.split('//').map(k => `<span class="badge bg-secondary me-1">${k.trim()}</span>`).join('') : '';
        const userAccess = rule.USER_ACCESS_TYPE ? `<span class="badge bg-info">${rule.USER_ACCESS_TYPE.toUpperCase()}</span>` : '';
        ruleItem.innerHTML = `
            <div class="rule-header-new">
                <span class="rule-number-new">${rule.RULE_NUMBER}</span>
                <div class="rule-title-new">
                    <span class="rule-name-new">${rule.RULE_NAME || 'Unnamed Rule'}</span>
                    <span class="rule-type-new badge bg-primary">${rule.RULE_TYPE}</span>
                    ${userAccess}
                </div>
            </div>
            <div class="rule-body-new">
                <p><strong>Keywords:</strong> ${keywords || 'None'}</p>
                <p><strong>Replies:</strong> ${rule.REPLY_TEXT || 'None'}</p>
            </div>
        `;
        automationRulesList.appendChild(ruleItem);
    });
}

/**
 * Handles the click event on an automation rule item.
 * @param {Event} e - The click event.
 */
async function handleAutomationRuleClick(e) {
    const ruleItem = e.target.closest('.rule-item');
    if (!ruleItem) return;

    const ruleNumber = parseInt(ruleItem.dataset.ruleNumber);
    const rule = allAutomationRules.find(r => r.RULE_NUMBER === ruleNumber);
    if (!rule) return;

    currentAutomationRuleNumber = ruleNumber;
    configureModalButtons('edit', automationRuleModal._element);
    document.getElementById('deleteAutomationRuleBtn').style.display = 'inline-block';

    automationRuleNumberInput.value = rule.RULE_NUMBER;
    automationRuleNumberInput.disabled = true;
    document.getElementById('automationRuleName').value = rule.RULE_NAME || '';
    automationRuleTypeSelect.value = rule.RULE_TYPE;
    document.getElementById('automationKeywords').value = rule.KEYWORDS;
    automationRepliesTypeSelect.value = rule.REPLIES_TYPE;
    document.getElementById('automationReplyText').value = rule.REPLY_TEXT;
    automationUserAccessTypeSelect.value = rule.USER_ACCESS_TYPE || 'ALL';
    automationDefinedUsersInput.value = (rule.DEFINED_USERS || []).join(', ');
    automationMinDelayInput.value = rule.MIN_DELAY || 0;
    automationMaxDelayInput.value = rule.MAX_DELAY || 0;

    toggleAutomationFormFields(rule.RULE_TYPE);
    toggleAutomationUserAccessFields(rule.USER_ACCESS_TYPE);

    automationRuleModal.show();
}

/**
 * Adds a new automation rule.
 */
function addNewAutomationRule() {
    currentAutomationRuleNumber = null;
    configureModalButtons('add', automationRuleModal._element);
    automationRuleForm.reset();
    automationRuleNumberInput.value = totalAutomationRules + 1;
    automationRuleNumberInput.disabled = false;
    automationDefinedUsersField.style.display = 'none';
    automationDefinedUsersInput.required = false;
    document.getElementById('deleteAutomationRuleBtn').style.display = 'none';
    automationRuleModal.show();
}

/**
 * Saves a new or edited automation rule.
 */
async function saveAutomationRule(e) {
    e.preventDefault();
    const isEditing = currentAutomationRuleNumber !== null;

    if (!automationRuleForm.checkValidity()) {
        automationRuleForm.classList.add('was-validated');
        return;
    }

    const payload = {
        type: isEditing ? 'edit' : 'add',
        rule: {
            RULE_NUMBER: parseInt(automationRuleNumberInput.value),
            RULE_NAME: document.getElementById('automationRuleName').value.trim(),
            RULE_TYPE: automationRuleTypeSelect.value,
            KEYWORDS: document.getElementById('automationKeywords').value.trim(),
            REPLIES_TYPE: automationRepliesTypeSelect.value,
            REPLY_TEXT: document.getElementById('automationReplyText').value.trim(),
            USER_ACCESS_TYPE: automationUserAccessTypeSelect.value,
            DEFINED_USERS: automationUserAccessTypeSelect.value === 'DEFINED_USERS'
                ? automationDefinedUsersInput.value.split(',').map(u => u.trim()).filter(Boolean)
                : [],
            MIN_DELAY: parseInt(automationMinDelayInput.value) || 0,
            MAX_DELAY: parseInt(automationMaxDelayInput.value) || 0
        }
    };
    
    // Convert newlines for saving
    payload.rule.REPLY_TEXT = payload.rule.REPLY_TEXT.replace(/\n/g, '<#>');

    try {
        const result = await updateAutomationRuleApi(payload);
        showToast(result.message, 'success');
        automationRuleModal.hide();
        await fetchAutomationRules();
    } catch (error) {
        showToast('Failed to save automation rule: ' + error.message, 'fail');
    }
}

/**
 * Deletes an existing automation rule.
 */
async function deleteAutomationRule() {
    if (currentAutomationRuleNumber === null) return;
    if (!confirm('Are you sure you want to delete this automation rule?')) return;

    try {
        const payload = { RULE_NUMBER: currentAutomationRuleNumber };
        const result = await deleteAutomationRuleApi(payload);
        showToast(result.message, 'success');
        automationRuleModal.hide();
        await fetchAutomationRules();
        currentAutomationRuleNumber = null;
    } catch (error) {
        showToast('Failed to delete automation rule: ' + error.message, 'fail');
    }
}

/**
 * Toggles form fields based on the selected rule type.
 * @param {string} ruleType - The selected rule type.
 */
function toggleAutomationFormFields(ruleType) {
    // No fields to toggle yet, but good practice to keep the function.
}

/**
 * Toggles the visibility of the "Defined Users" field.
 * @param {string} userAccessType - The selected user access type.
 */
function toggleAutomationUserAccessFields(userAccessType) {
    if (userAccessType === 'DEFINED_USERS') {
        automationDefinedUsersField.style.display = 'block';
        automationDefinedUsersInput.required = true;
    } else {
        automationDefinedUsersField.style.display = 'none';
        automationDefinedUsersInput.required = false;
    }
}

