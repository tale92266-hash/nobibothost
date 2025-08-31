// Rule Edit Functionality
(function() {
    'use strict';

    // Global variables
    let currentRuleNumber = null;

    // DOM Elements for Edit Rule
    const ruleModal = new bootstrap.Modal(document.getElementById("ruleModal"));
    const ruleForm = document.getElementById("ruleForm");
    const formTitle = document.getElementById("formTitle");
    const deleteRuleBtn = document.getElementById("deleteRuleBtn");
    const saveRuleBtn = document.getElementById('saveRuleBtn');

    // Delete Rule Event Listener
    if (deleteRuleBtn) {
        deleteRuleBtn.addEventListener('click', () => {
            if (currentRuleNumber) {
                deleteRule(currentRuleNumber);
            }
        });
    }

    // Edit Rule Function (called from rule cards)
    function editRule(ruleNumber) {
        console.log('✏️ Opening Edit Rule Modal for rule:', ruleNumber);
        
        const rule = window.allRules.find(r => r.RULE_NUMBER === ruleNumber);
        if (!rule) {
            window.showToast('Rule not found', 'fail');
            return;
        }

        currentRuleNumber = ruleNumber;
        
        // Set modal title
        formTitle.textContent = `Edit Rule #${ruleNumber}`;
        
        // Configure modal for edit mode
        window.configureModalButtons('rule', 'edit');
        
        // Populate form with rule data
        populateRuleForm(rule);
        
        // Setup rule number validation for edit mode
        window.setupRuleNumberValidation(true);
        
        // Show modal
        ruleModal.show();
        
        console.log('✅ Edit modal opened for rule:', ruleNumber);
    }

    function populateRuleForm(rule) {
        document.getElementById('ruleNumber').value = rule.RULE_NUMBER || '';
        document.getElementById('ruleName').value = rule.RULE_NAME || '';
        document.getElementById('ruleType').value = rule.RULE_TYPE || 'KEYWORD';
        document.getElementById('keywords').value = rule.KEYWORDS || '';
        document.getElementById('repliesType').value = rule.REPLIES_TYPE || 'RANDOM';
        document.getElementById('replyText').value = rule.REPLY_TEXT || '';
        document.getElementById('targetUsersToggle').value = rule.TARGET_USERS_TOGGLE || 'ALL';
        document.getElementById('targetUsers').value = rule.TARGET_USERS || 'ALL';
        
        // Toggle form fields based on rule type
        window.toggleFormFields(rule.RULE_TYPE || 'KEYWORD');
        window.toggleTargetUsersField();
    }

    async function updateRule() {
        try {
            if (!currentRuleNumber) {
                window.showToast('No rule selected for update', 'fail');
                return;
            }

            const formData = new FormData(ruleForm);
            const ruleData = Object.fromEntries(formData.entries());
            
            // Validate required fields
            if (!ruleData.RULE_NAME || !ruleData.REPLY_TEXT) {
                window.showToast('Please fill in all required fields', 'warning');
                return;
            }

            // Validate rule number
            const newRuleNumber = parseInt(ruleData.RULE_NUMBER);
            if (!window.validateRuleNumber(newRuleNumber, true)) {
                return;
            }

            console.log('💾 Updating rule:', currentRuleNumber, 'with data:', ruleData);

            // Check if rule number changed - handle reordering
            if (newRuleNumber !== currentRuleNumber) {
                console.log(`🔄 Rule number changed: ${currentRuleNumber} → ${newRuleNumber}`);
                
                // Reorder rules array
                const reorderedRules = reorderRulesArray(window.allRules, currentRuleNumber, newRuleNumber);
                
                // Update the specific rule data
                const ruleToUpdate = reorderedRules.find(r => r.RULE_NUMBER === newRuleNumber);
                if (ruleToUpdate) {
                    Object.assign(ruleToUpdate, ruleData);
                    ruleToUpdate.RULE_NUMBER = newRuleNumber;
                }
                
                // Bulk update all rules
                const success = await bulkUpdateRules(reorderedRules);
                if (success) {
                    window.showToast('Rule updated and reordered successfully!', 'success');
                    ruleModal.hide();
                    await window.fetchRules();
                }
            } else {
                // Simple update without reordering
                const response = await fetch(`/api/rules/${currentRuleNumber}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(ruleData)
                });

                const result = await response.json();

                if (result.success) {
                    window.showToast('Rule updated successfully!', 'success');
                    ruleModal.hide();
                    await window.fetchRules();
                    console.log('✅ Rule updated successfully');
                } else {
                    window.showToast(result.message || 'Failed to update rule', 'fail');
                    console.error('❌ Failed to update rule:', result);
                }
            }
        } catch (error) {
            console.error('❌ Error updating rule:', error);
            window.showToast('Error updating rule: ' + error.message, 'fail');
        }
    }

    async function deleteRule(ruleNumber) {
        if (!confirm(`Are you sure you want to delete Rule #${ruleNumber}?`)) {
            return;
        }

        try {
            console.log('🗑️ Deleting rule:', ruleNumber);

            const response = await fetch(`/api/rules/${ruleNumber}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                window.showToast('Rule deleted successfully!', 'success');
                ruleModal.hide();
                await window.fetchRules();
                console.log('✅ Rule deleted successfully');
            } else {
                window.showToast(result.message || 'Failed to delete rule', 'fail');
                console.error('❌ Failed to delete rule:', result);
            }
        } catch (error) {
            console.error('❌ Error deleting rule:', error);
            window.showToast('Error deleting rule: ' + error.message, 'fail');
        }
    }

    function reorderRulesArray(rules, oldRuleNumber, newRuleNumber) {
        if (oldRuleNumber === newRuleNumber) return rules;
        
        console.log(`🔄 Reordering: Rule ${oldRuleNumber} → Rule ${newRuleNumber}`);

        const fromIndex = rules.findIndex(r => r.RULE_NUMBER === oldRuleNumber);
        const toIndex = newRuleNumber - 1;

        if (fromIndex === -1) {
            console.error('❌ Rule not found:', oldRuleNumber);
            return rules;
        }

        if (toIndex < 0 || toIndex >= rules.length) {
            console.error('❌ Invalid target position:', newRuleNumber);
            return rules;
        }

        console.log(`📍 Moving from array index ${fromIndex} to index ${toIndex}`);

        const newRules = [...rules];
        const [movingRule] = newRules.splice(fromIndex, 1);
        console.log(`📤 Removed rule: ${movingRule.RULE_NAME || 'Unnamed'} (was #${movingRule.RULE_NUMBER})`);

        newRules.splice(toIndex, 0, movingRule);
        console.log(`📥 Inserted at position ${toIndex}`);

        const finalRules = newRules.map((rule, index) => ({
            ...rule,
            RULE_NUMBER: index + 1
        }));

        console.log('✅ New rule order:', finalRules.map(r => `#${r.RULE_NUMBER}: ${r.RULE_NAME || 'Unnamed'}`));
        return finalRules;
    }

    async function bulkUpdateRules(reorderedRules) {
        try {
            console.log('📡 Sending bulk update for', reorderedRules.length, 'rules');
            console.log('📊 Sample rule:', {
                _id: reorderedRules[0]._id,
                RULE_NUMBER: reorderedRules[0].RULE_NUMBER,
                RULE_NAME: reorderedRules[0].RULE_NAME
            });

            const response = await fetch('/api/rules/bulk-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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
                window.showToast(result.message || 'Failed to update rules order', 'fail');
                return false;
            }
        } catch (error) {
            console.error('❌ Network error during bulk update:', error);
            window.showToast('Network error during bulk update: ' + error.message, 'fail');
            return false;
        }
    }

    // Override save button for edit mode
    if (saveRuleBtn) {
        const originalClickHandler = saveRuleBtn.onclick;
        saveRuleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentRuleNumber) {
                updateRule();
            } else {
                // Call original add rule handler if available
                if (window.saveRule) {
                    window.saveRule();
                }
            }
        });
    }

    // Make functions globally available
    window.editRule = editRule;
    window.deleteRule = deleteRule;
    window.updateRule = updateRule;
    window.reorderRulesArray = reorderRulesArray;
    window.bulkUpdateRules = bulkUpdateRules;

})();
