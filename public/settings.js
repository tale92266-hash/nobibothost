// file: public/settings.js

let currentSettings = {};
let currentOverrideType = null;

// DOM elements for settings
const botStatusBtn = document.getElementById('botStatusBtn');
const ignoredOverrideBtn = document.getElementById('ignoredOverrideBtn');
const specificOverrideBtn = document.getElementById('specificOverrideBtn');
const overrideModal = new bootstrap.Modal(document.getElementById('overrideModal'));
const overrideModalTitle = document.getElementById('overrideModalTitle');
const overrideModalDescription = document.getElementById('overrideModalDescription');
const overrideUsersList = document.getElementById('overrideUsersList');
const saveOverrideBtn = document.getElementById('saveOverrideBtn');
const preventRepeatingBtn = document.getElementById('preventRepeatingBtn');
const preventRepeatingModal = new bootstrap.Modal(document.getElementById('preventRepeatingModal'));
const preventRepeatingToggle = document.getElementById('preventRepeatingToggle');
const cooldownTimeInput = document.getElementById('cooldownTime');
const cooldownField = document.getElementById('cooldownField');
const saveRepeatingBtn = document.getElementById('saveRepeatingBtn');
const tempHideBtn = document.getElementById('tempHideBtn');
const tempHideModal = new bootstrap.Modal(document.getElementById('tempHideModal'));
const tempHideToggle = document.getElementById('tempHideToggle');
const tempUnhideToggle = document.getElementById('tempUnhideToggle');
const tempHideMatchTypeSelect = document.getElementById('tempHideMatchType');
const tempUnhideMatchTypeSelect = document.getElementById('tempUnhideMatchType');
const tempHideTriggerTextarea = document.getElementById('tempHideTriggerText');
const tempUnhideTriggerTextarea = document.getElementById('tempUnhideTriggerText');
const tempHideReplyTextarea = document.getElementById('tempHideReplyText');
const tempUnhideReplyTextarea = document.getElementById('tempUnhideReplyText');
const saveTempHideBtn = document.getElementById('saveTempHideBtn');

// New Master Stop DOM elements
const manageMasterStopBtn = document.getElementById('manageMasterStopBtn');
const masterStopModal = new bootstrap.Modal(document.getElementById('masterStopModal'));
const masterStopToggle = document.getElementById('masterStopToggle');
const masterStopMatchTypeSelect = document.getElementById('masterStopMatchType');
const masterStopTriggerTextarea = document.getElementById('masterStopTriggerText');
const masterStopReplyTextarea = document.getElementById('masterStopReplyText');
const saveMasterStopBtn = document.getElementById('saveMasterStopBtn');

/**
 * Initializes settings management and sets up event listeners.
 */
function initSettings() {
    botStatusBtn?.addEventListener('click', toggleBotStatus);
    ignoredOverrideBtn?.addEventListener('click', showIgnoredOverrideModal);
    specificOverrideBtn?.addEventListener('click', showSpecificOverrideModal);
    saveOverrideBtn?.addEventListener('click', saveOverrideSettings);
    preventRepeatingBtn?.addEventListener('click', showPreventRepeatingModal);
    preventRepeatingToggle?.addEventListener('change', toggleCooldownField);
    saveRepeatingBtn?.addEventListener('click', saveRepeatingRuleSettings);
    tempHideBtn?.addEventListener('click', showTempHideModal);
    saveTempHideBtn?.addEventListener('click', saveTempHideSettings);
    
    // New Master Stop event listeners
    manageMasterStopBtn?.addEventListener('click', showMasterStopModal);
    saveMasterStopBtn?.addEventListener('click', saveMasterStopSettings);
}

/**
 * Fetches all settings from the server.
 */
async function fetchSettings() {
    try {
        currentSettings = await fetchSettingsApi();
        updateBotStatusUI(currentSettings.isBotOnline);
        updateOverrideUsersList();
        updateRepeatingRuleUI();
        updateTempHideUI();
        updateMasterStopUI();
    } catch (error) {
        console.error('Failed to fetch settings:', error);
    }
}

