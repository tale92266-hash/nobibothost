document.addEventListener("DOMContentLoaded", () => {
  const rulesList = document.getElementById("rulesList");
  const addRuleBtn = document.getElementById("addRuleBtn");
  const ruleFormContainer = document.getElementById("ruleFormContainer");
  const ruleForm = document.getElementById("ruleForm");
  const formTitle = document.getElementById("formTitle");
  const closeFormBtn = document.getElementById("closeFormBtn");
  const deleteRuleBtn = document.getElementById("deleteRuleBtn");
  const loadingMessage = document.getElementById("loadingMessage");
  let currentRuleId = null;

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
          <p class="mb-1 preview-text">Keywords: ${rule.KEYWORDS === 'ALL' ? '*' : rule.KEYWORDS.split('//').slice(0, 3).join(', ')}</p>
          <p class="mb-0 preview-text">Reply: ${rule.REPLY_TEXT.split('<#>').slice(0, 1)}</p>
        </div>
      `;
      item.addEventListener('click', () => editRule(rule));
      rulesList.appendChild(item);
    });
  }

  function showForm(mode) {
    if (mode === 'add') {
      ruleForm.reset();
      formTitle.innerText = "Add New Rule";
      deleteRuleBtn.style.display = 'none';
      currentRuleId = null;
      // Fetch the highest rule number from the list and set default
      fetch('/api/rules')
        .then(res => res.json())
        .then(rules => {
          const lastRuleNumber = rules.length > 0 ? rules[rules.length - 1].RULE_NUMBER : 0;
          document.getElementById('ruleNumber').value = lastRuleNumber + 1;
        });
    }
    ruleFormContainer.style.display = 'block';
  }

  async function editRule(rule) {
    currentRuleId = rule.RULE_NUMBER;
    formTitle.innerText = `Edit Rule #${rule.RULE_NUMBER}`;
    document.getElementById('ruleNumber').value = rule.RULE_NUMBER;
    document.getElementById('ruleType').value = rule.RULE_TYPE;
    document.getElementById('keywords').value = rule.KEYWORDS;
    document.getElementById('repliesType').value = rule.REPLIES_TYPE;
    document.getElementById('replyText').value = rule.REPLY_TEXT;
    document.getElementById('targetUsers').value = Array.isArray(rule.TARGET_USERS) ? rule.TARGET_USERS.join('//') : rule.TARGET_USERS;
    deleteRuleBtn.style.display = 'block';
    ruleFormContainer.style.display = 'block';
  }

  addRuleBtn.addEventListener('click', () => showForm('add'));
  closeFormBtn.addEventListener('click', () => ruleFormContainer.style.display = 'none');
  
  ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(ruleForm);
    const ruleData = Object.fromEntries(formData.entries());
    
    // Convert ruleNumber to integer
    ruleData.ruleNumber = parseInt(ruleData.ruleNumber);

    // Convert targetUsers to array if not "ALL"
    if (ruleData.targetUsers !== 'ALL') {
      ruleData.targetUsers = ruleData.targetUsers.split('//').map(id => id.trim());
    }

    const payload = {
      type: currentRuleId ? 'edit' : 'add',
      rule: ruleData,
      oldRuleNumber: currentRuleId
    };

    const res = await fetch('/api/rules/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.success) {
      alert("Rule saved successfully!");
      ruleFormContainer.style.display = 'none';
      fetchRules();
    } else {
      alert("Error saving rule: " + result.message);
    }
  });

  deleteRuleBtn.addEventListener('click', async () => {
    if (confirm(`Are you sure you want to delete Rule #${currentRuleId}?`)) {
      const payload = {
        type: 'delete',
        rule: { ruleNumber: currentRuleId }
      };
      const res = await fetch('/api/rules/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        alert("Rule deleted successfully!");
        ruleFormContainer.style.display = 'none';
        fetchRules();
      } else {
        alert("Error deleting rule: " + result.message);
      }
    }
  });

  fetchRules();
});
