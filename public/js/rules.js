const RulesModule = {
    allRules: [],
    totalRules: 0,
    currentRuleNumber: null,

    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Add rule button
        const addRuleBtn = document.getElementById('addRuleBtn');
        if (addRuleBtn) {
            addRuleBtn.addEventListener('click', () => {
                this.openAddRuleModal();
            });
        }

        // Rule form submission
        const ruleForm = document.getElementById('ruleForm');
        if (ruleForm) {
            ruleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRuleSubmit();
            });
        }

        // Rule type change
        const ruleTypeSelect = document.getElementById('ruleType');
        if (ruleTypeSelect) {
            ruleTypeSelect.addEventListener('change', (e) => {
                UIModule.toggleFormFields(e.target.value);
            });
        }

        // Target users toggle
        const targetUsersToggle = document.getElementById('targetUsersToggle');
        if (targetUsersToggle) {
            targetUsersToggle.addEventListener('change', () => {
                UIModule.toggleTargetUsersField();
            });
        }

        // Delete rule button
        const deleteRuleBtn = document.getElementById('deleteRuleBtn');
        if (deleteRuleBtn) {
            deleteRuleBtn.addEventListener('click', () => {
                this.handleDeleteRule();
            });
        }

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleRuleSearch(e.target.value);
            });
        }
    },

    setAllRules(rules) {
        this.allRules = rules;
    },

    getAllRules() {
        return this.allRules;
    },

    setTotalRules(count) {
        this.totalRules = count;
    },

    getTotalRules() {
        return this.totalRules;
    },

    renderRulesList(rules) {
        const rulesList = document.getElementById('rulesList');
        if (!rulesList) return;

        rulesList.innerHTML = '';
        
        rules.forEach(rule => {
            const ruleElement = this.createRuleElement(rule);
            rulesList.appendChild(ruleElement);
        });
    },

    createRuleElement(rule) {
        const ruleDiv = document.createElement('div');
        ruleDiv.className = 'rule-item';
        ruleDiv.setAttribute('data-rule-number', rule.RULE_NUMBER);
        
        // Format target users display
        let targetUsersDisplay = 'ALL';
        if (Array.isArray(rule.TARGET_USERS) && rule.TARGET_USERS.length > 0) {
            targetUsersDisplay = rule.TARGET_USERS.join(', ');
        }
        
        ruleDiv.innerHTML = `
            <div class="rule-header-new">
                <div class="rule-title">
                    <span class="rule-number-new">${rule.RULE_NUMBER}</span>
                    <span class="rule-name-new">${rule.RULE_NAME || 'Unnamed Rule'}</span>
                </div>
                <span class="rule-type type-${rule.RULE_TYPE.toLowerCase()}">${rule.RULE_TYPE}</span>
            </div>
            <div class="rule-content-new">
                ${rule.RULE_TYPE !== 'WELCOME' && rule.RULE_TYPE !== 'DEFAULT' ? 
                    `<div class="rule-line">
                        <strong>Keywords:</strong> <span>${rule.KEYWORDS || 'N/A'}</span>
                    </div>` : ''
                }
                <div class="rule-line">
                    <strong>Reply Type:</strong> <span>${rule.REPLIES_TYPE || 'RANDOM'}</span>
                </div>
                <div class="rule-line">
                    <strong>Target:</strong> <span>${targetUsersDisplay}</span>
                </div>
                <div class="rule-reply">
                    <strong>Reply:</strong>
                    <div class="reply-text">${rule.REPLY_TEXT || 'No reply set'}</div>
                </div>
            </div>
        `;
        
        // Add click event
        ruleDiv.addEventListener('click', () => {
            this.openEditRuleModal(rule);
        });
        
        return ruleDiv;
    },

    openAddRuleModal() {
        const modal = UIModule.getRuleModal();
        const formTitle = document.getElementById('formTitle');
        
        if (formTitle) formTitle.textContent = 'Add New Rule';
        
        this.currentRuleNumber = null;
        this.resetRuleForm();
        
        UIModule.configureModalButtons('rule', 'add');
        ValidationModule.setupRuleNumberValidation(false);
        
        modal.show();
    },

    openEditRuleModal(rule) {
        const modal = UIModule.getRuleModal();
        const formTitle = document.getElementById('formTitle');
        
        if (formTitle) formTitle.textContent = 'Edit Rule';
        
        this.currentRuleNumber = rule.RULE_NUMBER;
        this.populateRuleForm(rule);
        
        UIModule.configureModalButtons('rule', 'edit');
        ValidationModule.setupRuleNumberValidation(true);
        
        modal.show();
    },

    resetRuleForm() {
        const form = document.getElementById('ruleForm');
        if (form) form.reset();
        
        // Set default values
        const ruleNumber = document.getElementById('ruleNumber');
        const repliesType = document.getElementById('repliesType');
        const targetUsersToggle = document.getElementById('targetUsersToggle');
        
        if (ruleNumber) ruleNumber.value = this.totalRules + 1;
        if (repliesType) repliesType.value = 'RANDOM';
        if (targetUsersToggle) targetUsersToggle.value = 'ALL';
        
        UIModule.toggleFormFields('EXACT');
        UIModule.toggleTargetUsersField();
    },

    populateRuleForm(rule) {
        const fields = {
            'ruleNumber': rule.RULE_NUMBER,
            'ruleName': rule.RULE_NAME || '',
            'ruleType': rule.RULE_TYPE,
            'keywords': rule.KEYWORDS || '',
            'repliesType': rule.REPLIES_TYPE || 'RANDOM',
            'replyText': rule.REPLY_TEXT || '',
            'targetUsersToggle': Array.isArray(rule.TARGET_USERS) ? 'TARGET' : 'ALL',
            'targetUsers': Array.isArray(rule.TARGET_USERS) ? rule.TARGET_USERS.join(', ') : 'ALL'
        };
        
        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) field.value = value;
        });
        
        UIModule.toggleFormFields(rule.RULE_TYPE);
        UIModule.toggleTargetUsersField();
    },

    async handleRuleSubmit() {
        const formData = this.collectRuleFormData();
        
        if (!ValidationModule.validateRuleForm(formData)) {
            return;
        }
        
        const isEdit = this.currentRuleNumber !== null;
        const type = isEdit ? 'edit' : 'add';
        const oldRuleNumber = isEdit ? this.currentRuleNumber : null;
        
        const success = await APIModule.updateRule(type, formData, oldRuleNumber);
        
        if (success) {
            UIModule.getRuleModal().hide();
        }
    },

    collectRuleFormData() {
        const getValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value.trim() : '';
        };
        
        return {
            ruleNumber: parseInt(getValue('ruleNumber')),
            ruleName: getValue('ruleName'),
            ruleType: getValue('ruleType'),
            keywords: getValue('keywords'),
            repliesType: getValue('repliesType'),
            replyText: getValue('replyText'),
            targetUsers: getValue('targetUsersToggle') === 'TARGET' 
                ? getValue('targetUsers').split(',').map(u => u.trim()).filter(u => u) 
                : 'ALL'
        };
    },

    async handleDeleteRule() {
        if (this.currentRuleNumber === null) return;
        
        if (!confirm('Are you sure you want to delete this rule?')) {
            return;
        }
        
        const rule = { ruleNumber: this.currentRuleNumber };
        const success = await APIModule.updateRule('delete', rule);
        
        if (success) {
            UIModule.getRuleModal().hide();
        }
    },

    handleRuleSearch(searchTerm) {
        const ruleItems = document.querySelectorAll('.rule-item');
        const rulesList = document.getElementById('rulesList');
        
        if (!searchTerm.trim()) {
            ruleItems.forEach(item => item.style.display = 'block');
            return;
        }
        
        let visibleCount = 0;
        
        ruleItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            const matches = text.includes(searchTerm.toLowerCase());
            
            item.style.display = matches ? 'block' : 'none';
            if (matches) visibleCount++;
        });
        
        // Show no results message if needed
        if (visibleCount === 0 && rulesList) {
            const existingNoResults = rulesList.querySelector('.no-results');
            if (!existingNoResults) {
                const noResultsDiv = document.createElement('div');
                noResultsDiv.className = 'empty-state no-results';
                noResultsDiv.innerHTML = `
                    <i class="fas fa-search fa-3x"></i>
                    <h5>No Results Found</h5>
                    <p>No rules match your search term "${searchTerm}"</p>
                `;
                rulesList.appendChild(noResultsDiv);
            }
        } else {
            const existingNoResults = rulesList.querySelector('.no-results');
            if (existingNoResults) {
                existingNoResults.remove();
            }
        }
    },

    // Rule reordering functionality
    reorderRulesArray(rules, oldRuleNumber, newRuleNumber) {
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
        
        const newRules = [...rules];
        const [movingRule] = newRules.splice(fromIndex, 1);
        newRules.splice(toIndex, 0, movingRule);
        
        const finalRules = newRules.map((rule, index) => ({
            ...rule,
            RULE_NUMBER: index + 1
        }));
        
        console.log('✅ New rule order:', finalRules.map(r => `#${r.RULE_NUMBER}: ${r.RULE_NAME || 'Unnamed'}`));
        
        return finalRules;
    }
};
