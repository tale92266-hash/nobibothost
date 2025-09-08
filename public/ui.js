// file: public/ui.js

/**
 * Manages the loading state of the UI.
 * @param {boolean} show - True to show loading, false to hide.
 */
function toggleLoading(show) {
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) {
        loadingMessage.style.display = show ? 'flex' : 'none';
    }
}

/**
 * Displays a toast notification.
 * @param {string} message - The message to display.
 * @param {'success' | 'fail' | 'warning'} [type='success'] - The type of toast.
 */
function showToast(message, type = 'success') {
    const toastElement = document.getElementById('liveToast');
    if (!toastElement) return;
    const toastBody = toastElement.querySelector('.toast-body');
    toastBody.textContent = message;
    toastElement.classList.remove('success', 'fail', 'warning');
    toastElement.classList.add(type);
    const toastInstance = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 4000
    });
    toastInstance.show();
}

/**
 * Initializes the bottom navigation.
 * @param {Function} onTabChange - Callback function for tab change.
 */
function initBottomNavigation(onTabChange) {
    const navItems = document.querySelectorAll('.bottom-navigation .nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(navItem => {
        navItem.addEventListener('click', () => {
            const tabName = navItem.getAttribute('data-tab');
            navItems.forEach(item => item.classList.remove('active'));
            navItem.classList.add('active');
            tabPanes.forEach(pane => {
                pane.classList.remove('show', 'active');
            });
            const targetPane = document.getElementById(`${tabName}-pane`);
            if (targetPane) {
                targetPane.classList.add('show', 'active');
            }
            onTabChange(tabName);
        });
    });
}

/**
 * Initializes the sub-navigation.
 * @param {Function} onSubTabChange - Callback function for sub-tab change.
 */
function initSubNavigation(onSubTabChange) {
    const subNavItems = document.querySelectorAll('.sub-navigation .nav-item');
    const subTabPanes = document.querySelectorAll('.sub-tab-content .tab-pane');

    // Default select the 'owner-rules' sub-tab on initial load
    const ownerRulesSubTab = document.querySelector('.sub-navigation .nav-item[data-sub-tab="owner-rules"]');
    const ownerRulesSubTabPane = document.getElementById('owner-rules-pane');
    if (ownerRulesSubTab && ownerRulesSubTabPane) {
        ownerRulesSubTab.classList.add('active');
        ownerRulesSubTabPane.classList.add('show', 'active');
        onSubTabChange('owner-rules');
    }

    subNavItems.forEach(navItem => {
        navItem.addEventListener('click', () => {
            const subTabName = navItem.getAttribute('data-sub-tab');
            subNavItems.forEach(item => item.classList.remove('active'));
            navItem.classList.add('active');
            subTabPanes.forEach(pane => {
                pane.classList.remove('show', 'active');
            });
            const targetPane = document.getElementById(`${subTabName}-pane`);
            if (targetPane) {
                targetPane.classList.add('show', 'active');
            }
            onSubTabChange(subTabName);
        });
    });
}

/**
 * Configures the state of modal buttons.
 * @param {'rule' | 'variable' | 'ownerRule'} modalType - The type of modal.
 * @param {'add' | 'edit'} mode - The mode of the modal.
 */
function configureModalButtons(modalType, mode) {
    let deleteBtn, buttonContainer;
    if (modalType === 'rule') {
        deleteBtn = document.getElementById('deleteRuleBtn');
        buttonContainer = document.querySelector('#ruleModal .modal-footer');
    } else if (modalType === 'variable') {
        deleteBtn = document.getElementById('deleteVariableBtn');
        buttonContainer = document.querySelector('#variableModal .modal-footer');
    } else if (modalType === 'ownerRule') {
        deleteBtn = document.getElementById('deleteOwnerRuleBtn');
        buttonContainer = document.querySelector('#ownerRuleModal .modal-footer');
    }

    if (!deleteBtn || !buttonContainer) {
        return;
    }

    deleteBtn.style.display = (mode === 'edit') ? 'inline-flex' : 'none';
}

/**
 * Updates the stats display on the dashboard.
 * @param {object} data - The stats data.
 */
function updateStatsDisplay(data) {
    const totalUsers = document.getElementById('totalUsers');
    const todayUsers = document.getElementById('todayUsers');
    const totalMsgs = document.getElementById('totalMsgs');
    const todayMsgs = document.getElementById('todayMsgs');
    const hiddenUsers = document.getElementById('hiddenUsers');
    const headerTotalUsers = document.getElementById('headerTotalUsers');
    const headerTotalMsgs = document.getElementById('headerTotalMsgs');
    const lastUpdate = document.getElementById('lastUpdate');
    
    if (totalUsers) totalUsers.textContent = data.totalUsers || 0;
    if (todayUsers) todayUsers.textContent = data.todayUsers || 0;
    if (totalMsgs) totalMsgs.textContent = (data.totalMsgs || 0).toLocaleString();
    if (todayMsgs) todayMsgs.textContent = (data.todayMsgs || 0).toLocaleString();
    if (hiddenUsers) hiddenUsers.textContent = data.hiddenUsersCount || 0;
    if (headerTotalUsers) headerTotalUsers.textContent = data.totalUsers || 0;
    if (headerTotalMsgs) headerTotalMsgs.textContent = (data.totalMsgs || 0).toLocaleString();
    if (lastUpdate) lastUpdate.textContent = new Date().toLocaleTimeString();
}

/**
 * Updates the bot status button and text.
 * @param {boolean} isOnline - The bot's online status.
 */
function updateBotStatusUI(isOnline) {
    const botStatusBtn = document.getElementById('botStatusBtn');
    const botStatusText = document.getElementById('botStatusText');

    if (botStatusBtn) {
        botStatusBtn.classList.remove('bot-on', 'bot-off', 'bot-loading');
        botStatusBtn.classList.add(isOnline ? 'bot-on' : 'bot-off');
    }
    if (botStatusText) {
        botStatusText.innerHTML = isOnline ? 'Bot is Online' : 'Bot is Offline';
    }
}