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
  const targetUsersField = document.getElementById('targetUsersField');
  let currentRuleNumber = null;

  function toggleFormFields(ruleType) {
    keywordsField.style.display = 'block';
    repliesTypeField.style.display = 'block';
    replyTextField.style.display = 'block';
    targetUsersField.style.display = 'block';

    if (ruleType === 'WELCOME' || ruleType === 'DEFAULT') {
      keywordsField.style.display = 'none';
      repliesTypeField.style.display = 'block';
      replyTextField.style.display = 'block';
      targetUsersField.style.display = 'none';
    } else if (ruleType === 'IGNORED') {
      targetUsersField.style.display = 'block';
      keywordsField.style.display = 'block';
      repliesTypeField.style.display = 'block';
      replyTextField.style.display = 'block';
    } else {
        // For EXACT, PATTERN, EXPERT
        keywordsField.style.display = 'block';
        repliesTypeField.style.display = 'block';
        replyTextField.style.display = 'block';
        targetUsersField.style.display = 'block';
    }
  }

  async function fetchRules() {
    loadingMessage.style.display = 'block';
    rulesList.innerHTML = '';
    const res = await fetch('/api/rules');
    const data = await res.json();
    loadingMessage.style.display = 'none';
    if (data.length === 0) {
      rulesList.innerHTML = '<p class="text-center text-muted mt-5">No rules found. Add one!</p>';
    } else {
      renderRules(data);
    }
  }

  function renderRules(rules) {
    rules.forEach(rule => {
      const item = document.createElement("div");
      item.className = "rule-item";
      item.innerHTML = `
        <div class="rule-item-header">
          <h5>Rule #${rule.RULE_NUMBER} - ${rule.RULE_TYPE}</h5>
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
    ruleModal.show();
  }

  function editRule(rule) {
    currentRuleNumber = rule.RULE_NUMBER;
    formTitle.innerText = `Edit Rule #${rule.RULE_NUMBER}`;
    document.getElementById('ruleNumber').value = rule.RULE_NUMBER;
    document.getElementById('ruleType').value = rule.RULE_TYPE;
    document.getElementById('keywords').value = rule.KEYWORDS || '';
    document.getElementById('repliesType').value = rule.REPLIES_TYPE;
    document.getElementById('replyText').value = rule.REPLY_TEXT;
    document.getElementById('targetUsers').value = Array.isArray(rule.TARGET_USERS) ? rule.TARGET_USERS.join('//') : rule.TARGET_USERS || 'ALL';
    deleteRuleBtn.style.display = 'block';
    toggleFormFields(rule.RULE_TYPE);
    ruleModal.show();
  }

  addRuleBtn.addEventListener('click', () => setupAddForm());

  ruleTypeSelect.addEventListener('change', (e) => toggleFormFields(e.target.value));

  ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(ruleForm);
    const ruleData = Object.fromEntries(formData.entries());
    
    // Convert ruleNumber to integer
    ruleData.ruleNumber = parseInt(ruleData.ruleNumber);

    // Convert targetUsers to array if not "ALL"
    if (ruleData.targetUsers && ruleData.targetUsers !== 'ALL') {
      ruleData.targetUsers = ruleData.targetUsers.split('//').map(id => id.trim());
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
      alert("Rule saved successfully!");
      ruleModal.hide();
      fetchRules();
    } else {
      alert("Error saving rule: " + result.message);
    }
  });

  deleteRuleBtn.addEventListener('click', async () => {
    if (confirm(`Are you sure you want to delete Rule #${currentRuleNumber}?`)) {
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
        alert("Rule deleted successfully!");
        ruleModal.hide();
        fetchRules();
      } else {
        alert("Error deleting rule: " + result.message);
      }
    }
  });

  fetchRules();
});
