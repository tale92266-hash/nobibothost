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
module.exports.fetchRulesApi = () => apiRequest('/api/rules');
module.exports.updateRuleApi = (payload) => apiRequest('/api/rules/update', { method: 'POST', body: JSON.stringify(payload) });
module.exports.bulkUpdateRulesApi = (payload) => apiRequest('/api/rules/bulk-update', { method: 'POST', body: JSON.stringify(payload) });

// Variables API functions
module.exports.fetchVariablesApi = () => apiRequest('/api/variables');
module.exports.updateVariableApi = (payload) => apiRequest('/api/variables/update', { method: 'POST', body: JSON.stringify(payload) });

// Settings API functions
module.exports.fetchSettingsApi = () => apiRequest('/api/settings');
module.exports.updateBotStatusApi = (isOnline) => apiRequest('/api/bot/status', { method: 'POST', body: JSON.stringify({ isOnline }) });
module.exports.saveOverrideSettingsApi = (endpoint, users) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify({ users }) });
module.exports.saveRepeatingRuleSettingsApi = (payload) => apiRequest('/api/settings/prevent-repeating-rule', { method: 'POST', body: JSON.stringify(payload) });
module.exports.saveTempHideSettingsApi = (payload) => apiRequest('/api/settings/temporary-hide', { method: 'POST', body: JSON.stringify(payload) });

// Stats API function
module.exports.fetchStatsApi = () => apiRequest('/stats');

// Owner API functions
module.exports.fetchOwnerRulesApi = () => apiRequest('/api/owner-rules');
module.exports.updateOwnerRuleApi = (payload) => apiRequest('/api/owner-rules/update', { method: 'POST', body: JSON.stringify(payload) });
module.exports.fetchOwnersApi = () => apiRequest('/api/owners');
module.exports.updateOwnersApi = (owners) => apiRequest('/api/owners/update', { method: 'POST', body: JSON.stringify({ owners }) });
