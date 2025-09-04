// file: public/variables.js

import { fetchVariablesApi, updateVariableApi } from './api.js';
import { showToast, configureModalButtons } from './ui.js';

let currentVariableName = null;
let allVariables = [];

const variableModal = new bootstrap.Modal(document.getElementById("variableModal"));
const variablesList = document.getElementById('variablesList');
const variableForm = document.getElementById('variableForm');

/**
 * Initializes variables management and sets up event listeners.
 */
export function initVariables() {
    document.getElementById('addVariableBtn')?.addEventListener('click', addNewVariable);
    document.getElementById('saveVariableBtn')?.addEventListener('click', saveVariable);
    document.getElementById('deleteVariableBtn')?.addEventListener('click', deleteVariable);
    
    const variablesSearchInput = document.getElementById('searchVariables');
    if (variablesSearchInput) {
        variablesSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredVariables = allVariables.filter(variable =>
                (variable.name || '').toLowerCase().includes(searchTerm) ||
                (variable.value || '').toLowerCase().includes(searchTerm)
            );
            displayVariables(filteredVariables);
        });
    }
}

/**
 * Fetches all variables from the server and displays them.
 */
export async function fetchVariables() {
    try {
        const data = await fetchVariablesApi();
        allVariables = data;
        displayVariables(data);
    } catch (error) {
        variablesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-3x"></i>
                <h6>Error Loading Variables</h6>
                <p>Please try refreshing the page</p>
            </div>
        `;
    }
}

/**
 * Displays a list of variables.
 * @param {Array<object>} variables - The array of variables.
 */
function displayVariables(variables) {
    if (!variablesList) return;
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

/**
 * Creates a single variable DOM element.
 * @param {object} variable - The variable object.
 * @returns {HTMLElement} The created variable element.
 */
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

/**
 * Opens the modal to edit an existing variable.
 * @param {object} variable - The variable object to edit.
 */
function editVariable(variable) {
    currentVariableName = variable.name;
    document.getElementById('variableName').value = variable.name;
    document.getElementById('variableValue').value = variable.value;
    configureModalButtons('variable', 'edit');
    variableModal.show();
}

/**
 * Opens the modal to add a new variable.
 */
function addNewVariable() {
    currentVariableName = null;
    variableForm.reset();
    configureModalButtons('variable', 'add');
    variableModal.show();
}

/**
 * Saves or updates a variable.
 */
async function saveVariable() {
    const name = document.getElementById('variableName').value.trim();
    const value = document.getElementById('variableValue').value.trim();
    if (!name || !value) {
        showToast('Please fill all required fields', 'warning');
        return;
    }
    try {
        const isEditing = currentVariableName !== null;
        const payload = {
            type: isEditing ? 'edit' : 'add',
            variable: { name, value },
            oldName: currentVariableName
        };
        const result = await updateVariableApi(payload);
        showToast(result.message || 'Variable saved successfully!', 'success');
        variableModal.hide();
        await fetchVariables();
        currentVariableName = null;
    } catch (error) {
        showToast('Failed to save variable: ' + error.message, 'fail');
    }
}

/**
 * Deletes an existing variable.
 */
async function deleteVariable() {
    if (currentVariableName === null) return;
    if (!confirm('Are you sure you want to delete this variable?')) return;
    try {
        const payload = {
            type: 'delete',
            variable: { name: currentVariableName }
        };
        const result = await updateVariableApi(payload);
        showToast(result.message || 'Variable deleted successfully!', 'success');
        variableModal.hide();
        await fetchVariables();
        currentVariableName = null;
    } catch (error) {
        showToast('Failed to delete variable: ' + error.message, 'fail');
    }
}
