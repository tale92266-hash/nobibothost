// file: public/main.js

document.addEventListener("DOMContentLoaded", () => {
    const socket = io();
    socket.on('statsUpdate', (data) => {
        updateStatsDisplay(data);
    });

    // Saare functions ab global scope mein available hain
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
    
    // Add this line to fetch settings immediately on page load
    fetchSettings();
});
