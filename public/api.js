// file: public/api.js

/**
 * A generic function to handle API requests.
 * @param {string} url - The URL to fetch.
 * @param {string} method - The HTTP method (e.g., 'GET', 'POST').
 * @param {object} [body=null] - The request body for POST requests.
 * @returns {Promise<object>} The JSON response from the server.
 */
async function apiRequest(url, method, body = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Something went wrong');
        }
        return await response.json();
    } catch (error) {
        console.error(`API Error on ${url}:`, error);
        throw error;
    }
}

// Rules
async function fetchRulesApi() { return apiRequest('/api/rules', 'GET'); }
async function updateRuleApi(data) { return apiRequest('/api/rules/update', 'POST', data); }
async function reorderRulesApi(data) { return apiRequest('/api/rules/bulk-update', 'POST', data); }

// Owner Rules
async function fetchOwnerRulesApi() { return apiRequest('/api/owner-rules', 'GET'); }
async function updateOwnerRuleApi(data) { return apiRequest('/api/owner-rules/update', 'POST', data); }

// Automation Rules
async function fetchAutomationRulesApi() { return apiRequest('/api/automation-rules', 'GET'); }
async function updateAutomationRuleApi(data) { return apiRequest('/api/automation-rules/update', 'POST', data); }

// Variables
async function fetchVariablesApi() { return apiRequest('/api/variables', 'GET'); }
async function updateVariableApi(data) { return apiRequest('/api/variables/update', 'POST', data); }

// Settings
async function fetchSettingsApi() { return apiRequest('/api/settings', 'GET'); }
async function updateBotStatusApi(isOnline) { return apiRequest('/api/bot/status', 'POST', { isOnline }); }
async function saveOverrideSettingsApi(endpoint, users) { return apiRequest(endpoint, 'POST', { users }); }
async function saveRepeatingRuleSettingsApi(payload) { return apiRequest('/api/settings/prevent-repeating-rule', 'POST', payload); }
async function saveTempHideSettingsApi(payload) { return apiRequest('/api/settings/temporary-hide', 'POST', payload); }

// Owners
async function fetchOwnersApi() { return apiRequest('/api/owners', 'GET'); }
async function updateOwnersApi(owners) { return apiRequest('/api/owners/update', 'POST', { owners }); }

// New Master Stop API functions
async function fetchMasterStopSettingsApi() { return apiRequest('/api/settings/master-stop', 'GET'); }
async function saveMasterStopSettingsApi(payload) { return apiRequest('/api/settings/master-stop', 'POST', payload); }
