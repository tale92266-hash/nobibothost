// file: public/main.js

import { toggleLoading, showToast, initBottomNavigation, updateStatsDisplay } from './ui.js';
import { fetchStatsApi } from './api.js';
import { initChat } from './chat.js';
import { initRules, fetchRules } from './rules.js';
import { initVariables, fetchVariables } from './variables.js';
import { initSettings, fetchSettings } from './settings.js';

// NEW IMPORTS
import { initSubNavigation } from './ui.js';
import { initOwners, fetchOwners } from './owners.js';
import { initOwnerRules, fetchOwnerRules } from './owner-rules.js';

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
        'chat': () => {
            // Chat is initialized once, no need to re-fetch
        },
        'variables': () => fetchVariables(),
        'settings': () => fetchSettings(),
        'additional': () => {
            initSubNavigation((subTabName) => {
                if (subTabName === 'owner-name') {
                    fetchOwners();
                } else if (subTabName === 'owner-rules') {
                    fetchOwnerRules();
                } else {
                    // Automation tab will fetch its data here
                }
            });
        }
    };
    
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
    initOwners();
    initOwnerRules();


    // Initial load
    async function initialLoad() {
        toggleLoading(true);
        try {
            await Promise.all([
                fetchStatsApi().then(updateStatsDisplay),
                fetchRules(),
                fetchVariables(),
                fetchSettings(),
                fetchOwners(),
                fetchOwnerRules()
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