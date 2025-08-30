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

// Live Messages Variables
let messagesContainer;
let liveMessagesSocket;

// Socket connection for real-time stats
const socket = io();
socket.on('connect', () => {
console.log('Connected to server');
});

socket.on('statsUpdate', (data) => {
updateStatsDisplay(data);
});

// Live Messages Functionality
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
<div style="text-align: center; color: #666; padding: 3rem;">
<i class="fas fa-inbox fa-2x"></i>
<p style="margin-top: 1rem;">No messages yet...</p>
</div>
`;
return;
}

messagesContainer.innerHTML = messages.map(msg => `
<div class="message-item" style="
background: white;
border-radius: 12px;
padding: 1.25rem;
margin-bottom: 1rem;
border-left: 4px solid #667eea;
box-shadow: 0 4px 6px rgba(0,0,0,0.1);
transition: all 0.3s ease;
animation: fadeInUp 0.5s ease-out;
">
<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
<div style="font-weight: 600; color: #667eea; font-size: 0.875rem;">
<i class="fas fa-user-circle"></i> ${msg.sessionId}
</div>
<div style="font-size: 0.75rem; color: #888; background: #f8f9fa; padding: 0.25rem 0.5rem; border-radius: 4px;">
<i class="fas fa-clock"></i> ${msg.timestamp}
</div>
</div>
<div style="margin-bottom: 0.75rem;">
<div style="font-weight: 600; color: #333; font-size: 0.875rem; margin-bottom: 0.5rem;">
<i class="fas fa-arrow-right" style="color: #28a745;"></i> Incoming Message:
</div>
<div style="background: #e8f5e8; padding: 0.75rem; border-radius: 8px; font-size: 0.875rem; border-left: 3px solid #28a745;">
${msg.message}
</div>
</div>
<div>
<div style="font-weight: 600; color: #333; font-size: 0.875rem; margin-bottom: 0.5rem;">
<i class="fas fa-arrow-left" style="color: #007bff;"></i> Bot Reply:
</div>
<div style="background: #e3f2fd; padding: 0.75rem; border-radius: 8px; font-size: 0.875rem; color: #1565c0; border-left: 3px solid #007bff;">
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
ruleNumberInput.setAttribute('max', maxAllowed);
ruleNumberInput.setAttribute('min', 1);
console.log(`🔢 Rule number validation setup: min=1, max=${maxAllowed} (${isEditing ? 'Edit' : 'Add'} mode)`);

const newHandler = function(e) {
let value = parseInt(e.target.value);
if (isNaN(value)) {
return;
}

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

validateRuleNumber(value, isEditing);
};

if (ruleNumberInput._currentHandler) {
ruleNumberInput.removeEventListener('input', ruleNumberInput._currentHandler);
}
ruleNumberInput.addEventListener('input', newHandler);
ruleNumberInput._currentHandler = newHandler;

const keydownHandler = function(e) {
if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
(e.keyCode === 65 && e.ctrlKey === true) ||
(e.keyCode === 67 && e.ctrlKey === true) ||
(e.keyCode === 86 && e.ctrlKey === true) ||
(e.keyCode === 88 && e.ctrlKey === true) ||
(e.keyCode >= 35 && e.keyCode <= 39)) {
return;
}

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

const fromIndex = rules.findIndex(r => r.RULE_NUMBER === oldRuleNumber);
const toIndex = newRuleNumber - 1;

if (fromIndex === -1) {
console.error('❌ Rule not found:', oldRuleNumber);
return rules;
}
if (toIndex < 0 || toIndex >= rules.length) {
console.error('❌ Invalid target position:', newRuleNumber);
return rules;
}

console.log(`📍 Moving from array index ${fromIndex} to index ${toIndex}`);

const newRules = [...rules];
const [movingRule] = newRules.splice(fromIndex, 1);
console.log(`📤 Removed rule: ${movingRule.RULE_NAME || 'Unnamed'} (was #${movingRule.RULE_NUMBER})`);

newRules.splice(toIndex, 0, movingRule);
console.log(`📥 Inserted at position ${toIndex}`);

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

if (navItems.length > 0) {
navItems[0].classList.add('active');
}