/**
 * Toggles the bot's online status.
 */
async function toggleBotStatus() {
    const oldStatus = currentSettings.isBotOnline;

    if (botStatusBtn) {
        botStatusBtn.classList.remove('bot-on', 'bot-off');
        botStatusBtn.classList.add('bot-loading');
    }
    const statusText = document.getElementById('botStatusText');
    if (statusText) statusText.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Updating...';

    try {
        const newStatus = !oldStatus;
        const result = await updateBotStatusApi(newStatus);
        currentSettings = result.settings;
        showToast(result.message, 'success');
    } catch (error) {
        showToast('Failed to update bot status: ' + error.message, 'fail');
        currentSettings.isBotOnline = oldStatus;
    } finally {
        updateBotStatusUI(currentSettings.isBotOnline);
    }
}

// Override Users Functions
function updateOverrideUsersList() {
    // This function is now mainly for local state management from fetchSettings.
}

function showIgnoredOverrideModal() {
    currentOverrideType = 'ignored';
    overrideModalTitle.textContent = 'Ignored Contact Override';
    overrideModalDescription.textContent = 'Globally ignore these users for ALL rules.';
    const usersText = (currentSettings.ignoredOverrideUsers || [])
        .map(user => typeof user === 'string' ? user : `${user.name}:${user.context}`)
        .join(', ');
    overrideUsersList.value = usersText;
    overrideModal.show();
}

function showSpecificOverrideModal() {
    currentOverrideType = 'specific';
    overrideModalTitle.textContent = 'Specific Contact Override';
    overrideModalDescription.textContent = 'Apply ALL rules to these users, regardless of other settings.';
    const usersText = (currentSettings.specificOverrideUsers || []).join(', ');
    overrideUsersList.value = usersText;
    overrideModal.show();
}

async function saveOverrideSettings() {
    const users = overrideUsersList.value.trim();
    const endpoint = currentOverrideType === 'ignored' ? '/api/settings/ignored-override' : '/api/settings/specific-override';

    try {
        const result = await saveOverrideSettingsApi(endpoint, users);
        if (currentOverrideType === 'ignored') {
            currentSettings.ignoredOverrideUsers = users.split(',').map(userString => {
                const [name, context] = userString.split(':').map(s => s.trim());
                return { name, context: context || 'DM' };
            }).filter(item => item.name);
        } else {
            currentSettings.specificOverrideUsers = users.split(',').map(u => u.trim()).filter(Boolean);
        }
        showToast(result.message, 'success');
        overrideModal.hide();
    } catch (error) {
        showToast('Failed to save settings: ' + error.message, 'fail');
    }
}

// Prevent Repeating Rule Functions
function updateRepeatingRuleUI() {
    if (preventRepeatingToggle) {
        preventRepeatingToggle.checked = currentSettings.preventRepeatingRule.enabled;
    }
    if (cooldownTimeInput) {
        cooldownTimeInput.value = currentSettings.preventRepeatingRule.cooldown;
    }
    toggleCooldownField();
}

function toggleCooldownField() {
    if (cooldownField) {
        cooldownField.style.display = preventRepeatingToggle.checked ? 'block' : 'none';
    }
}

function showPreventRepeatingModal() {
    updateRepeatingRuleUI();
    preventRepeatingModal.show();
}

async function saveRepeatingRuleSettings() {
    const enabled = preventRepeatingToggle.checked;
    const cooldown = parseInt(cooldownTimeInput.value) || 2;
    const payload = { enabled, cooldown };
    try {
        const result = await saveRepeatingRuleSettingsApi(payload);
        currentSettings.preventRepeatingRule = payload;
        showToast(result.message, 'success');
        preventRepeatingModal.hide();
    } catch (error) {
        showToast('Failed to save settings: ' + error.message, 'fail');
    }
}

