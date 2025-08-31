// Main application initialization and core functionality
document.addEventListener("DOMContentLoaded", () => {
    // Initialize all modules
    StatsModule.init();
    SocketModule.init();
    RulesModule.init();
    VariablesModule.init();
    ChatModule.init();
    UIModule.init();
    
    // Initialize bottom navigation
    initBottomNavigation();
    
    // Initialize the app
    init();
});

// Bottom Navigation Handler
function initBottomNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // Set first tab as active
    if (navItems.length > 0) {
        navItems[0].classList.add('active');
    }
    
    navItems.forEach(navItem => {
        navItem.addEventListener('click', () => {
            const tabName = navItem.getAttribute('data-tab');
            
            // Remove active class from all nav items
            navItems.forEach(item => item.classList.remove('active'));
            
            // Add active class to clicked nav item
            navItem.classList.add('active');
            
            // Hide all tab panes
            tabPanes.forEach(pane => {
                pane.classList.remove('show', 'active');
            });
            
            // Show selected tab pane
            const targetPane = document.getElementById(`${tabName}-pane`);
            if (targetPane) {
                targetPane.classList.add('show', 'active');
            }
            
            // Load data based on tab
            if (tabName === 'rules' && RulesModule.getAllRules().length === 0) {
                APIModule.fetchRules();
            } else if (tabName === 'settings' && VariablesModule.getAllVariables().length === 0) {
                APIModule.fetchVariables();
            }
        });
    });
}

// Add chat navigation if not exists
function addChatNavigation() {
    const navContainer = document.querySelector('.bottom-navigation');
    if (!navContainer) return;
    
    const chatNavExists = document.querySelector('[data-tab="chat"]');
    if (chatNavExists) return;
    
    const chatNavItem = document.createElement('div');
    chatNavItem.className = 'nav-item';
    chatNavItem.setAttribute('data-tab', 'chat');
    chatNavItem.innerHTML = `
        <i class="fas fa-comments"></i>
        <span>Chat</span>
    `;
    
    // Insert before settings tab
    const settingsTab = document.querySelector('[data-tab="settings"]');
    if (settingsTab) {
        navContainer.insertBefore(chatNavItem, settingsTab);
    } else {
        navContainer.appendChild(chatNavItem);
    }
}

// Initialize application
async function init() {
    try {
        addChatNavigation();
        await APIModule.fetchStats();
        await APIModule.fetchRules();
        await APIModule.fetchVariables();
    } catch (error) {
        console.error('Initialization error:', error);
        UIModule.showToast('Failed to initialize application', 'fail');
    }
}
