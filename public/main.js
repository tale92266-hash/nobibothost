// file: public/main.js

import { toggleLoading, showToast, initBottomNavigation, initSubNavigation, updateStatsDisplay } from './ui.js';
import { fetchStatsApi } from './api.js';
import { initChat } from './chat.js';
import { initRules, fetchRules } from './rules.js';
import { initVariables, fetchVariables } from './variables.js';
import { initSettings, fetchSettings } from './settings.js';
import { initOwnerRules, fetchOwnerRules, initOwnerManagement, fetchOwners } from './owner.js';

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
        'additional': () => {
            // This tab is now handled by subTabHandlers below
        },
        'chat': () => {
            // Chat is initialized once, no need to re-fetch
        }
    };
    
    const subTabHandlers = {
        'owner-name': () => {
            fetchOwnerRules();
            fetchOwners();
        },
        'automation-name': () => {
            // Placeholder for future logic
            console.log("Automation Name tab selected.");
        }
    };

    initBottomNavigation((tabName) => {
        if (tabHandlers[tabName]) {
            tabHandlers[tabName]();
        }
    });

    initSubNavigation((subTabName) => {
        if (subTabHandlers[subTabName]) {
            subTabHandlers[subTabName]();
        }
    });

    // Initialize all modules
    initChat();
    initRules();
    initVariables();
    initSettings();
    initOwnerRules();
    initOwnerManagement();

    // Initial load
    async function initialLoad() {
        toggleLoading(true);
        try {
            await Promise.all([
                fetchStatsApi().then(updateStatsDisplay),
                fetchRules(),
                fetchVariables(),
                fetchSettings(),
                fetchOwnerRules(), // This will ensure owner rules are fetched on initial load
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