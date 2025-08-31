const ValidationModule = {
    init() {
        console.log('Validation module initialized');
    },

    validateRuleNumber(num, isEditing = false) {
        const ruleNumberError = document.getElementById('ruleNumberError');
        const totalRules = RulesModule.getTotalRules();
        const maxAllowed = isEditing ? totalRules : totalRules + 1;
        
        if (num > maxAllowed) {
            ruleNumberError.style.display = 'block';
            if (isEditing) {
                ruleNumberError.innerText = `In edit mode, rule number cannot be greater than ${totalRules}`;
            } else {
                ruleNumberError.innerText = `In add mode, rule number cannot be greater than ${totalRules + 1}`;
            }
            return false;
        } else if (num < 1) {
            ruleNumberError.style.display = 'block';
            ruleNumberError.innerText = `Rule number must be at least 1`;
            return false;
        }
        
        ruleNumberError.style.display = 'none';
        return true;
    },

    setupRuleNumberValidation(isEditing = false) {
        const ruleNumberInput = document.getElementById('ruleNumber');
        if (!ruleNumberInput) return;
        
        const totalRules = RulesModule.getTotalRules();
        const maxAllowed = isEditing ? totalRules : totalRules + 1;
        
        // Set HTML attributes safely
        ruleNumberInput.setAttribute('max', maxAllowed);
        ruleNumberInput.setAttribute('min', 1);
        
        console.log(`🔢 Rule number validation setup: min=1, max=${maxAllowed} (${isEditing ? 'Edit' : 'Add'} mode)`);
        
        // Remove existing event listeners
        const newHandler = function(e) {
            let value = parseInt(e.target.value);
            if (isNaN(value)) {
                return;
            }
            
            // Auto-correct out-of-bounds values
            if (value < 1) {
                e.target.value = 1;
                value = 1;
            } else if (value > maxAllowed) {
                e.target.value = maxAllowed;
                value = maxAllowed;
                if (isEditing) {
                    UIModule.showToast(`Maximum rule number in edit mode is ${totalRules}`, 'warning');
                } else {
                    UIModule.showToast(`Maximum rule number in add mode is ${totalRules + 1}`, 'warning');
                }
            }
            
            // Validate the corrected value
            ValidationModule.validateRuleNumber(value, isEditing);
        };
        
        // Remove previous listeners and add new one
        if (ruleNumberInput._currentHandler) {
            ruleNumberInput.removeEventListener('input', ruleNumberInput._currentHandler);
        }
        ruleNumberInput.addEventListener('input', newHandler);
        ruleNumberInput._currentHandler = newHandler;
        
        // Prevent invalid input on keydown
        const keydownHandler = function(e) {
            // Allow backspace, delete, tab, escape, enter
            if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
                // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                (e.keyCode === 65 && e.ctrlKey === true) ||
                (e.keyCode === 67 && e.ctrlKey === true) ||
                (e.keyCode === 86 && e.ctrlKey === true) ||
                (e.keyCode === 88 && e.ctrlKey === true) ||
                // Allow home, end, left, right
                (e.keyCode >= 35 && e.keyCode <= 39)) {
                return;
            }
            
            // Ensure that it is a number and stop the keypress
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                e.preventDefault();
            }
        };
        
        if (ruleNumberInput._currentKeydownHandler) {
            ruleNumberInput.removeEventListener('keydown', ruleNumberInput._currentKeydownHandler);
        }
        ruleNumberInput.addEventListener('keydown', keydownHandler);
        ruleNumberInput._currentKeydownHandler = keydownHandler;
    },

    validateRuleForm(formData) {
        // Validate rule number
        if (!this.validateRuleNumber(formData.ruleNumber, RulesModule.currentRuleNumber !== null)) {
            return false;
        }
        
        // Validate required fields
        if (!formData.ruleType) {
            UIModule.showToast('Please select a rule type', 'fail');
            return false;
        }
        
        if (!formData.replyText.trim()) {
            UIModule.showToast('Please enter a reply text', 'fail');
            return false;
        }
        
        // Validate keywords for non-welcome/default rules
        if (formData.ruleType !== 'WELCOME' && formData.ruleType !== 'DEFAULT' && !formData.keywords.trim()) {
            UIModule.showToast('Please enter keywords for this rule type', 'fail');
            return false;
        }
        
        return true;
    },

    validateVariableForm(formData) {
        if (!formData.name.trim()) {
            UIModule.showToast('Please enter a variable name', 'fail');
            return false;
        }
        
        if (!formData.value.trim()) {
            UIModule.showToast('Please enter a variable value', 'fail');
            return false;
        }
        
        // Validate variable name format (alphanumeric and underscores only)
        const namePattern = /^[a-zA-Z0-9_]+$/;
        if (!namePattern.test(formData.name)) {
            UIModule.showToast('Variable name can only contain letters, numbers, and underscores', 'fail');
            return false;
        }
        
        return true;
    }
};
