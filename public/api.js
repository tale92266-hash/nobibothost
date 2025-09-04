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
export const fetchRulesApi = () => apiRequest('/api/rules');
export const updateRuleApi = (payload) => apiRequest('/api/rules/update', { method: 'POST', body: JSON.stringify(payload) });
export const bulkUpdateRulesApi = (payload) => apiRequest('/api/rules/bulk-update', { method: 'POST', body: JSON.stringify(payload) });

// Variables API functions
export const fetchVariablesApi = () => apiRequest('/api/variables');
export const updateVariableApi = (payload) => apiRequest('/api/variables/update', { method: 'POST', body: JSON.stringify(payload) });

// Settings API functions
export const fetchSettingsApi = () => apiRequest('/api/settings');
export const updateBotStatusApi = (isOnline) => apiRequest('/api/bot/status', { method: 'POST', body: JSON.stringify({ isOnline }) });
export const saveOverrideSettingsApi = (endpoint, users) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify({ users }) });
export const saveRepeatingRuleSettingsApi = (payload) => apiRequest('/api/settings/prevent-repeating-rule', { method: 'POST', body: JSON.stringify(payload) });
export const saveTempHideSettingsApi = (payload) => apiRequest('/api/settings/temporary-hide', { method: 'POST', body: JSON.stringify(payload) });

// Stats API function
export const fetchStatsApi = () => apiRequest('/stats');

// Owner API functions
export const fetchOwnerRulesApi = () => apiRequest('/api/owner-rules');
export const updateOwnerRuleApi = (payload) => apiRequest('/api/owner-rules/update', { method: 'POST', body: JSON.stringify(payload) });
export const fetchOwnersApi = () => apiRequest('/api/owners');
export const updateOwnersApi = (owners) => apiRequest('/api/owners/update', { method: 'POST', body: JSON.stringify({ owners }) });