navItems.forEach(navItem => {
navItem.addEventListener('click', () => {
const tabName = navItem.getAttribute('data-tab');

navItems.forEach(item => item.classList.remove('active'));
navItem.classList.add('active');

tabPanes.forEach(pane => {
pane.classList.remove('show', 'active');
});

const targetPane = document.getElementById(`${tabName}-pane`);
if (targetPane) {
targetPane.classList.add('show', 'active');
}

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
initLiveMessages(); // LIVE MESSAGES INITIALIZATION ADDED
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
const totalUsers = document.getElementById('totalUsers');
const todayUsers = document.getElementById('todayUsers');
const totalMsgs = document.getElementById('totalMsgs');
const todayMsgs = document.getElementById('todayMsgs');

if (totalUsers) totalUsers.textContent = data.totalUsers || 0;
if (todayUsers) todayUsers.textContent = data.todayUsers || 0;
if (totalMsgs) totalMsgs.textContent = (data.totalMsgs || 0).toLocaleString();
if (todayMsgs) todayMsgs.textContent = (data.todayMsgs || 0).toLocaleString();

const headerTotalUsers = document.getElementById('headerTotalUsers');
const headerTotalMsgs = document.getElementById('headerTotalMsgs');
if (headerTotalUsers) headerTotalUsers.textContent = data.totalUsers || 0;
if (headerTotalMsgs) headerTotalMsgs.textContent = (data.totalMsgs || 0).toLocaleString();

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
<i class="fas fa-list fa-3x"></i>
<h5>No Rules Found</h5>
<p>Add your first rule to get started!</p>
</div>
`;
return;
}

displayRules(data);
} catch (error) {
console.error('Failed to fetch rules:', error);
loadingMessage.style.display = 'none';
rulesList.innerHTML = `
<div class="empty-state">
<i class="fas fa-exclamation-triangle fa-3x"></i>
<h5>Error Loading Rules</h5>
<p>There was an error loading the rules. Please try again.</p>
</div>
`;
}
}

function displayRules(rules) {
if (!rules || rules.length === 0) {
rulesList.innerHTML = `
<div class="empty-state">
<i class="fas fa-list fa-3x"></i>
<h5>No Rules Found</h5>
<p>Add your first rule to get started!</p>
</div>
`;
return;
}

rulesList.innerHTML = rules.map(rule => `
<div class="rule-item" onclick="editRule(${rule.RULE_NUMBER})">
<div class="rule-header-new">
<div class="rule-title">
<span class="rule-number-new">${rule.RULE_NUMBER}</span>
<span class="rule-name-new">${rule.RULE_NAME || 'Unnamed Rule'}</span>
</div>
<span class="rule-type type-${rule.RULE_TYPE.toLowerCase()}">${rule.RULE_TYPE}</span>
</div>
<div class="rule-content-new">
${rule.RULE_TYPE !== 'WELCOME' && rule.RULE_TYPE !== 'DEFAULT' ? `
<div class="rule-line">
<strong>Keywords:</strong>
<span>${rule.KEYWORDS}</span>
</div>
` : ''}
<div class="rule-line">
<strong>Reply Type:</strong>
<span>${rule.REPLIES_TYPE}</span>
</div>
<div class="rule-reply">
<strong>Reply:</strong>
<div class="reply-text">${rule.REPLY_TEXT.replace(/\n/g, '<br>').substring(0, 200)}${rule.REPLY_TEXT.length > 200 ? '...' : ''}</div>
</div>
</div>
</div>
`).join('');
}

function filterRules(searchTerm) {
if (!allRules) return;

if (!searchTerm.trim()) {
displayRules(allRules);
return;
}

const filteredRules = allRules.filter(rule =>
(rule.RULE_NAME && rule.RULE_NAME.toLowerCase().includes(searchTerm.toLowerCase())) ||
rule.RULE_TYPE.toLowerCase().includes(searchTerm.toLowerCase()) ||
rule.KEYWORDS.toLowerCase().includes(searchTerm.toLowerCase()) ||
rule.REPLY_TEXT.toLowerCase().includes(searchTerm.toLowerCase())
);

if (filteredRules.length === 0) {
rulesList.innerHTML = `
<div class="empty-state">
<i class="fas fa-search fa-3x"></i>
<h5>No Results Found</h5>
<p>No rules match your search term "${searchTerm}"</p>
</div>
`;
} else {
displayRules(filteredRules);
}
}

// Add Rule Button
addRuleBtn.addEventListener('click', () => {
currentRuleNumber = null;
configureModalButtons('rule', 'add');
setupRuleNumberValidation(false);
formTitle.innerHTML = '<i class="fas fa-plus"></i> Add New Rule';
ruleForm.reset();
document.getElementById('ruleNumber').value = totalRules + 1;
toggleFormFields('');
ruleModal.show();
});

// Rule Form Submit
ruleForm.addEventListener('submit', async (e) => {
e.preventDefault();

const ruleNumber = parseInt(document.getElementById('ruleNumber').value);
if (!validateRuleNumber(ruleNumber, currentRuleNumber !== null)) {
return;
}

const ruleData = {
ruleNumber: ruleNumber,
ruleName: document.getElementById('ruleName').value.trim(),
ruleType: document.getElementById('ruleType').value,
keywords: document.getElementById('keywords').value.trim(),
repliesType: document.getElementById('repliesType').value,
replyText: document.getElementById('replyText').value.trim(),
targetUsers: document.getElementById('targetUsersToggle').value === 'ALL' ? 'ALL' : 
document.getElementById('targetUsers').value.split(',').map(u => u.trim()).filter(u => u !== '')
};

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
showToast(result.message);
ruleModal.hide();
await fetchRules();
} else {
showToast(result.message || 'Failed to save rule', 'fail');
}
} catch (error) {
showToast('Network error: ' + error.message, 'fail');
}
});

// Edit Rule Function
window.editRule = async (ruleNumber) => {
try {
const rule = allRules.find(r => r.RULE_NUMBER === ruleNumber);
if (!rule) {
showToast('Rule not found', 'fail');
return;
}

currentRuleNumber = ruleNumber;
configureModalButtons('rule', 'edit');
setupRuleNumberValidation(true);

formTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Rule';

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
ruleModal.show();

} catch (error) {
showToast('Error loading rule: ' + error.message, 'fail');
}
};

// Delete Rule Button
deleteRuleBtn.addEventListener('click', async () => {
if (!currentRuleNumber) return;

if (!confirm('Are you sure you want to delete this rule? This action cannot be undone.')) {
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
showToast('Rule deleted successfully');
ruleModal.hide();
await fetchRules();
} else {
showToast(result.message || 'Failed to delete rule', 'fail');
}
} catch (error) {
showToast('Network error: ' + error.message, 'fail');
}
});

// Variables Management
variablesMenuBtn.addEventListener('click', () => {
const isVisible = variableFormContainer.style.display === 'block';
variableFormContainer.style.display = isVisible ? 'none' : 'block';
variablesMenuBtn.innerHTML = isVisible ? 
'<i class="fas fa-edit"></i> Manage Variables' : 
'<i class="fas fa-times"></i> Hide Variables';
});

async function fetchVariables() {
try {
const response = await fetch('/api/variables');
const data = await response.json();
allVariables = data;
displayVariables(data);
} catch (error) {
console.error('Failed to fetch variables:', error);
}
}

function displayVariables(variables) {
if (!variables || variables.length === 0) {
variablesList.innerHTML = `
<div class="empty-state">
<i class="fas fa-tags fa-3x"></i>
<h6>No Variables Found</h6>
<p>Create variables to use dynamic content in your rules.</p>
</div>
`;
return;
}

variablesList.innerHTML = variables.map(variable => `
<div class="variable-item" onclick="editVariable('${variable.name}')">
<div class="variable-header">
<div class="variable-name">%${variable.name}%</div>
</div>
<div class="variable-value">${variable.value.substring(0, 100)}${variable.value.length > 100 ? '...' : ''}</div>
</div>
`).join('');
}

// Add Variable Button
addVariableBtn.addEventListener('click', () => {
currentVariableName = null;
document.getElementById('variableName').value = '';
document.getElementById('variableValue').value = '';
document.getElementById('variableName').readOnly = false;
configureModalButtons('variable', 'add');
});

// Edit Variable Function
window.editVariable = async (variableName) => {
try {
const variable = allVariables.find(v => v.name === variableName);
if (!variable) {
showToast('Variable not found', 'fail');
return;
}

currentVariableName = variableName;
document.getElementById('variableName').value = variable.name;
document.getElementById('variableValue').value = variable.value;
document.getElementById('variableName').readOnly = true;
configureModalButtons('variable', 'edit');
} catch (error) {
showToast('Error loading variable: ' + error.message, 'fail');
}
};

// Save Variable Button
saveVariableBtn.addEventListener('click', async () => {
const name = document.getElementById('variableName').value.trim();
const value = document.getElementById('variableValue').value.trim();

if (!name || !value) {
showToast('Please fill in all fields', 'fail');
return;
}

try {
const response = await fetch('/api/variables/update', {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({
type: currentVariableName ? 'edit' : 'add',
variable: { name, value },
oldName: currentVariableName
})
});

const result = await response.json();
if (result.success) {
showToast(result.message);
resetVariableForm();
await fetchVariables();
} else {
showToast(result.message || 'Failed to save variable', 'fail');
}
} catch (error) {
showToast('Network error: ' + error.message, 'fail');
}
});

// Delete Variable Button
deleteVariableBtn.addEventListener('click', async () => {
if (!currentVariableName) return;

if (!confirm('Are you sure you want to delete this variable? This action cannot be undone.')) {
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
showToast('Variable deleted successfully');
resetVariableForm();
await fetchVariables();
} else {
showToast(result.message || 'Failed to delete variable', 'fail');
}
} catch (error) {
showToast('Network error: ' + error.message, 'fail');
}
});

// Reset Variable Form
window.resetVariableForm = () => {
currentVariableName = null;
document.getElementById('variableName').value = '';
document.getElementById('variableValue').value = '';
document.getElementById('variableName').readOnly = false;
configureModalButtons('variable', 'add');
};

// Show Settings Function
window.showSettings = () => {
const settingsTab = document.querySelector('[data-tab="settings"]');
if (settingsTab) {
settingsTab.click();
}
};

// Global filter function for rules search
window.filterRules = filterRules;

// Initialize the application
init();
});
