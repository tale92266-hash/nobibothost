/// file: public/main.js

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
            initSubNavigation((subTabName) => {
                if (subTabName === 'owner-rules') {
                    fetchOwnerRules();
                } else if (subTabName === 'owners') {
                    fetchOwners();
                } else if (subTabName === 'automation') {
                    // Automation pane logic here
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
    initOwnerRules();
    initOwners();
    
    // Initial fetch for the default selected tab (stats)
    tabHandlers['stats']();
});
