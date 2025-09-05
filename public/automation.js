// file: public/automation.js

import { fetchAutomationRulesApi, updateAutomationRuleApi } from './api.js';
import { showToast } from './ui.js';

let currentAutomationRuleNumber = null;
let allAutomationRules = [];
let totalAutomationRules = 0;

const automationRuleModal = new bootstrap.Modal(document.getElementById("automationRuleModal"));
const automationRuleForm = document.getElementById("automationRuleForm");
const automationRuleNumberInput = document.getElementById('automationRuleNumber');
const automationRuleNameInput = document.getElementById('automationRuleName');
const automationRuleTypeSelect = document.getElementById('automationRuleType');
const automationKeywordsTextarea = document.getElementById('automationKeywords');
const automationRepliesTypeSelect = document.getElementById('automationRepliesType');
const automationReplyTextarea = document.getElementById('automationReplyText');
const userAccessTypeSelect = document.getElementById('userAccessType');
const definedUsersField = document.getElementById('definedUsersField');
const definedUsersInput = document.getElementById('definedUsers');
const minDelayInput = document.getElementById('minDelay');
const maxDelayInput = document.getElementById('maxDelay');
const automationRulesList = document.getElementById("automationRulesList");

export function initAutomation() {
    document.getElementById("addAutomationRuleBtn")?.addEventListener('click', addNewAutomationRule);
    document.getElementById("saveAutomationRuleBtn")?.addEventListener('click', saveAutomationRule);
    document.getElementById("deleteAutomationRuleBtn")?.addEventListener('click', deleteAutomationRule);
    automationRulesList?.addEventListener('click', handleAutomationRuleClick);
    userAccessTypeSelect?.addEventListener('change', toggleDefinedUsersField);
}

export async function fetchAutomationRules() {
    if (!automationRulesList) return;
    automationRulesList.innerHTML = '';
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
            displayAutomationRules(data);
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
    }
}

function displayAutomationRules(rules) {
    automationRulesList.innerHTML = '';
    rules.forEach(rule => {
        const ruleElement = createAutomationRuleElement(rule);
        automationRulesList.appendChild(ruleElement);
    });
}

function createAutomationRuleElement(rule) {
    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'rule-item';
    ruleDiv.setAttribute('data-rule-number', rule.RULE_NUMBER);
    const userAccessDisplay = rule.USER_ACCESS_TYPE === 'DEFINED' ? rule.DEFINED_USERS.join(', ') : rule.USER_ACCESS_TYPE;
    const ruleTypeClass = (rule.RULE_TYPE || '').toLowerCase();

    ruleDiv.innerHTML = `
        <div class="rule-header-new">
            <div class="rule-title">
                <span class="rule-number-new">${rule.RULE_NUMBER}</span>
                <span class="rule-name-new">${rule.RULE_NAME || 'Untitled Automation'}</span>
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
            <div class="rule-reply">
                <strong>Reply:</strong>
                <div class="reply-text">${(rule.REPLY_TEXT || 'No reply text').substring(0, 200)}${rule.REPLY_TEXT && rule.REPLY_TEXT.length > 200 ? '...' : ''}</div>
            </div>
        </div>
    `;
    return ruleDiv;
}

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

function addNewAutomationRule() {
    currentAutomationRuleNumber = null;
    document.getElementById('automationFormTitle').textContent = 'Add New Automation Rule';
    automationRuleForm.reset();
    automationRuleNumberInput.value = totalAutomationRules + 1;
    toggleDefinedUsersField();
    automationRuleModal.show();
}

function editAutomationRule(rule) {
    currentAutomationRuleNumber = rule.RULE_NUMBER;
    document.getElementById('automationFormTitle').textContent = 'Edit Automation Rule';
    automationRuleNumberInput.value = rule.RULE_NUMBER;
    automationRuleNameInput.value = rule.RULE_NAME || '';
    automationRuleTypeSelect.value = rule.RULE_TYPE;
    automationKeywordsTextarea.value = rule.KEYWORDS || '';
    automationRepliesTypeSelect.value = rule.REPLIES_TYPE;
    automationReplyTextarea.value = rule.REPLY_TEXT || '';
    userAccessTypeSelect.value = rule.USER_ACCESS_TYPE;
    definedUsersInput.value = (rule.DEFINED_USERS || []).join(', ');
    minDelayInput.value = rule.MIN_DELAY;
    maxDelayInput.value = rule.MAX_DELAY > 0 ? rule.MAX_DELAY : '';
    
    toggleDefinedUsersField();
    automationRuleModal.show();
}

async function saveAutomationRule() {
    const ruleData = {
        ruleNumber: parseInt(automationRuleNumberInput.value),
        ruleName: automationRuleNameInput.value.trim(),
        ruleType: automationRuleTypeSelect.value,
        keywords: automationKeywordsTextarea.value.trim(),
        repliesType: automationRepliesTypeSelect.value,
        replyText: automationReplyTextarea.value.trim(),
        userAccessType: userAccessTypeSelect.value,
        definedUsers: userAccessTypeSelect.value === 'DEFINED' ? definedUsersInput.value.split(',').map(u => u.trim()).filter(Boolean) : [],
        minDelay: parseInt(minDelayInput.value) || 0,
        maxDelay: parseInt(maxDelayInput.value) || 0
    };

    if (!ruleData.ruleNumber || !ruleData.ruleType || !ruleData.keywords || !ruleData.replyText) {
        showToast('Please fill all required fields.', 'warning');
        return;
    }
    
    if (ruleData.minDelay > 0 && ruleData.maxDelay > 0 && ruleData.minDelay >= ruleData.maxDelay) {
        showToast('Max Delay must be greater than Min Delay.', 'warning');
        return;
    }

    const isEditing = currentAutomationRuleNumber !== null;
    const payload = {
        type: isEditing ? 'edit' : 'add',
        rule: ruleData,
        oldRuleNumber: currentAutomationRuleNumber
    };

    try {
        const result = await updateAutomationRuleApi(payload);
        showToast(result.message || 'Automation rule saved successfully!', 'success');
        automationRuleModal.hide();
        await fetchAutomationRules();
    } catch (error) {
        showToast('Failed to save automation rule: ' + error.message, 'fail');
    }
}

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
    } catch (error) {
        showToast('Failed to delete automation rule: ' + error.message, 'fail');
    }
}

function toggleDefinedUsersField() {
    if (userAccessTypeSelect.value === 'DEFINED') {
        definedUsersField.style.display = 'block';
    } else {
        definedUsersField.style.display = 'none';
        definedUsersInput.value = '';
    }
}

