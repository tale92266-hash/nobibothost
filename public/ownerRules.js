// file: public/ownerRules.js

import { fetchOwnerRulesApi, updateOwnerRuleApi } from './api.js';
import { showToast, configureModalButtons } from './ui.js';

let currentOwnerRuleNumber = null;
let allOwnerRules = [];
let totalOwnerRules = 0;

const ownerRuleModal = new bootstrap.Modal(document.getElementById("ownerRuleModal"));
const ownerRuleForm = document.getElementById("ownerRuleForm");
const ownerRuleNumberInput = document.getElementById('ownerRuleNumber');
const ownerRuleNumberError = document.getElementById('ownerRuleNumberError');
const ownerRuleTypeSelect = document.getElementById('ownerRuleType');
const ownerKeywordsField = document.getElementById('ownerKeywordsField');
const ownerRepliesTypeField = document.getElementById('ownerRepliesTypeField');
const ownerReplyTextField = document.getElementById('ownerReplyTextField');
const ownerRulesList = document.getElementById("ownerRulesList");

/**
 * Initializes owner rules management and sets up event listeners.
 */
export function initOwnerRules() {
    document.getElementById("addOwnerRuleBtn")?.addEventListener('click', addNewOwnerRule);
    document.getElementById("saveOwnerRuleBtn")?.addEventListener('click', saveOwnerRule);
    document.getElementById("deleteOwnerRuleBtn")?.addEventListener('click', deleteOwnerRule);
    ownerRulesList?.addEventListener('click', handleOwnerRuleClick);
    ownerRuleTypeSelect?.addEventListener('change', (e) => toggleOwnerFormFields(e.target.value));
    
    const ownerRulesSearchInput = document.getElementById('searchOwnerRules');
    if (ownerRulesSearchInput) {
        ownerRulesSearchInput.addEventListener('input', (e) => {
            displayOwnerRulesWithSearch(allOwnerRules, e.target.value.toLowerCase());
        });
    }
}

/**
 * Handles clicks on the owner rules list to open the edit modal.
 * @param {Event} e - The click event.
 */
function handleOwnerRuleClick(e) {
    const ruleItem = e.target.closest('.rule-item');
    if (ruleItem) {
        const ruleNumber = parseInt(ruleItem.dataset.ruleNumber);
        const rule = allOwnerRules.find(r => r.RULE_NUMBER === ruleNumber);
        if (rule) {
            editOwnerRule(rule);
        }
    }
}

/**
 * Fetches all owner rules from the server and displays them.
 */
