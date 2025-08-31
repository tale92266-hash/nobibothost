const VariablesModule = {
    allVariables: [],
    currentVariableName: null,

    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Add variable button
        const addVariableBtn = document.getElementById('addVariableBtn');
        if (addVariableBtn) {
            addVariableBtn.addEventListener('click', () => {
                this.openAddVariableModal();
            });
        }

        // Variable form submission
        const variableForm = document.getElementById('variableForm');
        if (variableForm) {
            variableForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleVariableSubmit();
            });
        }

        // Delete variable button
        const deleteVariableBtn = document.getElementById('deleteVariableBtn');
        if (deleteVariableBtn) {
            deleteVariableBtn.addEventListener('click', () => {
                this.handleDeleteVariable();
            });
        }
    },

    setAllVariables(variables) {
        this.allVariables = variables;
    },

    getAllVariables() {
        return this.allVariables;
    },

    renderVariablesList(variables) {
        const variablesList = document.getElementById('variablesList');
        if (!variablesList) return;

        variablesList.innerHTML = '';

        if (variables.length === 0) {
            variablesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-code fa-3x"></i>
                    <h6>No Variables Found</h6>
                    <p>Create variables to use dynamic content in your rules.</p>
                </div>
            `;
            return;
        }

        variables.forEach(variable => {
            const variableElement = this.createVariableElement(variable);
            variablesList.appendChild(variableElement);
        });
    },

    createVariableElement(variable) {
        const variableDiv = document.createElement('div');
        variableDiv.className = 'variable-item';
        
        variableDiv.innerHTML = `
            <div class="variable-header">
                <span class="variable-name">%${variable.name}%</span>
            </div>
            <div class="variable-value">${variable.value || 'No value set'}</div>
        `;
        
        // Add click event
        variableDiv.addEventListener('click', () => {
            this.openEditVariableModal(variable);
        });
        
        return variableDiv;
    },

    openAddVariableModal() {
        this.currentVariableName = null;
        this.resetVariableForm();
        this.showVariableForm('Add New Variable');
        UIModule.configureModalButtons('variable', 'add');
    },

    openEditVariableModal(variable) {
        this.currentVariableName = variable.name;
        this.populateVariableForm(variable);
        this.showVariableForm('Edit Variable');
        UIModule.configureModalButtons('variable', 'edit');
    },

    showVariableForm(title) {
        const variableFormContainer = document.getElementById('variableFormContainer');
        const variableModal = UIModule.getVariableModal();
        
        if (variableFormContainer) {
            variableFormContainer.querySelector('h5').textContent = title;
            variableFormContainer.style.display = 'block';
        }
        
        if (variableModal) {
            variableModal.show();
        }
    },

    resetVariableForm() {
        const form = document.getElementById('variableForm');
        if (form) form.reset();
    },

    populateVariableForm(variable) {
        const nameField = document.getElementById('variableName');
        const valueField = document.getElementById('variableValue');
        
        if (nameField) nameField.value = variable.name || '';
        if (valueField) valueField.value = variable.value || '';
    },

    async handleVariableSubmit() {
        const formData = this.collectVariableFormData();
        
        if (!ValidationModule.validateVariableForm(formData)) {
            return;
        }
        
        const isEdit = this.currentVariableName !== null;
        const type = isEdit ? 'edit' : 'add';
        const oldName = isEdit ? this.currentVariableName : null;
        
        const success = await APIModule.updateVariable(type, formData, oldName);
        
        if (success) {
            UIModule.getVariableModal().hide();
        }
    },

    collectVariableFormData() {
        const getValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value.trim() : '';
        };
        
        return {
            name: getValue('variableName'),
            value: getValue('variableValue')
        };
    },

    async handleDeleteVariable() {
        if (this.currentVariableName === null) return;
        
        if (!confirm('Are you sure you want to delete this variable?')) {
            return;
        }
        
        const variable = { name: this.currentVariableName };
        const success = await APIModule.updateVariable('delete', variable);
        
        if (success) {
            UIModule.getVariableModal().hide();
        }
    }
};
