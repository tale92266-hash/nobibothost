// file: public/api.js

/**
 * Common function to make API requests.
 * @param {string} endpoint The API endpoint.
 * @param {object} [options={}] The fetch options.
 * @returns {Promise<object>} The JSON response.
 */
async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        ...options
    };
    try {
        const response = await fetch(endpoint, defaultOptions);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API request to ${endpoint} failed:`, error);
        throw error;
    }
}

// Rules API functions
const fetchRulesApi = () => apiRequest('/api/rules');
const updateRuleApi = (payload) => apiRequest('/api/rules/update', { method: 'POST', body: JSON.stringify(payload) });
const bulkUpdateRulesApi = (payload) => apiRequest('/api/rules/bulk-update', { method: 'POST', body: JSON.stringify(payload) });

// Variables API functions
const fetchVariablesApi = () => apiRequest('/api/variables');
const updateVariableApi = (payload) => apiRequest('/api/variables/update', { method: 'POST', body: JSON.stringify(payload) });

// Settings API functions
const fetchSettingsApi = () => apiRequest('/api/settings');
const updateBotStatusApi = (isOnline) => apiRequest('/api/bot/status', { method: 'POST', body: JSON.stringify({ isOnline }) });
const saveOverrideSettingsApi = (endpoint, users) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify({ users }) });
const saveRepeatingRuleSettingsApi = (payload) => apiRequest('/api/settings/prevent-repeating-rule', { method: 'POST', body: JSON.stringify(payload) });
const saveTempHideSettingsApi = (payload) => apiRequest('/api/settings/temporary-hide', { method: 'POST', body: JSON.stringify(payload) });
const saveMasterStopSettingsApi = (payload) => apiRequest('/api/settings/master-stop', { method: 'POST', body: JSON.stringify(payload) });
const saveDelayOverrideSettingsApi = (payload) => apiRequest('/api/settings/delay-override', { method: 'POST', body: JSON.stringify(payload) });


// Stats API function
const fetchStatsApi = () => apiRequest('/stats');

// Owner API functions
const fetchOwnerRulesApi = () => apiRequest('/api/owner-rules');
const updateOwnerRuleApi = (payload) => apiRequest('/api/owner-rules/update', { method: 'POST', body: JSON.stringify(payload) });
const fetchOwnersApi = () => apiRequest('/api/owners');
const updateOwnersApi = (owners) => apiRequest('/api/owners/update', { method: 'POST', body: JSON.stringify({ owners }) });

// Automation Rules API functions
const fetchAutomationRulesApi = () => apiRequest('/api/automation-rules');
const updateAutomationRuleApi = (payload) => apiRequest('/api/automation-rules/update', { method: 'POST', body: JSON.stringify(payload) });