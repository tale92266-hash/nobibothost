// file: public/main.js

import { initRules } from './rules.js';
import { initOwnerRules, initOwnerManagement } from './owner.js';
import { initSettings } from './settings.js';
import { initVariables } from './variables.js';
import { initChat } from './chat.js';
import { fetchStatsApi } from './api.js';
import { showToast } from './ui.js';

let currentTab = 'rules';
let statsData = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

/**
 * Initialize the application
 */
async function initializeApp() {
    try {
        await loadStats();
        initializeNavigation();
        initializeTabContent();
        setupTabSwitching();
        showTab('rules');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showToast('Failed to initialize application', 'error');
    }
}

/**
 * Load and display stats
 */
async function loadStats() {
    try {
        statsData = await fetchStatsApi();
        updateStatsDisplay();
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

/**
 * Update stats display in header and dashboard
 */
function updateStatsDisplay() {
    if (!statsData) return;

    const headerTotalUsers = document.getElementById('headerTotalUsers');
    const headerTotalMsgs = document.getElementById('headerTotalMsgs');
    
    if (headerTotalUsers) headerTotalUsers.textContent = statsData.totalUsers || 0;
    if (headerTotalMsgs) headerTotalMsgs.textContent = statsData.totalMessages || 0;
}

/**
 * Initialize navigation
 */
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const tabName = this.dataset.tab;
            if (tabName) {
                showTab(tabName);
            }
        });
    });
}

/**
 * Setup tab switching functionality
 */
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('[data-tab]');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const tabName = this.dataset.tab;
            if (tabName) {
                showTab(tabName);
            }
        });
    });
}

/**
 * Show specific tab and initialize its content
 */
function showTab(tabName) {
    if (currentTab === tabName) return;
    
    hideAllTabs();
    currentTab = tabName;
    
    const tabContent = document.getElementById(tabName);
    const navItem = document.querySelector(`[data-tab="${tabName}"]`);
    
    if (tabContent) {
        tabContent.style.display = 'block';
        tabContent.classList.add('active');
    }
    
    if (navItem) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        navItem.classList.add('active');
    }
    
    // Initialize tab-specific content
    initializeTabContentForTab(tabName);
}

/**
 * Hide all tabs
 */
function hideAllTabs() {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
}

/**
 * Initialize content for specific tabs
 */
function initializeTabContentForTab(tabName) {
    switch(tabName) {
        case 'rules':
            initRules();
            break;
        case 'owner':
            // Fix: Initialize owner content immediately
            setTimeout(() => {
                initOwnerRules();
                initOwnerManagement();
            }, 100);
            break;
        case 'settings':
            initSettings();
            break;
        case 'variables':
            initVariables();
            break;
        case 'chat':
            initChat();
            break;
        case 'stats':
            displayStatsTab();
            break;
    }
}

/**
 * Initialize all tab content
 */
function initializeTabContent() {
    initRules();
    initOwnerRules();
    initOwnerManagement();
    initSettings();
    initVariables();
    initChat();
}

/**
 * Display stats tab content
 */
function displayStatsTab() {
    if (!statsData) {
        loadStats();
        return;
    }
    
    const statsContainer = document.getElementById('statsContent');
    if (statsContainer && statsData) {
        statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${statsData.totalUsers || 0}</div>
                        <div class="stat-label">Total Users</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-comments"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${statsData.totalMessages || 0}</div>
                        <div class="stat-label">Total Messages</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${statsData.botResponses || 0}</div>
                        <div class="stat-label">Bot Responses</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">${new Date().toLocaleDateString()}</div>
                        <div class="stat-label">Last Updated</div>
                    </div>
                </div>
            </div>
        `;
    }
}

/**
 * Refresh current tab content
 */
function refreshCurrentTab() {
    if (currentTab) {
        initializeTabContentForTab(currentTab);
    }
}

// Export functions for external use
window.showTab = showTab;
window.refreshCurrentTab = refreshCurrentTab;
