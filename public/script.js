document.addEventListener("DOMContentLoaded", () => {
  const rulesList = document.getElementById("rulesList");
  const addRuleBtn = document.getElementById("addRuleBtn");
  const ruleModal = new bootstrap.Modal(document.getElementById("ruleModal"));
  const ruleForm = document.getElementById("ruleForm");
  const formTitle = document.getElementById("formTitle");
  const deleteRuleBtn = document.getElementById("deleteRuleBtn");
  const loadingMessage = document.getElementById("loadingMessage");
  const ruleTypeSelect = document.getElementById('ruleType');
  const keywordsField = document.getElementById('keywordsField');
  const repliesTypeField = document.getElementById('repliesTypeField');
  const replyTextField = document.getElementById('replyTextField');
  const targetUsersToggle = document.getElementById('targetUsersToggle');
  const targetUsersField = document.getElementById('targetUsersField');
  const toastLiveExample = document.getElementById('liveToast');
  const toastBody = document.querySelector('#liveToast .toast-body');
  const toast = new bootstrap.Toast(toastLiveExample);
  let currentRuleNumber = null;

  function showToast(message, type = 'success') {
    toastBody.innerText = message;
    toastLiveExample.classList.remove('success', 'fail');
    toastLiveExample.classList.add(type);
    toast.show();
  }

  function toggleFormFields(ruleType) {
    if (ruleType === 'WELCOME' || ruleType === 'DEFAULT') {
      keywordsField.style.display = 'none';
      repliesTypeField.style.display = 'none';
      replyTextField.style.display = 'block';
      targetUsersToggle.closest('.mb-3').style.display = 'none';
      document.getElementById('keywords').value = "ALL";
    } else {
      keywordsField.style.display = 'block';
      repliesTypeField.style.display = 'block';
      replyTextField.style.display = 'block';
      targetUsersToggle.closest('.mb-3').style.display = 'block';
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
    fetch('/api/rules')
      .then(res => res.json())
      .then(rules => {
        const lastRuleNumber = rules.length > 0 ? rules[rules.length - 1].RULE_NUMBER : 0;
        document.getElementById('ruleNumber').value = lastRuleNumber + 1;
      });
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
      // Check if it's an IGNORED rule
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

  addRuleBtn.addEventListener('click', () => setupAddForm());
  ruleTypeSelect.addEventListener('change', (e) => toggleFormFields(e.target.value));
  targetUsersToggle.addEventListener('change', () => toggleTargetUsersField());

  ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(ruleForm);
    const ruleData = Object.fromEntries(formData.entries());
    
    ruleData.ruleNumber = parseInt(ruleData.ruleNumber);
    ruleData.oldRuleNumber = currentRuleNumber;

    if (ruleData.repliesType !== 'ALL') {
        const replies = ruleData.replyText.split('<#>').filter(Boolean);
        ruleData.replyText = replies.join('<#>');
    }

    if (targetUsersToggle.value === 'TARGET' || targetUsersToggle.value === 'IGNORED') {
      ruleData.targetUsers = ruleData.targetUsers.split(',').map(id => id.trim());
    } else {
      ruleData.targetUsers = "ALL";
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

  fetchRules();
});
