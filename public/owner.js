// file: public/owner.js

import { fetchOwnerRulesApi, updateOwnerRuleApi, fetchOwnersApi, updateOwnersApi } from './api.js';
import { showToast, configureModalButtons } from './ui.js';

let allOwnerRules = [];
let currentOwnerRuleNumber = null;

const ownerRuleModal = new bootstrap.Modal(document.getElementById("ownerRuleModal"));
const ownerRuleForm = document.getElementById("ownerRuleForm");
const ownerRulesList = document.getElementById("ownerRulesList");
const ownerModal = new bootstrap.Modal(document.getElementById("ownerModal"));
const ownersListTextarea = document.getElementById("ownersList");

/**
 * Initializes owner rules management and sets up event listeners.
 */
export function initOwnerRules() {
    document.getElementById("addOwnerRuleBtn")?.addEventListener('click', addNewOwnerRule);
    document.getElementById("saveOwnerRuleBtn")?.addEventListener('click', saveOwnerRule);
    document.getElementById("deleteOwnerRuleBtn")?.addEventListener('click', deleteOwnerRule);
    ownerRulesList?.addEventListener('click', handleOwnerRuleClick);

    const ownerRuleTypeSelect = document.getElementById('ownerRuleType');
    ownerRuleTypeSelect?.addEventListener('change', (e) => {
        const type = e.target.value;
        document.getElementById('ownerKeywordsField').style.display = (type === 'WELCOME' || type === 'DEFAULT') ? 'none' : 'block';
        document.getElementById('ownerRepliesTypeField').style.display = (type === 'WELCOME' || type === 'DEFAULT') ? 'none' : 'block';
        if (!document.getElementById('ownerRepliesType').value) {
            document.getElementById('ownerRepliesType').value = 'RANDOM';
        }
    });
}

/**
 * Initializes owner list management.
 */
export function initOwnerManagement() {
    document.getElementById("manageOwnersBtn")?.addEventListener('click', showOwnersModal);
    document.getElementById("saveOwnersBtn")?.addEventListener('click', saveOwners);
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
 * Fetches and displays owner rules.
 */
export async function fetchOwnerRules() {
    if (!ownerRulesList) return;
    try {
        const data = await fetchOwnerRulesApi();
        allOwnerRules = data;
        displayOwnerRules(data);
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
 * Renders owner rules to the DOM.
 * @param {Array<object>} rules - The array of owner rules.
 */
function displayOwnerRules(rules) {
    if (rules.length === 0) {
        ownerRulesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-plus-circle fa-3x"></i>
                <h5>No Owner Rules Found</h5>
                <p>Add your first owner rule here!</p>
            </div>
        `;
    } else {
        ownerRulesList.innerHTML = '';
        rules.forEach(rule => {
            const ruleElement = createOwnerRuleElement(rule);
            ownerRulesList.appendChild(ruleElement);
        });
    }
}

/**
 * Creates a single owner rule DOM element.
 * @param {object} rule - The owner rule object.
 * @returns {HTMLElement} The created element.
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
    document.getElementById('ownerRuleNumber').value = allOwnerRules.length + 1;
    document.getElementById('ownerRuleType').value = 'EXACT';
    document.getElementById('ownerRepliesType').value = 'RANDOM';
    document.getElementById('ownerKeywordsField').style.display = 'block';
    document.getElementById('ownerRepliesTypeField').style.display = 'block';
    configureModalButtons('ownerRule', 'add');
    ownerRuleModal.show();
}

/**
 * Opens the modal to edit an existing owner rule.
 * @param {object} rule - The owner rule to edit.
 */
function editOwnerRule(rule) {
    currentOwnerRuleNumber = rule.RULE_NUMBER;
    document.getElementById('ownerRuleFormTitle').textContent = 'Edit Owner Rule';
    document.getElementById('ownerRuleNumber').value = rule.RULE_NUMBER;
    document.getElementById('ownerRuleName').value = rule.RULE_NAME || '';
    document.getElementById('ownerRuleType').value = rule.RULE_TYPE;
    document.getElementById('ownerKeywords').value = rule.KEYWORDS || '';
    document.getElementById('ownerRepliesType').value = rule.REPLIES_TYPE;
    document.getElementById('ownerReplyText').value = rule.REPLY_TEXT || '';
    
    const type = rule.RULE_TYPE;
    document.getElementById('ownerKeywordsField').style.display = (type === 'WELCOME' || type === 'DEFAULT') ? 'none' : 'block';
    document.getElementById('ownerRepliesTypeField').style.display = (type === 'WELCOME' || type === 'DEFAULT') ? 'none' : 'block';

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
            ruleNumber: parseInt(document.getElementById('ownerRuleNumber').value),
            ruleName: document.getElementById('ownerRuleName').value.trim(),
            ruleType: document.getElementById('ownerRuleType').value,
            keywords: document.getElementById('ownerKeywords').value.trim(),
            repliesType: document.getElementById('ownerRepliesType').value,
            replyText: document.getElementById('ownerReplyText').value.trim(),
        };

        const isEditing = currentOwnerRuleNumber !== null;
        const payload = {
            type: isEditing ? 'edit' : 'add',
            rule: ruleData,
            oldRuleNumber: currentOwnerRuleNumber
        };

        const result = await updateOwnerRuleApi(payload);
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
 * Deletes an owner rule.
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
 * Validates the owner rule form.
 * @returns {boolean}
 */
function validateOwnerRuleForm() {
    const ruleNumber = document.getElementById('ownerRuleNumber').value.trim();
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
 * Fetches and displays the owner list.
 */
export async function fetchOwners() {
    try {
        const { owners } = await fetchOwnersApi();
        ownersListTextarea.value = owners.join(', ');
    } catch (error) {
        console.error("Failed to fetch owners:", error);
    }
}

/**
 * Opens the owners management modal.
 */
function showOwnersModal() {
    ownerModal.show();
}

/**
 * Saves the updated owner list.
 */
async function saveOwners() {
    const owners = ownersListTextarea.value.split(',').map(s => s.trim()).filter(Boolean);
    try {
        const result = await updateOwnersApi(owners);
        showToast(result.message || "Owners list updated!", "success");
        ownerModal.hide();
    } catch (error) {
        showToast('Failed to save owners: ' + error.message, "fail");
    }
}
