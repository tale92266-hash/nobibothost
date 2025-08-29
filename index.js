const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "1mb" }));

// Context memory per session
const chatContexts = {};

// KEYWORDS storage
let KEYWORDS = [];

// Load all JSON files in data folder
function loadAllKeywords() {
  const dataDir = path.join(__dirname, "data");
  KEYWORDS = [];
  fs.readdirSync(dataDir).forEach(file => {
    if (file.endsWith(".json")) {
      const fileData = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
      KEYWORDS = KEYWORDS.concat(fileData);
    }
  });
  console.log(`⚡ LOADED ${KEYWORDS.length} KEYWORDS FROM JSON FILES`);
}

// Initial load
loadAllKeywords();

// Live reload on JSON changes
fs.watch(path.join(__dirname, "data"), (eventType, filename) => {
  if (filename.endsWith(".json")) {
    console.log(`📂 ${filename} UPDATED, RELOADING KEYWORDS...`);
    loadAllKeywords();
  }
});

// Random picker
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Message processor
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
    reply = "SAMAJH NHI AAYA, THODA AUR CLEAR BOL. 🤔";
    context.dialogueState = "waiting_for_clarification";
  } else {
    context.dialogueState = "normal";
  }

  context.lastIntent = reply;
  context.lastMessage = msg;

  return reply.toUpperCase();
}

// Webhook endpoint
app.post("/webhook", (req, res) => {
  const sessionId = req.body.session_id || "default_session";
  const msg = req.body.query?.message || "";
  const replyText = processMessage(msg, sessionId);

  res.json({
    replies: [{ message: replyText }]
  });
});

app.get("/", (req, res) => res.send("🤖 ADVANCED HUMAN-LIKE CHAT BOT IS LIVE!"));

app.listen(PORT, () => console.log(`🤖 CHAT BOT RUNNING ON PORT ${PORT}`));