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
    });

    // Fix: Load content immediately when initializing
    loadOwnerRules();
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
export async function loadOwnerRules() {
    try {
        const rules = await fetchOwnerRulesApi();
        allOwnerRules = rules || [];
        displayOwnerRules();
        
        // Fix: Make content visible
        const ownerRulesList = document.getElementById('ownerRulesList');
        if (ownerRulesList) {
            ownerRulesList.style.visibility = 'visible';
            ownerRulesList.style.opacity = '1';
        }
    } catch (error) {
        console.error('Failed to load owner rules:', error);
        showToast('Failed to load owner rules', 'error');
    }
}

/**
 * Displays owner rules in the UI.
 */
function displayOwnerRules() {
    if (!ownerRulesList) return;

    if (allOwnerRules.length === 0) {
        ownerRulesList.innerHTML = '<div class="no-rules">No owner rules found</div>';
        return;
    }

    const rulesHtml = allOwnerRules.map(rule => `
        <div class="rule-item" data-rule-number="${rule.RULE_NUMBER}">
            <div class="rule-header">
                <span class="rule-type">${rule.TYPE}</span>
                <span class="rule-number">#${rule.RULE_NUMBER}</span>
            </div>
            <div class="rule-keywords">${rule.KEYWORDS || 'N/A'}</div>
        </div>
    `).join('');

    ownerRulesList.innerHTML = rulesHtml;
}

/**
 * Opens the modal for adding a new owner rule.
 */
function addNewOwnerRule() {
    currentOwnerRuleNumber = null;
    ownerRuleForm.reset();
    document.getElementById('ownerRuleModalTitle').textContent = 'Add New Owner Rule';
    document.getElementById('deleteOwnerRuleBtn').style.display = 'none';
    
    configureModalButtons('ownerRuleModal', [
        { id: 'saveOwnerRuleBtn', text: 'Save Rule' }
    ]);
    
    ownerRuleModal.show();
}

/**
 * Opens the modal for editing an existing owner rule.
 * @param {Object} rule - The rule to edit.
 */
function editOwnerRule(rule) {
    currentOwnerRuleNumber = rule.RULE_NUMBER;
    
    document.getElementById('ownerRuleType').value = rule.TYPE;
    document.getElementById('ownerKeywords').value = rule.KEYWORDS || '';
    document.getElementById('ownerRepliesType').value = rule.REPLIES_TYPE;
    document.getElementById('ownerReplies').value = Array.isArray(rule.REPLIES) ? rule.REPLIES.join('\n') : (rule.REPLIES || '');
    
    const type = rule.TYPE;
    document.getElementById('ownerKeywordsField').style.display = (type === 'WELCOME' || type === 'DEFAULT') ? 'none' : 'block';
    document.getElementById('ownerRepliesTypeField').style.display = (type === 'WELCOME' || type === 'DEFAULT') ? 'none' : 'block';
    
    document.getElementById('ownerRuleModalTitle').textContent = `Edit Owner Rule #${rule.RULE_NUMBER}`;
    document.getElementById('deleteOwnerRuleBtn').style.display = 'inline-block';
    
    configureModalButtons('ownerRuleModal', [
        { id: 'saveOwnerRuleBtn', text: 'Update Rule' },
        { id: 'deleteOwnerRuleBtn', text: 'Delete', variant: 'danger' }
    ]);
    
    ownerRuleModal.show();
}

/**
 * Saves the current owner rule being edited or created.
 */
async function saveOwnerRule() {
    const formData = new FormData(ownerRuleForm);
    const ruleData = {
        TYPE: formData.get('ownerRuleType'),
        KEYWORDS: formData.get('ownerKeywords') || null,
        REPLIES_TYPE: formData.get('ownerRepliesType'),
        REPLIES: formData.get('ownerReplies').split('\n').filter(reply => reply.trim())
    };

    if (currentOwnerRuleNumber !== null) {
        ruleData.RULE_NUMBER = currentOwnerRuleNumber;
    }

    try {
        await updateOwnerRuleApi(ruleData);
        showToast(currentOwnerRuleNumber ? 'Owner rule updated successfully!' : 'Owner rule created successfully!', 'success');
        ownerRuleModal.hide();
        await loadOwnerRules();
    } catch (error) {
        console.error('Failed to save owner rule:', error);
        showToast('Failed to save owner rule', 'error');
    }
}

/**
 * Deletes the current owner rule being edited.
 */
async function deleteOwnerRule() {
    if (!currentOwnerRuleNumber) return;

    if (confirm(`Are you sure you want to delete owner rule #${currentOwnerRuleNumber}?`)) {
        try {
            await updateOwnerRuleApi({ RULE_NUMBER: currentOwnerRuleNumber, DELETE: true });
            showToast('Owner rule deleted successfully!', 'success');
            ownerRuleModal.hide();
            await loadOwnerRules();
        } catch (error) {
            console.error('Failed to delete owner rule:', error);
            showToast('Failed to delete owner rule', 'error');
        }
    }
}

/**
 * Shows the owners management modal.
 */
async function showOwnersModal() {
    try {
        const owners = await fetchOwnersApi();
        ownersListTextarea.value = owners.join('\n');
        ownerModal.show();
    } catch (error) {
        console.error('Failed to load owners:', error);
        showToast('Failed to load owners', 'error');
    }
}

/**
 * Saves the owners list.
 */
async function saveOwners() {
    const owners = ownersListTextarea.value
        .split('\n')
        .map(owner => owner.trim())
        .filter(owner => owner);

    try {
        await updateOwnersApi(owners);
        showToast('Owners updated successfully!', 'success');
        ownerModal.hide();
    } catch (error) {
        console.error('Failed to save owners:', error);
        showToast('Failed to save owners', 'error');
    }
}
