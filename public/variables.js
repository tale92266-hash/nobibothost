// file: public/variables.js

import { showToast } from './script.js';

// DOM Elements
const variablesList = document.getElementById('variablesList');
const addVariableBtn = document.getElementById('addVariableBtn');
const variableModal = new bootstrap.Modal(document.getElementById("variableModal"));
const deleteVariableBtn = document.getElementById('deleteVariableBtn');
const variableForm = document.getElementById('variableForm');
const variableNameInput = document.getElementById('variableName');
const variableValueInput = document.getElementById('variableValue');
const saveVariableBtn = document.getElementById('saveVariableBtn');
const searchVariablesInput = document.getElementById('searchVariables');


// Variables
let currentVariableName = null;
let allVariables = [];

// Helper function to handle DOM elements, as we can't directly use them here.
export function initVariableDom(modal, form, delBtn) {
    // This function can be used to pass elements from script.js if needed.
    // For now, we will assume the elements are already in the DOM.
}

// Function to handle showing/hiding delete button
function configureModalButtons(mode) {
    const deleteBtn = document.getElementById('deleteVariableBtn');
    const saveBtn = document.getElementById('saveVariableBtn');
    if (!deleteBtn || !saveBtn) return;
    if (mode === 'add') {
        deleteBtn.style.display = 'none';
    } else {
        deleteBtn.style.display = 'inline-flex';
    }
}


export async function fetchVariables() {
    try {
        const response = await fetch('/api/variables');
        const data = await response.json();
        allVariables = data;
        displayVariables(data);
    } catch (error) {
        console.error('Failed to fetch variables:', error);
        variablesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-3x"></i>
                <h6>Error Loading Variables</h6>
                <p>Please try refreshing the page</p>
            </div>
        `;
    }
}

export function displayVariables(variables) {
    if (variables.length === 0) {
        variablesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-plus-circle fa-3x"></i>
                <h6>No Variables Found</h6>
                <p>Create variables to use dynamic content in your rules.</p>
            </div>
        `;
        return;
    }
    variablesList.innerHTML = '';
    variables.forEach(variable => {
        const variableElement = createVariableElement(variable);
        variablesList.appendChild(variableElement);
    });
}

function createVariableElement(variable) {
    const variableDiv = document.createElement('div');
    variableDiv.className = 'variable-item';
    variableDiv.innerHTML = `
        <div class="variable-header">
            <span class="variable-name">%${variable.name}%</span>
        </div>
        <div class="variable-value">${variable.value.substring(0, 100)}${variable.value.length > 100 ? '...' : ''}</div>
    `;
    variableDiv.addEventListener('click', () => editVariable(variable));
    return variableDiv;
}

export function editVariable(variable) {
    currentVariableName = variable.name;
    variableNameInput.value = variable.name;
    variableValueInput.value = variable.value;
    configureModalButtons('edit');
    variableModal.show();
}

export function addNewVariable() {
    currentVariableName = null;
    variableNameInput.value = '';
    variableValueInput.value = '';
    configureModalButtons('add');
    variableModal.show();
}

export async function saveVariable() {
    const name = variableNameInput.value.trim();
    const value = variableValueInput.value.trim();
    if (!name || !value) {
        showToast('Please fill all required fields', 'warning');
        return;
    }
    try {
        const isEditing = currentVariableName !== null;
        const response = await fetch('/api/variables/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: isEditing ? 'edit' : 'add',
                variable: { name, value },
                oldName: currentVariableName
            })
        });
        const result = await response.json();
        if (result.success) {
            showToast(result.message || 'Variable saved successfully!', 'success');
            variableModal.hide();
            await fetchVariables();
            currentVariableName = null;
        } else {
            showToast(result.message || 'Failed to save variable', 'fail');
        }
    } catch (error) {
        console.error('Failed to save variable:', error);
        showToast('Network error: Failed to save variable', 'fail');
    }
}

export async function deleteVariable() {
    if (currentVariableName === null) return;
    if (!confirm('Are you sure you want to delete this variable?')) return;
    try {
        const response = await fetch('/api/variables/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'delete',
                variable: { name: currentVariableName }
            })
        });
        const result = await response.json();
        if (result.success) {
            showToast('Variable deleted successfully!', 'success');
            variableModal.hide();
            await fetchVariables();
            currentVariableName = null;
        } else {
            showToast(result.message || 'Failed to delete variable', 'fail');
        }
    } catch (error) {
        console.error('Failed to delete variable:', error);
        showToast('Network error: Failed to delete variable', 'fail');
    }
}

// Event Listeners for variables
if (addVariableBtn) {
    addVariableBtn.addEventListener('click', addNewVariable);
}

if (saveVariableBtn) {
    saveVariableBtn.addEventListener('click', (e) => {
        e.preventDefault();
        saveVariable();
    });
}

if (deleteVariableBtn) {
    deleteVariableBtn.addEventListener('click', deleteVariable);
}

if (searchVariablesInput) {
    searchVariablesInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredVariables = allVariables.filter(variable =>
            (variable.name || '').toLowerCase().includes(searchTerm) ||
            (variable.value || '').toLowerCase().includes(searchTerm)
        );
        displayVariables(filteredVariables);
    });
}