export async function fetchOwnerRules() {
    if (!ownerRulesList) return;
    ownerRulesList.innerHTML = '';
    try {
        const data = await fetchOwnerRulesApi();
        allOwnerRules = data;
        totalOwnerRules = data.length;
        if (data.length === 0) {
            ownerRulesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-plus-circle fa-3x"></i>
                    <h5>No Owner Rules Found</h5>
                    <p>Add your first owner rule to get started!</p>
                </div>
            `;
        } else {
            const searchTerm = document.getElementById('searchOwnerRules')?.value?.toLowerCase() || '';
            displayOwnerRulesWithSearch(data, searchTerm);
        }
    } catch (error) {
        console.error('Failed to fetch owner rules:', error);
        ownerRulesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-3x"></i>
                <h5>Error Loading Owner Rules</h5>
                <p>Please try refreshing the page</p>
            </div>
        `;
    }
}

/**
 * Displays owner rules based on a search term.
 * @param {Array<object>} rules - The array of owner rules.
 * @param {string} searchTerm - The search term.
 */
function displayOwnerRulesWithSearch(rules, searchTerm = '') {
    const filteredRules = rules.filter(rule =>
        (rule.RULE_NAME || '').toLowerCase().includes(searchTerm) ||
        (rule.KEYWORDS || '').toLowerCase().includes(searchTerm) ||
        (rule.REPLY_TEXT || '').toLowerCase().includes(searchTerm) ||
        (rule.RULE_TYPE || '').toLowerCase().includes(searchTerm) ||
        rule.RULE_NUMBER.toString().includes(searchTerm)
    );
    if (filteredRules.length === 0 && searchTerm) {
        ownerRulesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search fa-3x"></i>
                <h6>No Search Results</h6>
                <p>No owner rules match your search term "${searchTerm}"</p>
            </div>
        `;
        return;
    }
    ownerRulesList.innerHTML = '';
    filteredRules.forEach(rule => {
        const ruleElement = createOwnerRuleElement(rule);
        ownerRulesList.appendChild(ruleElement);
    });
}

/**
 * Creates a single owner rule DOM element.
 * @param {object} rule - The owner rule object.
 * @returns {HTMLElement} The created rule element.
 */
function createOwnerRuleElement(rule) {
    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'rule-item';
    ruleDiv.setAttribute('data-rule-number', rule.RULE_NUMBER);
    const ruleTypeClass = (rule.RULE_TYPE || '').toLowerCase();
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
            <div class="rule-reply">
                <strong>Reply:</strong>
                <div class="reply-text">${(rule.REPLY_TEXT || 'No reply text').substring(0, 200)}${rule.REPLY_TEXT && rule.REPLY_TEXT.length > 200 ? '...' : ''}</div>
            </div>
        </div>
    `;
    return ruleDiv;
}

/**
 * Opens the modal to add a new owner rule.
 */
function addNewOwnerRule() {
    currentOwnerRuleNumber = null;
    document.getElementById('ownerRuleFormTitle').textContent = 'Add New Owner Rule';
    ownerRuleForm.reset();
    ownerRuleNumberInput.value = totalOwnerRules + 1;
    document.getElementById('ownerRuleType').value = 'EXACT';
    document.getElementById('ownerRepliesType').value = 'RANDOM';
    toggleOwnerFormFields('EXACT');
    setupOwnerRuleNumberValidation(false);
    configureModalButtons('ownerRule', 'add');
    ownerRuleModal.show();
}

/**
 * Opens the modal to edit an existing owner rule.
 * @param {object} rule - The owner rule object to edit.
 */
function editOwnerRule(rule) {
    currentOwnerRuleNumber = rule.RULE_NUMBER;
    document.getElementById('ownerRuleFormTitle').textContent = 'Edit Owner Rule';
    ownerRuleNumberInput.value = rule.RULE_NUMBER;
    document.getElementById('ownerRuleName').value = rule.RULE_NAME || '';
    document.getElementById('ownerRuleType').value = rule.RULE_TYPE;
    document.getElementById('ownerKeywords').value = rule.KEYWORDS || '';
    document.getElementById('ownerRepliesType').value = rule.REPLIES_TYPE;
    document.getElementById('ownerReplyText').value = rule.REPLY_TEXT || '';
    toggleOwnerFormFields(rule.RULE_TYPE);
    setupOwnerRuleNumberValidation(true);
    configureModalButtons('ownerRule', 'edit');
    ownerRuleModal.show();
}

/**
 * Saves or updates an owner rule.
 */
async function saveOwnerRule() {
    if (!validateOwnerRuleForm()) return;

    const saveBtn = document.getElementById('saveOwnerRuleBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;

    try {
        const ruleData = {
            ruleNumber: parseInt(ownerRuleNumberInput.value),
            ruleName: document.getElementById('ownerRuleName').value.trim(),
            ruleType: ownerRuleTypeSelect.value,
            keywords: document.getElementById('ownerKeywords').value.trim(),
            repliesType: document.getElementById('ownerRepliesType').value,
            replyText: document.getElementById('ownerReplyText').value.trim(),
        };

        const isEditing = currentOwnerRuleNumber !== null;
        const requestData = {
            type: isEditing ? 'edit' : 'add',
            rule: ruleData,
            oldRuleNumber: currentOwnerRuleNumber
        };

        const result = await updateOwnerRuleApi(requestData);
        showToast(result.message || 'Owner rule saved successfully!', 'success');
        ownerRuleModal.hide();
        await fetchOwnerRules();
        currentOwnerRuleNumber = null;
    } catch (error) {
        showToast('Failed to save owner rule: ' + error.message, 'fail');
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

/**
 * Deletes an existing owner rule.
 */
async function deleteOwnerRule() {
    if (currentOwnerRuleNumber === null) return;
    if (!confirm('Are you sure you want to delete this owner rule?')) return;
    try {
        const result = await updateOwnerRuleApi({
            type: 'delete',
            rule: { ruleNumber: currentOwnerRuleNumber }
        });
        showToast(result.message || 'Owner rule deleted successfully!', 'success');
        ownerRuleModal.hide();
        await fetchOwnerRules();
        currentOwnerRuleNumber = null;
    } catch (error) {
        showToast('Failed to delete owner rule: ' + error.message, 'fail');
    }
}

/**
 * Validates the owner rule form fields.
 * @returns {boolean} - True if the form is valid, false otherwise.
 */
function validateOwnerRuleForm() {
    const ruleNumber = ownerRuleNumberInput.value.trim();
    const keywords = document.getElementById('ownerKeywords').value.trim();
    const replyText = document.getElementById('ownerReplyText').value.trim();
    
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
 * Toggles the visibility of form fields based on the owner rule type.
 * @param {string} ruleType - The type of rule.
 */
function toggleOwnerFormFields(ruleType) {
    if (ruleType === 'WELCOME' || ruleType === 'DEFAULT') {
        ownerKeywordsField.style.display = 'none';
        ownerRepliesTypeField.style.display = 'none';
        ownerReplyTextField.style.display = 'block';
        document.getElementById('ownerKeywords').value = "ALL";
    } else {
        ownerKeywordsField.style.display = 'block';
        ownerRepliesTypeField.style.display = 'block';
        ownerReplyTextField.style.display = 'block';
    }
    if (!document.getElementById('ownerRepliesType').value) {
        document.getElementById('ownerRepliesType').value = 'RANDOM';
    }
}

/**
 * Sets up the validation for the owner rule number input.
 * @param {boolean} isEditing - True if in edit mode, false for add mode.
 */
function setupOwnerRuleNumberValidation(isEditing = false) {
    const maxAllowed = isEditing ? totalOwnerRules : totalOwnerRules + 1;
    ownerRuleNumberInput.setAttribute('max', maxAllowed);
    ownerRuleNumberInput.setAttribute('min', 1);
    
    const handler = (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value)) return;
        if (value < 1) e.target.value = 1;
        if (value > maxAllowed) {
            e.target.value = maxAllowed;
            showToast(`Maximum rule number in ${isEditing ? 'edit' : 'add'} mode is ${maxAllowed}`, 'warning');
        }
        if (!validateOwnerRuleNumber(e.target.value, isEditing)) {
             ownerRuleNumberInput.classList.add('is-invalid');
        } else {
             ownerRuleNumberInput.classList.remove('is-invalid');
        }
    };
    
    ownerRuleNumberInput.removeEventListener('input', ownerRuleNumberInput._currentHandler);
    ownerRuleNumberInput.addEventListener('input', handler);
    ownerRuleNumberInput._currentHandler = handler;
}

/**
 * Validates the owner rule number input field.
 * @param {number} num - The rule number.
 * @param {boolean} isEditing - True if in edit mode.
 * @returns {boolean} - True if valid, false otherwise.
 */
function validateOwnerRuleNumber(num, isEditing) {
    const maxAllowed = isEditing ? totalOwnerRules : totalOwnerRules + 1;
    const isNumInvalid = num > maxAllowed || num < 1 || isNaN(num);
    if (isNumInvalid) {
        ownerRuleNumberError.style.display = 'block';
        ownerRuleNumberError.innerText = (num > maxAllowed) ? `In edit mode, rule number cannot be greater than ${totalOwnerRules}` : `Rule number must be at least 1`;
        return false;
    }
    ownerRuleNumberError.style.display = 'none';
    return true;
}