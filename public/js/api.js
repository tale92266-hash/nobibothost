const APIModule = {
    // Fetch stats from server
    async fetchStats() {
        try {
            const response = await fetch('/stats');
            const data = await response.json();
            StatsModule.updateDisplay(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    },

    // Fetch all rules
    async fetchRules() {
        const loadingMessage = document.getElementById('loadingMessage');
        const rulesList = document.getElementById('rulesList');
        
        if (!loadingMessage || !rulesList) return;
        
        loadingMessage.style.display = 'block';
        rulesList.innerHTML = '';
        
        try {
            const response = await fetch('/api/rules');
            const data = await response.json();
            
            RulesModule.setAllRules(data);
            RulesModule.setTotalRules(data.length);
            
            console.log(`📋 Loaded ${data.length} rules from server`);
            
            loadingMessage.style.display = 'none';
            
            if (data.length === 0) {
                rulesList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-robot fa-3x"></i>
                        <h5>No Rules Found</h5>
                        <p>Add your first rule to get started!</p>
                    </div>
                `;
            } else {
                RulesModule.renderRulesList(data);
            }
        } catch (error) {
            console.error('Failed to fetch rules:', error);
            loadingMessage.style.display = 'none';
            rulesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-3x text-warning"></i>
                    <h5>Error Loading Rules</h5>
                    <p>Please try refreshing the page</p>
                </div>
            `;
            UIModule.showToast('Failed to load rules', 'fail');
        }
    },

    // Update rule (add/edit/delete)
    async updateRule(type, rule, oldRuleNumber = null) {
        try {
            const response = await fetch('/api/rules/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, rule, oldRuleNumber })
            });
            
            const result = await response.json();
            
            if (result.success) {
                UIModule.showToast(result.message || 'Rule updated successfully!', 'success');
                await this.fetchRules();
                return true;
            } else {
                UIModule.showToast(result.message || 'Failed to update rule', 'fail');
                return false;
            }
        } catch (error) {
            console.error('Failed to update rule:', error);
            UIModule.showToast('Network error: ' + error.message, 'fail');
            return false;
        }
    },

    // Bulk update rules for reordering
    async bulkUpdateRules(reorderedRules) {
        try {
            console.log('📡 Sending bulk update for', reorderedRules.length, 'rules');
            
            const response = await fetch('/api/rules/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules: reorderedRules })
            });
            
            const result = await response.json();
            console.log('📨 Bulk update response:', result);
            
            if (result.success) {
                console.log('✅ Bulk update successful');
                if (result.errors && result.errors.length > 0) {
                    console.warn('⚠️ Some errors occurred:', result.errors);
                }
                return true;
            } else {
                console.error('❌ Bulk update failed:', result.message);
                UIModule.showToast(result.message || 'Failed to update rules order', 'fail');
                return false;
            }
        } catch (error) {
            console.error('❌ Network error during bulk update:', error);
            UIModule.showToast('Network error during bulk update: ' + error.message, 'fail');
            return false;
        }
    },

    // Fetch all variables
    async fetchVariables() {
        try {
            const response = await fetch('/api/variables');
            const data = await response.json();
            
            VariablesModule.setAllVariables(data);
            VariablesModule.renderVariablesList(data);
        } catch (error) {
            console.error('Failed to fetch variables:', error);
            UIModule.showToast('Failed to load variables', 'fail');
        }
    },

    // Update variable (add/edit/delete)
    async updateVariable(type, variable, oldName = null) {
        try {
            const response = await fetch('/api/variables/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, variable, oldName })
            });
            
            const result = await response.json();
            
            if (result.success) {
                UIModule.showToast(result.message || 'Variable updated successfully!', 'success');
                await this.fetchVariables();
                return true;
            } else {
                UIModule.showToast(result.message || 'Failed to update variable', 'fail');
                return false;
            }
        } catch (error) {
            console.error('Failed to update variable:', error);
            UIModule.showToast('Network error: ' + error.message, 'fail');
            return false;
        }
    }
};
