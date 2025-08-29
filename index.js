// load default replies
let DEFAULT_REPLIES = [];
function loadDefault() {
  const defaultPath = path.join(__dirname, "data", "default.json");
  DEFAULT_REPLIES = JSON.parse(fs.readFileSync(defaultPath, "utf8")).defaultReplies;
}
loadDefault();

// watch for live reload
fs.watch(path.join(__dirname, "data"), (eventType, filename) => {
  if (filename.endsWith(".json")) {
    console.log(`📂 ${filename} UPDATED, RELOADING...`);
    loadAllKeywords();   // chat rules
    loadDefault();       // default reply
  }
});

// modify processMessage
function processMessage(msg, sessionId = "default") {
  msg = msg.toLowerCase();

  if (!chatContexts[sessionId]) {
    chatContexts[sessionId] = { lastIntent: null, dialogueState: "normal" };
  }
  const context = chatContexts[sessionId];

  let reply = null;

  for (let k of KEYWORDS) {
    if (k.type === "exact" && msg === k.pattern.toLowerCase()) {
      reply = k.reply;
      break;
    }
    if (k.type === "contain" && msg.includes(k.pattern.toLowerCase())) {
      reply = k.reply;
      break;
    }
    if (k.type === "pattern" && new RegExp(k.pattern, "i").test(msg)) {
      reply = k.reply;
      break;
    }
  }

  if (!reply) {
    reply = pick(DEFAULT_REPLIES);      // <- NEW: pick from default.json
    context.dialogueState = "waiting_for_clarification";
  } else {
    context.dialogueState = "normal";
  }

  context.lastIntent = reply;
  context.lastMessage = msg;

  return reply.toUpperCase();
}

// helper pick function
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}