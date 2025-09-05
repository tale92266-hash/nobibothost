// file: public/owners.js

import { fetchOwnersApi, updateOwnersApi } from './api.js';
import { showToast } from './ui.js';

let ownersList = [];

const ownerModal = new bootstrap.Modal(document.getElementById("ownerModal"));
const ownersListTextarea = document.getElementById('ownersList');
const saveOwnersBtn = document.getElementById('saveOwnersBtn');
const manageOwnersBtn = document.getElementById('manageOwnersBtn');

/**
 * Initializes owner management and sets up event listeners.
 */
export function initOwners() {
    // This function will now only be responsible for fetching and displaying the list
    // The button listeners will be set up by setupOwnerButtons() when the tab is active
    fetchOwners();
}

/**
 * Sets up event listeners for owner management buttons.
 */
export function setupOwnerButtons() {
    if (manageOwnersBtn) {
        manageOwnersBtn.addEventListener('click', showManageOwnersModal);
    }
    if (saveOwnersBtn) {
        saveOwnersBtn.addEventListener('click', saveOwners);
    }
}

/**
 * Fetches all owners from the server and displays them.
 */
export async function fetchOwners() {
    const ownersListDiv = document.getElementById('ownerRulesList');
    if (!ownersListDiv) return;
    
    try {
        const data = await fetchOwnersApi();
        ownersList = data;
        displayOwners(data);
    } catch (error) {
        ownersListDiv.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-3x"></i>
                <h6>Error Loading Owners</h6>
                <p>Please try refreshing the page</p>
            </div>
        `;
    }
}

/**
 * Displays the list of owners on the page.
 * @param {Array<string>} owners - The array of owner usernames.
 */
function displayOwners(owners) {
    const ownersListDiv = document.getElementById('ownerRulesList');
    if (!ownersListDiv) return;

    if (owners.length === 0) {
        ownersListDiv.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-plus fa-3x"></i>
                <h6>No Owners Found</h6>
                <p>Use the 'Manage Owners' button to add bot owners.</p>
            </div>
        `;
        return;
    }

    ownersListDiv.innerHTML = owners.map(owner => `
        <div class="rule-item">
            <div class="rule-header-new">
                <div class="rule-title">
                    <i class="fas fa-crown me-2"></i>
                    <span class="rule-name-new">${owner}</span>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Opens the modal to manage owners.
 */
function showManageOwnersModal() {
    ownersListTextarea.value = ownersList.join(', ');
    ownerModal.show();
}

/**
 * Saves the updated list of owners.
 */
async function saveOwners() {
    const newOwners = ownersListTextarea.value.split(',').map(s => s.trim()).filter(Boolean);
    try {
        const result = await updateOwnersApi(newOwners);
        showToast(result.message || 'Owners list updated successfully!', 'success');
        ownerModal.hide();
        await fetchOwners();
    } catch (error) {
        showToast('Failed to save owners: ' + error.message, 'fail');
    }
}
