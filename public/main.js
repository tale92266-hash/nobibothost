// file: public/main.js

import { toggleLoading, showToast, initBottomNavigation, updateStatsDisplay, initSubNavigation } from './ui.js';
import { fetchStatsApi } from './api.js';
import { initChat } from './chat.js';
import { initRules, fetchRules } from './rules.js';
import { initVariables, fetchVariables } from './variables.js';
import { initSettings, fetchSettings } from './settings.js';
import { initOwnerRules, fetchOwnerRules } from './ownerRules.js';
import { initOwners, fetchOwners } from './owners.js';

document.addEventListener("DOMContentLoaded", () => {

    const socket = io();
    socket.on('statsUpdate', (data) => {
        updateStatsDisplay(data);
    });

    const tabHandlers = {
        'stats': async () => {
            try {
                const statsData = await fetchStatsApi();
                updateStatsDisplay(statsData);
            } catch (error) {
                console.error("Failed to fetch stats:", error);
            }
        },
        'rules': () => fetchRules(),
        'variables': () => fetchVariables(),
        'settings': () => fetchSettings(),
        'chat': () => {
            // Chat is initialized once, no need to re-fetch
        },
        'additional': () => {
            // This will handle sub-tab changes when the modules are available.
            initSubNavigation((subTabName) => {
                if (subTabName === 'owner-rules') {
                    fetchOwnerRules();
                } else if (subTabName === 'owners-list') {
                    fetchOwners();
                }
            });
        }
    };
    
    // NOTE: subTabHandlers and initSubNavigation are removed
    // as there are no longer any sub-tabs.

    initBottomNavigation((tabName) => {
        if (tabHandlers[tabName]) {
            tabHandlers[tabName]();
        }
    });

    // Initialize all modules
    initChat();
    initRules();
    initVariables();
    initSettings();
    initOwnerRules();
    initOwners();

    // Initial load
    async function initialLoad() {
        toggleLoading(true);
        try {
            await Promise.all([
                fetchStatsApi().then(updateStatsDisplay),
                fetchRules(),
                fetchVariables(),
                fetchSettings(),
                fetchOwnerRules(),
                fetchOwners()
            ]);
        } catch (error) {
            showToast('Failed to initialize application', 'fail');
            console.error('Initialization error:', error);
        } finally {
            toggleLoading(false);
        }
    }

    initialLoad();
});