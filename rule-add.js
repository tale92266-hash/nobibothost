// Rule Add Functionality
(function() {
    'use strict';

    // DOM Elements for Add Rule
    const addRuleBtn = document.getElementById("addRuleBtn");
    const ruleModal = new bootstrap.Modal(document.getElementById("ruleModal"));
    const ruleForm = document.getElementById("ruleForm");
    const formTitle = document.getElementById("formTitle");
    const saveRuleBtn = document.getElementById('saveRuleBtn');
    const ruleTypeSelect = document.getElementById('ruleType');
    const keywordsField = document.getElementById('keywordsField');
    const repliesTypeField = document.getElementById('repliesTypeField');
    const replyTextField = document.getElementById('replyTextField');
    const targetUsersToggle = document.getElementById('targetUsersToggle');
    const targetUsersField = document.getElementById('targetUsersField');
    const ruleNumberInput = document.getElementById('ruleNumber');
    const ruleNumberError = document.getElementById('ruleNumberError');

    // Add Rule Event Listener
    if (addRuleBtn) {
        addRuleBtn.addEventListener('click', () => {
            openAddRuleModal();
        });
    }

    // Rule Type Change Handler
    if (ruleTypeSelect) {
        ruleTypeSelect.addEventListener('change', (e) => {
            toggleFormFields(e.target.value);
        });
    }

    // Target Users Toggle Handler
    if (targetUsersToggle) {
        targetUsersToggle.addEventListener('change', () => {
            toggleTargetUsersField();
        });
    }

    // Save Rule Handler
    if (saveRuleBtn) {
        saveRuleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveRule();
        });
    }

    function openAddRuleModal() {
        console.log('🆕 Opening Add Rule Modal');
        
        // Reset form
        ruleForm.reset();
        
        // Set modal title
        formTitle.textContent = 'Add New Rule';
        
        // Configure modal for add mode
        configureModalButtons('rule', 'add');
        
        // Set default values
        document.getElementById('ruleType').value = 'KEYWORD';
        document.getElementById('repliesType').value = 'RANDOM';
        document.getElementById('targetUsersToggle').value = 'ALL';
        document.getElementById('keywords').value = '';
        document.getElementById('targetUsers').value = 'ALL';
        
        // Setup rule number validation for add mode
        setupRuleNumberValidation(false);
        
        // Set next available rule number
        const nextRuleNumber = (window.totalRules || 0) + 1;
        ruleNumberInput.value = nextRuleNumber;
        
        // Toggle form fields based on default rule type
        toggleFormFields('KEYWORD');
        toggleTargetUsersField();
        
        // Show modal
        ruleModal.show();
        
        console.log(`✅ Add modal opened with rule number: ${nextRuleNumber}`);
    }

    function toggleFormFields(ruleType) {
        if (ruleType === 'WELCOME' || ruleType === 'DEFAULT') {
            keywordsField.style.display = 'none';
            repliesTypeField.style.display = 'none';
            replyTextField.style.display = 'block';
            document.getElementById('keywords').value = "ALL";
        } else {
            keywordsField.style.display = 'block';
            repliesTypeField.style.display = 'block';
            replyTextField.style.display = 'block';
        }
        
        if (!document.getElementById('repliesType').value) {
            document.getElementById('repliesType').value = 'RANDOM';
        }
    }

    function toggleTargetUsersField() {
        const isTargetOrIgnored = targetUsersToggle.value === 'TARGET' || targetUsersToggle.value === 'IGNORED';
        targetUsersField.style.display = isTargetOrIgnored ? 'block' : 'none';
        
        if (!isTargetOrIgnored) {
            document.getElementById('targetUsers').value = "ALL";
        }
    }

    function setupRuleNumberValidation(isEditing = false) {
        const maxAllowed = isEditing ? window.totalRules : (window.totalRules || 0) + 1;
        
        ruleNumberInput.setAttribute('max', maxAllowed);
        ruleNumberInput.setAttribute('min', 1);
        
        console.log(`🔢 Rule number validation setup: min=1, max=${maxAllowed} (${isEditing ? 'Edit' : 'Add'} mode)`);

        const newHandler = function(e) {
            let value = parseInt(e.target.value);
            if (isNaN(value)) {
                return;
            }

            if (value < 1) {
                e.target.value = 1;
                value = 1;
            } else if (value > maxAllowed) {
                e.target.value = maxAllowed;
                value = maxAllowed;
                if (isEditing) {
                    window.showToast(`Maximum rule number in edit mode is ${window.totalRules}`, 'warning');
                } else {
                    window.showToast(`Maximum rule number in add mode is ${(window.totalRules || 0) + 1}`, 'warning');
                }
            }

            validateRuleNumber(value, isEditing);
        };

        if (ruleNumberInput._currentHandler) {
            ruleNumberInput.removeEventListener('input', ruleNumberInput._currentHandler);
        }
        ruleNumberInput.addEventListener('input', newHandler);
        ruleNumberInput._currentHandler = newHandler;

        const keydownHandler = function(e) {
            if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 || 
                (e.keyCode === 65 && e.ctrlKey === true) || 
                (e.keyCode === 67 && e.ctrlKey === true) || 
                (e.keyCode === 86 && e.ctrlKey === true) || 
                (e.keyCode === 88 && e.ctrlKey === true) || 
                (e.keyCode >= 35 && e.keyCode <= 39)) {
                return;
            }
            
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                e.preventDefault();
            }
        };

        if (ruleNumberInput._currentKeydownHandler) {
            ruleNumberInput.removeEventListener('keydown', ruleNumberInput._currentKeydownHandler);
        }
        ruleNumberInput.addEventListener('keydown', keydownHandler);
        ruleNumberInput._currentKeydownHandler = keydownHandler;
    }

    function validateRuleNumber(num, isEditing = false) {
        const maxAllowed = isEditing ? window.totalRules : (window.totalRules || 0) + 1;
        
        if (num > maxAllowed) {
            ruleNumberError.style.display = 'block';
            if (isEditing) {
                ruleNumberError.innerText = `In edit mode, rule number cannot be greater than ${window.totalRules}`;
            } else {
                ruleNumberError.innerText = `In add mode, rule number cannot be greater than ${(window.totalRules || 0) + 1}`;
            }
            return false;
        } else if (num < 1) {
            ruleNumberError.style.display = 'block';
            ruleNumberError.innerText = `Rule number must be at least 1`;
            return false;
        }
        
        ruleNumberError.style.display = 'none';
        return true;
    }

    async function saveRule() {
        try {
            const formData = new FormData(ruleForm);
            const ruleData = Object.fromEntries(formData.entries());
            
            // Validate required fields
            if (!ruleData.RULE_NAME || !ruleData.REPLY_TEXT) {
                window.showToast('Please fill in all required fields', 'warning');
                return;
            }

            // Validate rule number
            const ruleNumber = parseInt(ruleData.RULE_NUMBER);
            if (!validateRuleNumber(ruleNumber, false)) {
                return;
            }

            console.log('💾 Saving new rule:', ruleData);

            const response = await fetch('/api/rules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(ruleData)
            });

            const result = await response.json();

            if (result.success) {
                window.showToast('Rule added successfully!', 'success');
                ruleModal.hide();
                
                // Refresh rules list
                await window.fetchRules();
                
                console.log('✅ Rule added successfully');
            } else {
                window.showToast(result.message || 'Failed to add rule', 'fail');
                console.error('❌ Failed to add rule:', result);
            }
        } catch (error) {
            console.error('❌ Error saving rule:', error);
            window.showToast('Error saving rule: ' + error.message, 'fail');
        }
    }

    function configureModalButtons(modalType, mode) {
        const deleteBtn = document.getElementById('deleteRuleBtn');
        const buttonContainer = document.querySelector('#ruleModal .modal-footer');
        
        if (!deleteBtn || !buttonContainer) {
            console.error('Modal elements not found:', modalType);
            return;
        }

        console.log(`🔧 Configuring ${modalType} modal for ${mode} mode`);

        if (mode === 'add') {
            deleteBtn.style.display = 'none';
            deleteBtn.style.visibility = 'hidden';
            deleteBtn.classList.add('d-none');
            console.log('🚫 Delete button hidden for add mode');
        } else if (mode === 'edit') {
            deleteBtn.style.display = 'inline-flex';
            deleteBtn.style.visibility = 'visible';
            deleteBtn.classList.remove('d-none');
            console.log('👁️ Delete button shown for edit mode');
        }

        const allButtons = buttonContainer.querySelectorAll('.btn');
        allButtons.forEach(btn => {
            btn.style.display = btn === deleteBtn && mode === 'add' ? 'none' : 'inline-flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.minWidth = '100px';
            btn.style.minHeight = '38px';
            btn.style.padding = '0.625rem 1.25rem';
            btn.style.lineHeight = '1.5';
            btn.style.whiteSpace = 'nowrap';
            btn.style.verticalAlign = 'middle';
            btn.style.marginLeft = '0';
        });

        console.log(`✅ ${modalType} modal configured successfully for ${mode} mode`);
    }

    // Make functions globally available if needed
    window.openAddRuleModal = openAddRuleModal;
    window.toggleFormFields = toggleFormFields;
    window.toggleTargetUsersField = toggleTargetUsersField;
    window.setupRuleNumberValidation = setupRuleNumberValidation;
    window.validateRuleNumber = validateRuleNumber;
    window.configureModalButtons = configureModalButtons;

})();
