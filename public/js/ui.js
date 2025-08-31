const UIModule = {
    ruleModal: null,
    variableModal: null,
    toast: null,

    init() {
        // Initialize Bootstrap components
        this.ruleModal = new bootstrap.Modal(document.getElementById('ruleModal'));
        this.variableModal = new bootstrap.Modal(document.getElementById('variableModal'));
        
        const toastElement = document.getElementById('liveToast');
        if (toastElement) {
            this.toast = new bootstrap.Toast(toastElement);
        }
    },

    getRuleModal() {
        return this.ruleModal;
    },

    getVariableModal() {
        return this.variableModal;
    },

    showToast(message, type = 'success') {
        const toastElement = document.getElementById('liveToast');
        const toastBody = toastElement.querySelector('.toast-body');
        
        toastBody.textContent = message;
        
        toastElement.classList.remove('success', 'fail', 'warning');
        toastElement.classList.add(type);
        
        const toastInstance = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 4000
        });
        
        toastInstance.show();
    },

    toggleFormFields(ruleType) {
        const keywordsField = document.getElementById('keywordsField');
        const repliesTypeField = document.getElementById('repliesTypeField');
        const replyTextField = document.getElementById('replyTextField');
        
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
    },

    toggleTargetUsersField() {
        const targetUsersToggle = document.getElementById('targetUsersToggle');
        const targetUsersField = document.getElementById('targetUsersField');
        
        const isTargetOrIgnored = targetUsersToggle.value === 'TARGET' || targetUsersToggle.value === 'IGNORED';
        targetUsersField.style.display = isTargetOrIgnored ? 'block' : 'none';
        
        if (!isTargetOrIgnored) {
            document.getElementById('targetUsers').value = "ALL";
        }
    },

    configureModalButtons(modalType, mode) {
        let deleteBtn, buttonContainer;
        
        if (modalType === 'rule') {
            deleteBtn = document.getElementById('deleteRuleBtn');
            buttonContainer = document.querySelector('#ruleModal .modal-footer');
        } else if (modalType === 'variable') {
            deleteBtn = document.getElementById('deleteVariableBtn');
            buttonContainer = document.querySelector('.form-actions');
        }
        
        if (!deleteBtn || !buttonContainer) {
            console.error('Modal elements not found:', modalType);
            return;
        }
        
        console.log(`🔧 Configuring ${modalType} modal for ${mode} mode`);
        
        // Handle delete button visibility
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
        
        // Apply consistent styling to all buttons
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
};
