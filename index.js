require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

app.use(express.json({ limit: "1mb" }));

// Session context
const chatContexts = {};

// Keywords storage
let KEYWORDS = [];
let DEFAULT_REPLIES = [];

// Load all chat JSON files
function loadAllKeywords() {
  try {
    const dataDir = path.join(__dirname, "data");
    KEYWORDS = [];
    fs.readdirSync(dataDir).forEach(file => {
      if (file.endsWith(".json") && file !== "default.json") {
        const fileData = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
        KEYWORDS = KEYWORDS.concat(fileData);
      }
    });
    console.log(`⚡ LOADED ${KEYWORDS.length} KEYWORDS`);
  } catch (err) {
    console.error("❌ Failed to load chat keywords:", err.message);
    KEYWORDS = [];
  }
}

// Load default replies
function loadDefaultReplies() {
  try {
    const defaultPath = path.join(__dirname, "data", "default.json");
    const data = JSON.parse(fs.readFileSync(defaultPath, "utf8"));
    DEFAULT_REPLIES = data.defaultReplies || [];
    console.log(`⚡ LOADED ${DEFAULT_REPLIES.length} DEFAULT REPLIES`);
  } catch (err) {
    console.error("❌ Failed to load default replies:", err.message);
    DEFAULT_REPLIES = [];
  }
}

// Initial load
loadAllKeywords();
loadDefaultReplies();

// Watch data folder for live reload
fs.watch(path.join(__dirname, "data"), (eventType, filename) => {
  if (filename.endsWith(".json")) {
    console.log(`📂 ${filename} UPDATED, RELOADING...`);
    loadAllKeywords();
    loadDefaultReplies();
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
    if (k.type === "contain") {
      for (let pattern of k.patterns) {
        if (msg.includes(pattern.toLowerCase())) {
          reply = pick(k.replies);
          break;
        }
      }
    } else if (k.type === "exact" && k.pattern.toLowerCase() === msg) {
      reply = pick(k.replies);
    } else if (k.type === "pattern" && new RegExp(k.pattern, "i").test(msg)) {
      reply = pick(k.replies);
    }
    if (reply) break;
  }

  if (!reply) {
    reply = pick(DEFAULT_REPLIES);
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

// Self-ping route
app.get("/ping", (req, res) => res.send("🏓 PING OK!"));

// Root
app.get("/", (req, res) => res.send("🤖 FRIENDLY CHAT BOT IS LIVE!"));

// Start server
app.listen(PORT, () => {
  console.log(`🤖 CHAT BOT RUNNING ON PORT ${PORT}`);

  // 5-min self-ping interval
  setInterval(() => {
    axios.get(`${SERVER_URL}/ping`)
      .then(() => console.log("🔁 Self-ping sent!"))
      .catch(err => console.log("❌ Ping failed:", err.message));
  }, 5 * 60 * 1000);
});