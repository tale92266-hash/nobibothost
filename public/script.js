// ==== BOTTOM NAVIGATION HANDLING ====
document.querySelectorAll('.bottom-nav button').forEach(btn => {
  btn.onclick = function() {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.add('hidden'));
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(btn.dataset.screen).classList.remove('hidden');
    btn.classList.add('nav-active');
  }
});
document.getElementById('chat-section').classList.remove('hidden');

// ==== CHAT SEND/RECEIVE ====
document.getElementById('sendBtn').onclick = async function() {
  const input = document.getElementById('chatInput').value.trim();
  if(!input) return;
  const chatBody = document.getElementById('chatBody');
  chatBody.innerHTML += `<div class="msg-bubble user">${input}</div>`;
  document.getElementById('chatInput').value='';
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    const res = await fetch('/webhook', { 
      method: 'POST', headers: {'Content-Type':'application/json'}, 
      body: JSON.stringify({ query: { message: input } }) 
    });
    const data = await res.json();
    const reply = data.replies?.?.message || 'No reply';
    chatBody.innerHTML += `<div class="msg-bubble bot">${reply}</div>`;
    chatBody.scrollTop = chatBody.scrollHeight;
  } catch(err) {
    chatBody.innerHTML += `<div class="msg-bubble bot" style="background:#ffebee;color:#d32f2f;">Server error</div>`;
  }
};

// ==== RULES LISTING ====
async function loadRules() {
  const res = await fetch('/api/rules');
  const rules = await res.json();
  const list = document.getElementById('rulesList');
  list.innerHTML = '';
  rules.forEach(rule => {
    list.innerHTML += `<div class="rules-card">
      <b>#${rule.RULE_NUMBER}:</b> ${rule.KEYWORDS}<br>
      <span style="color:#555;"><i>${rule.REPLY_TEXT.split('<#>')}</i></span>
    </div>`;
  });
}
document.querySelector('[data-screen="rules-section"]').addEventListener('click', loadRules);

// ==== RULE ADD/EDIT FAB (MODAL LOGIC SAMPLE) ====
document.getElementById('addRuleBtn').onclick = function() {
  alert('Yahan custom modal/form pop-up add/edit ka logic aayega!');
  // Modal pop-up & backend POST request ka code yahan banayein
};

// ==== VARIABLES LISTING ====
async function loadVariables() {
  const res = await fetch('/api/variables');
  const variables = await res.json();
  const list = document.getElementById('variablesList');
  list.innerHTML = '';
  variables.forEach(variable => {
    list.innerHTML += `<div class="variable-card">
      <b>${variable.name}:</b> ${variable.value}
    </div>`;
  });
}
document.querySelector('[data-screen="variables-section"]').addEventListener('click', loadVariables);

// ==== VARIABLE ADD/EDIT FAB (MODAL LOGIC SAMPLE) ====
document.getElementById('addVariableBtn').onclick = function() {
  alert('Yahan variable add/edit ka custom modal form logic aayega!');
  // Modal pop-up & backend POST request ka code yahan banayein
};

// ==== STATS FETCH & DISPLAY ====
async function loadStats() {
  const res = await fetch('/stats');
  const stats = await res.json();
  document.getElementById('statsContent').innerHTML = `<div class="stats-section">
    <b>Total Users:</b> ${stats.totalUsers}<br>
    <b>Total Messages:</b> ${stats.totalMsgs}<br>
    <b>Today's Users:</b> ${stats.todayUsers}<br>
    <b>Today's Messages:</b> ${stats.todayMsgs}<br>
    <b>'Hide Me' Count:</b> ${stats.nobiPapaHideMeCount}
  </div>`;
}
document.querySelector('[data-screen="stats-section"]').addEventListener('click', loadStats);

// ==== OPTIONAL: ENTER TO SEND CHAT ====
document.getElementById('chatInput').addEventListener('keydown', function(e) {
  if(e.key === 'Enter') {
    document.getElementById('sendBtn').click();
  }
});

// ==== INITIAL LOADS FOR SCREENS ====
if(document.querySelector('.nav-active[data-screen="rules-section"]')) loadRules();
if(document.querySelector('.nav-active[data-screen="variables-section"]')) loadVariables();
if(document.querySelector('.nav-active[data-screen="stats-section"]')) loadStats();
