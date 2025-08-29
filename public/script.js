document.addEventListener("DOMContentLoaded", () => {
  const rulesList = document.getElementById("rulesList");
  const addRuleBtn = document.getElementById("addRuleBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const ruleModal = new bootstrap.Modal(document.getElementById("ruleModal"));
  const settingsModal = new bootstrap.Modal(document.getElementById("settingsModal"));
  const variableModal = new bootstrap.Modal(document.getElementById("variableModal"));
  const ruleForm = document.getElementById("ruleForm");
  const variableForm = document.getElementById("variableForm");
  const formTitle = document.getElementById("formTitle");
  const deleteRuleBtn = document.getElementById("deleteRuleBtn");
  const loadingMessage = document.getElementById("loadingMessage");
  const ruleTypeSelect = document.getElementById('ruleType');
  const keywordsField = document.getElementById('keywordsField');
  const repliesTypeField = document.getElementById('repliesTypeField');
  const replyTextField = document.getElementById('replyTextField');
  const targetUsersToggle = document.getElementById('targetUsersToggle');
  const targetUsersField = document.getElementById('targetUsersField');
  const ruleNumberInput = document.getElementById('ruleNumber');
  const ruleNumberError = document.getElementById('ruleNumberError');
  const variablesList = document.getElementById('variablesList');
  const addVariableBtn = document.getElementById('addVariableBtn');
  const deleteVariableBtn = document.getElementById('deleteVariableBtn');
  const variableFormContainer = document.getElementById('variableFormContainer');
  const variablesMenuBtn = document.getElementById('variablesMenuBtn');
  const backToSettingsBtn = document.getElementById('backToSettingsBtn');
  const toastLiveExample = document.getElementById('liveToast');
  const toastBody = document.querySelector('#liveToast .toast-body');
  const toast = new bootstrap.Toast(toastLiveExample);
  let currentRuleNumber = null;
  let currentVariableName = null;
  let totalRules = 0;

  function showToast(message, type = 'success') {
    toastBody.innerText = message;
    toastLiveExample.classList.remove('success', 'fail');
    toastLiveExample.classList.add(type);
    toast.show();
  }

  function validateRuleNumber(num) {
      if (num > totalRules + 1) {
          ruleNumberError.style.display = 'block';
          ruleNumberError.innerText = `Rule number cannot be greater than ${totalRules + 1}`;
          return false;
      }
      ruleNumberError.style.display = 'none';
      return true;
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
    if (!currentRuleNumber) {
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

  async function fetchRules() {
    loadingMessage.style.display = 'block';
    rulesList.innerHTML = '';
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      totalRules = data.length;
      loadingMessage.style.display = 'none';
      if (data.length === 0) {
        rulesList.innerHTML = '<p class="text-center text-muted mt-5">No rules found. Add one!</p>';
      } else {
        renderRules(data);
      }
    } catch (error) {
      loadingMessage.innerText = 'Failed to load rules.';
      showToast("Failed to fetch rules.", "fail");
    }
  }

  function renderRules(rules) {
    rules.forEach(rule => {
      const item = document.createElement("div");
      item.className = "rule-item";
      item.innerHTML = `
        <div class="rule-item-header">
          <h5>Rule #${rule.RULE_NUMBER} - ${rule.RULE_NAME || 'Unnamed Rule'}</h5>
        </div>
        <div class="rule-preview">
          <p class="mb-1 preview-text">Keywords: ${rule.KEYWORDS === 'ALL' ? '*' : (rule.KEYWORDS || '').split('//').slice(0, 3).join(', ')}</p>
          <p class="mb-0 preview-text">Reply: ${rule.REPLY_TEXT.split('<#>').slice(0, 1)}</p>
        </div>
      `;
      item.addEventListener('click', () => editRule(rule));
      rulesList.appendChild(item);
    });
  }

  function setupAddForm() {
    ruleForm.reset();
    formTitle.innerText = "Add New Rule";
    deleteRuleBtn.style.display = 'none';
    currentRuleNumber = null;
    document.getElementById('ruleNumber').value = totalRules + 1;
    toggleFormFields(ruleTypeSelect.value);
    toggleTargetUsersField();
    ruleModal.show();
  }

  function editRule(rule) {
    currentRuleNumber = rule.RULE_NUMBER;
    formTitle.innerText = `Edit Rule #${rule.RULE_NUMBER}`;
    document.getElementById('ruleName').value = rule.RULE_NAME || '';
    document.getElementById('ruleNumber').value = rule.RULE_NUMBER;
    document.getElementById('ruleType').value = rule.RULE_TYPE;
    document.getElementById('keywords').value = rule.KEYWORDS || '';
    document.getElementById('repliesType').value = rule.REPLIES_TYPE;
    document.getElementById('replyText').value = rule.REPLY_TEXT;
    
    if (Array.isArray(rule.TARGET_USERS)) {
      if (rule.RULE_TYPE === "IGNORED") {
        targetUsersToggle.value = 'IGNORED';
      } else {
        targetUsersToggle.value = 'TARGET';
      }
      document.getElementById('targetUsers').value = rule.TARGET_USERS.join(',');
    } else {
      targetUsersToggle.value = 'ALL';
      document.getElementById('targetUsers').value = '';
    }
    
    deleteRuleBtn.style.display = 'block';
    toggleFormFields(rule.RULE_TYPE);
    toggleTargetUsersField();
    ruleModal.show();
  }

  // --- Variable Functions ---
  async function fetchVariables() {
    variablesList.innerHTML = '<p class="text-muted text-center">Loading variables...</p>';
    const res = await fetch('/api/variables');
    const data = await res.json();
    variablesList.innerHTML = '';
    if (data.length === 0) {
      variablesList.innerHTML = '<p class="text-muted text-center">No variables found.</p>';
    } else {
      renderVariables(data);
    }
  }

  function renderVariables(variables) {
    variables.forEach(variable => {
      const item = document.createElement('div');
      item.className = 'list-group-item d-flex justify-content-between align-items-center bg-dark text-white-50';
      item.innerHTML = `
        <span><strong>%${variable.name}%</strong>: ${variable.value}</span>
        <button class="btn btn-sm btn-outline-secondary" data-name="${variable.name}"><i class="bi bi-pencil"></i></button>
      `;
      item.querySelector('button').addEventListener('click', () => editVariable(variable));
      variablesList.appendChild(item);
    });
  }

  function setupAddVariableForm() {
    variableForm.reset();
    document.getElementById('variableFormTitle').innerText = 'Add New Variable';
    deleteVariableBtn.style.display = 'none';
    currentVariableName = null;
    variableFormContainer.style.display = 'block';
  }

  function editVariable(variable) {
    currentVariableName = variable.name;
    document.getElementById('variableFormTitle').innerText = `Edit Variable: %${variable.name}%`;
    document.getElementById('variableName').value = variable.name;
    document.getElementById('variableValue').value = variable.value;
    deleteVariableBtn.style.display = 'block';
    variableFormContainer.style.display = 'block';
  }

  addRuleBtn.addEventListener('click', () => setupAddForm());
  settingsBtn.addEventListener('click', () => settingsModal.show());
  variablesMenuBtn.addEventListener('click', () => {
    settingsModal.hide();
    variableModal.show();
    fetchVariables();
  });
  backToSettingsBtn.addEventListener('click', () => {
    variableModal.hide();
    settingsModal.show();
  });
  ruleTypeSelect.addEventListener('change', (e) => toggleFormFields(e.target.value));
  targetUsersToggle.addEventListener('change', () => toggleTargetUsersField());
  ruleNumberInput.addEventListener('input', (e) => validateRuleNumber(parseInt(e.target.value)));

  ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newRuleNumber = parseInt(ruleNumberInput.value);
    if (!validateRuleNumber(newRuleNumber)) {
        return;
    }

    const formData = new FormData(ruleForm);
    const ruleData = Object.fromEntries(formData.entries());
    
    ruleData.ruleNumber = newRuleNumber;

    if (ruleData.repliesType !== 'ALL') {
        const replies = ruleData.replyText.split('<#>').filter(Boolean);
        ruleData.replyText = replies.join('<#>');
    }

    if (targetUsersToggle.value === 'TARGET' || targetUsersToggle.value === 'IGNORED') {
      ruleData.targetUsers = ruleData.targetUsers.split(',').map(id => id.trim());
    } else {
      ruleData.targetUsers = "ALL";
    }
    
    if (targetUsersToggle.value === 'IGNORED') {
        ruleData.ruleType = 'IGNORED';
    }

    const payload = {
      type: currentRuleNumber ? 'edit' : 'add',
      rule: ruleData,
      oldRuleNumber: currentRuleNumber
    };
    
    const res = await fetch('/api/rules/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.success) {
      showToast("Rule saved successfully!");
      ruleModal.hide();
      fetchRules();
    } else {
      showToast("Error saving rule: " + result.message, 'fail');
    }
  });

  deleteRuleBtn.addEventListener('click', async () => {
    const isConfirmed = confirm(`Are you sure you want to delete Rule #${currentRuleNumber}?`);
    if (isConfirmed) {
      const payload = {
        type: 'delete',
        rule: { ruleNumber: currentRuleNumber }
      };
      const res = await fetch('/api/rules/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        showToast("Rule deleted successfully!");
        ruleModal.hide();
        fetchRules();
      } else {
        showToast("Error deleting rule: " + result.message, 'fail');
      }
    }
  });

  addVariableBtn.addEventListener('click', setupAddVariableForm);
  variableForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(variableForm);
    const variableData = Object.fromEntries(formData.entries());
    const payload = {
      type: currentVariableName ? 'edit' : 'add',
      variable: variableData,
      oldName: currentVariableName
    };

    const res = await fetch('/api/variables/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.success) {
      showToast("Variable saved successfully!");
      variableFormContainer.style.display = 'none';
      fetchVariables();
    } else {
      showToast("Error saving variable: " + result.message, 'fail');
    }
  });

  deleteVariableBtn.addEventListener('click', async () => {
    const isConfirmed = confirm(`Are you sure you want to delete variable %${currentVariableName}%?`);
    if (isConfirmed) {
      const payload = {
        type: 'delete',
        variable: { name: currentVariableName }
      };
      const res = await fetch('/api/variables/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        showToast("Variable deleted successfully!");
        variableFormContainer.style.display = 'none';
        fetchVariables();
      } else {
        showToast("Error deleting variable: " + result.message, 'fail');
      }
    }
  });

  fetchRules();
});
