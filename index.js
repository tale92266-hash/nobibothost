require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

const server = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json({ limit: "1mb" }));

// -------------------- Persistent Stats --------------------
const statsFilePath = path.join(__dirname, "data", "stats.json");

// Auto-create stats.json if missing
if (!fs.existsSync(statsFilePath)) {
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
  fs.writeFileSync(
    statsFilePath,
    JSON.stringify({
      totalUsers: [],
      todayUsers: [],
      totalMsgs: 0,
      todayMsgs: 0,
      nobiPapaHideMeUsers: []
    }, null, 2)
  );
  console.log("⚡ stats.json created for first time!");
}

// Load stats
let stats = JSON.parse(fs.readFileSync(statsFilePath, "utf8"));
function saveStats() {
  fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
}

// -------------------- Chat Context --------------------
const chatContexts = {};

// -------------------- RULES LOADING --------------------
let RULES = [];
function loadRules() {
  const dataDir = path.join(__dirname, "data");
  RULES = [];
  fs.readdirSync(dataDir).forEach(file => {
    if (file.endsWith(".json") && file !== "stats.json") {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
        RULES.push(data);
      } catch (err) {
        console.error(`❌ Failed to load ${file}:`, err.message);
      }
    }
  });
  console.log(`⚡ LOADED ${RULES.length} RULES`);
}

// -------------------- Watch data folder --------------------
fs.watch(path.join(__dirname, "data"), (eventType, filename) => {
  if (filename.endsWith(".json") && filename !== "stats.json") {
    console.log(`📂 ${filename} UPDATED, RELOADING RULES...`);
    loadRules();
  }
});

// -------------------- Helpers --------------------
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function splitKeywords(str) { return str.split("//").map(k => k.trim()).filter(Boolean); }
function splitReplies(str) { return str.split("<#>").map(r => r.trim()).filter(Boolean); }
function matchPattern(msg, pattern) {
  // Convert *abc* style into regex
  const regexStr = pattern.split("*").map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  const regex = new RegExp(`^${regexStr}$`, "i");
  return regex.test(msg);
}

// Emit stats to clients via Socket.io
function emitStats() {
  io.emit("statsUpdate", {
    totalUsers: stats.totalUsers.length,
    totalMsgs: stats.totalMsgs,
    todayUsers: stats.todayUsers.length,
    todayMsgs: stats.todayMsgs,
    nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
  });
}

// -------------------- Process incoming message --------------------
function processMessage(msg, sessionId = "default") {
  msg = msg.toLowerCase();
  if (!chatContexts[sessionId]) chatContexts[sessionId] = { lastIntent: null, dialogueState: "normal" };

  // -------------------- Update Stats --------------------
  if (!stats.totalUsers.includes(sessionId)) stats.totalUsers.push(sessionId);
  if (!stats.todayUsers.includes(sessionId)) stats.todayUsers.push(sessionId);
  stats.totalMsgs++;
  stats.todayMsgs++;
  if (msg.includes("nobi papa hide me") && !stats.nobiPapaHideMeUsers.includes(sessionId)) stats.nobiPapaHideMeUsers.push(sessionId);
  saveStats();

  // -------------------- Match Rules --------------------
  let reply = null;
  for (let rule of RULES) {
    const keywords = splitKeywords(rule.keywords);
    for (let kw of keywords) {
      if (rule.rule_type === "WELCOME" && chatContexts[sessionId].dialogueState === "normal") {
        reply = pick(splitReplies(rule.reply_text));
        chatContexts[sessionId].dialogueState = "welcomed";
        break;
      } else if (rule.rule_type === "EXACT" && kw.toLowerCase() === msg) {
        reply = pick(splitReplies(rule.reply_text));
        break;
      } else if ((rule.rule_type === "PATTERN" || rule.rule_type === "EXPERT") && matchPattern(msg, kw.toLowerCase())) {
        reply = pick(splitReplies(rule.reply_text));
        break;
      }
    }
    if (reply) break;
  }

  if (!reply) return null; // No default reply now

  chatContexts[sessionId].lastIntent = reply;
  chatContexts[sessionId].lastMessage = msg;

  emitStats();
  return reply.toUpperCase();
}

// -------------------- Load initial rules --------------------
loadRules();

// -------------------- Webhook --------------------
app.post("/webhook", (req, res) => {
  const sessionId = req.body.session_id || "default_session";
  const msg = req.body.query?.message || "";
  const replyText = processMessage(msg, sessionId);
  if (replyText) res.json({ replies: [{ message: replyText }] });
  else res.json({ replies: [] });
});

// -------------------- Stats API --------------------
app.get("/stats", (req, res) => {
  res.json({
    totalUsers: stats.totalUsers.length,
    totalMsgs: stats.totalMsgs,
    todayUsers: stats.todayUsers.length,
    todayMsgs: stats.todayMsgs.length,
    nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
  });
});

// -------------------- Frontend --------------------
app.use(express.static("public"));

// -------------------- Ping --------------------
app.get("/ping", (req, res) => res.send("🏓 PING OK!"));
app.get("/", (req, res) => res.send("🤖 FRIENDLY CHAT BOT IS LIVE!"));

// -------------------- Start server --------------------
server.listen(PORT, () => console.log(`🤖 CHAT BOT RUNNING ON PORT ${PORT}`));

// -------------------- Self-ping every 5 mins --------------------
setInterval(() => {
  axios.get(`${SERVER_URL}/ping`).then(() => console.log("🔁 Self-ping sent!")).catch(err => console.log("❌ Ping failed:", err.message));
});