// Temporary Hide Functions
function updateTempHideUI() {
    if (tempHideToggle) tempHideToggle.checked = currentSettings.temporaryHide.enabled;
    if (tempHideMatchTypeSelect) tempHideMatchTypeSelect.value = currentSettings.temporaryHide.matchType;
    if (tempHideTriggerTextarea) tempHideTriggerTextarea.value = currentSettings.temporaryHide.triggerText;
    if (tempUnhideToggle) tempUnhideToggle.checked = currentSettings.temporaryHide.unhideEnabled;
    if (tempUnhideMatchTypeSelect) tempUnhideMatchTypeSelect.value = currentSettings.temporaryHide.unhideMatchType;
    if (tempUnhideTriggerTextarea) tempUnhideTriggerTextarea.value = currentSettings.temporaryHide.unhideTriggerText;
    if (tempHideReplyTextarea) tempHideReplyTextarea.value = currentSettings.temporaryHide.hideReply.replace(/<#>/g, '\n<#>\n');
    if (tempUnhideReplyTextarea) tempUnhideReplyTextarea.value = currentSettings.temporaryHide.unhideReply.replace(/<#>/g, '\n<#>\n');
}

function showTempHideModal() {
    updateTempHideUI();
    tempHideModal.show();
}

async function saveTempHideSettings() {
    const payload = {
        enabled: tempHideToggle.checked,
        matchType: tempHideMatchTypeSelect.value,
        triggerText: tempHideTriggerTextarea.value.trim(),
        unhideEnabled: tempUnhideToggle.checked,
        unhideMatchType: tempUnhideMatchTypeSelect.value,
        unhideTriggerText: tempUnhideTriggerTextarea.value.trim(),
        hideReply: tempHideReplyTextarea.value.trim().replace(/\n<#>\n/g, '<#>'),
        unhideReply: tempUnhideReplyTextarea.value.trim().replace(/\n<#>\n/g, '<#>')
    };

    try {
        const result = await saveTempHideSettingsApi(payload);
        currentSettings.temporaryHide = payload;
        showToast(result.message, 'success');
        tempHideModal.hide();
    } catch (error) {
        showToast('Failed to save settings: ' + error.message, 'fail');
    }
}


// Master Stop functions
const masterStopToggle = document.getElementById('masterStopToggle');
const masterStopMatchTypeSelect = document.getElementById('masterStopMatchType');
const masterStopTriggerTextarea = document.getElementById('masterStopTriggerText');
const masterStopReplyTextarea = document.getElementById('masterStopReplyText');
const saveMasterStopBtn = document.getElementById('saveMasterStopBtn');
const manageMasterStopBtn = document.getElementById('manageMasterStopBtn');
const masterStopModal = new bootstrap.Modal(document.getElementById('masterStopModal'));

function initMasterStopSettings() {
    manageMasterStopBtn?.addEventListener('click', showMasterStopModal);
    saveMasterStopBtn?.addEventListener('click', saveMasterStopSettings);
    // Initial UI update for Master Stop
    if (currentSettings.masterStop) {
        updateMasterStopUI();
    }
}

function updateMasterStopUI() {
    if (currentSettings.masterStop) {
        masterStopToggle.checked = currentSettings.masterStop.enabled;
        masterStopMatchTypeSelect.value = currentSettings.masterStop.matchType;
        masterStopTriggerTextarea.value = currentSettings.masterStop.triggerText;
        masterStopReplyTextarea.value = currentSettings.masterStop.replyText.replace(/<#>/g, '\n<#>\n');
    }
}

function showMasterStopModal() {
    updateMasterStopUI();
    masterStopModal.show();
}

async function saveMasterStopSettings() {
    const payload = {
        enabled: masterStopToggle.checked,
        matchType: masterStopMatchTypeSelect.value,
        triggerText: masterStopTriggerTextarea.value.trim(),
        replyText: masterStopReplyTextarea.value.trim().replace(/\n<#>\n/g, '<#>')
    };
    
    try {
        const result = await saveMasterStopSettingsApi(payload);
        currentSettings.masterStop = payload;
        showToast(result.message, 'success');
        masterStopModal.hide();
    } catch (error) {
        showToast('Failed to save Master Stop settings: ' + error.message, 'fail');
    }
}
