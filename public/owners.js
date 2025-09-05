// file: public/owners.js

import { fetchOwnersApi, updateOwnersApi } from './api.js';
import { showToast } from './ui.js';

let ownersModal = new bootstrap.Modal(document.getElementById('ownersModal'));
const ownersListTextarea = document.getElementById('ownersList');
const manageOwnersBtn = document.getElementById('manageOwnersBtn');
const saveOwnersBtn = document.getElementById('saveOwnersBtn');

/**
 * Initializes the owners management feature.
 */
export function initOwners() {
    if (manageOwnersBtn) {
        manageOwnersBtn.addEventListener('click', showOwnersModal);
    }
    if (saveOwnersBtn) {
        saveOwnersBtn.addEventListener('click', saveOwners);
    }
}

/**
 * Fetches the list of owners from the API.
 */
export async function fetchOwners() {
    try {
        const owners = await fetchOwnersApi();
        ownersListTextarea.value = owners.join(', ');
    } catch (error) {
        showToast('Failed to fetch owners list.', 'fail');
        console.error('Failed to fetch owners:', error);
    }
}

/**
 * Shows the modal for managing owners.
 */
function showOwnersModal() {
    fetchOwners();
    ownersModal.show();
}

/**
 * Saves the updated list of owners.
 */
async function saveOwners() {
    const owners = ownersListTextarea.value.split(',').map(owner => owner.trim()).filter(Boolean);
    try {
        const result = await updateOwnersApi(owners);
        showToast(result.message || 'Owners list updated successfully!', 'success');
        ownersModal.hide();
    } catch (error) {
        showToast('Failed to save owners list: ' + error.message, 'fail');
    }
}
