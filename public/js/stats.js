const StatsModule = {
    init() {
        // Initialize stats module
        console.log('Stats module initialized');
    },

    updateDisplay(data) {
        // Update main stats cards
        const totalUsers = document.getElementById('totalUsers');
        const todayUsers = document.getElementById('todayUsers');
        const totalMsgs = document.getElementById('totalMsgs');
        const todayMsgs = document.getElementById('todayMsgs');
        
        if (totalUsers) totalUsers.textContent = data.totalUsers || 0;
        if (todayUsers) todayUsers.textContent = data.todayUsers || 0;
        if (totalMsgs) totalMsgs.textContent = (data.totalMsgs || 0).toLocaleString();
        if (todayMsgs) todayMsgs.textContent = (data.todayMsgs || 0).toLocaleString();
        
        // Update header mini stats
        const headerTotalUsers = document.getElementById('headerTotalUsers');
        const headerTotalMsgs = document.getElementById('headerTotalMsgs');
        
        if (headerTotalUsers) headerTotalUsers.textContent = data.totalUsers || 0;
        if (headerTotalMsgs) headerTotalMsgs.textContent = (data.totalMsgs || 0).toLocaleString();
        
        // Update last update time
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) {
            const now = new Date();
            lastUpdate.textContent = now.toLocaleTimeString();
        }
    }
};
