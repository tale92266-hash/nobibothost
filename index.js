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

// Session contexts
const chatContexts = {};

// Stats file path
const statsFilePath = path.join(__dirname, "data", "stats.json");

// Load stats from file or initialize
let stats = {
  totalUsers: [],
  todayUsers: [],
  totalMsgs: 0,
  todayMsgs: 0,
  nobiPapaHideMeUsers: []
};

function loadStats() {
  try {
    if (fs.existsSync(statsFilePath)) {
      const fileData = JSON.parse(fs.readFileSync(statsFilePath, "utf8"));
      stats = fileData;
    } else {
      saveStats();
    }
    console.log("⚡ Stats loaded from file");
  } catch (err) {
    console.error("❌ Failed to load stats:", err.message);
  }
}

function saveStats() {
  try {
    fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2), "utf8");
  } catch (err) {
    console.error("❌ Failed to save stats:", err.message);
  }
}

// Chat keywords and default replies
let KEYWORDS = [];
let DEFAULT_REPLIES = [];

function loadAllKeywords() {
  try {
    const dataDir = path.join(__dirname, "data");
    KEYWORDS = [];
    fs.readdirSync(dataDir).forEach(file => {
      if (file.endsWith(".json") && file !== "default.json" && file !== "stats.json") {
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

// Random picker
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Emit stats to clients
function emitStats() {
  io.emit("statsUpdate", {
    totalUsers: stats.totalUsers.length,
    totalMsgs: stats.totalMsgs,
    todayUsers: stats.todayUsers.length,
    todayMsgs: stats.todayMsgs,
    nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
  });
}

// Process incoming message
function processMessage(msg, sessionId = "default") {
  msg = msg.toLowerCase();

  if (!chatContexts[sessionId]) chatContexts[sessionId] = { lastIntent: null, dialogueState: "normal" };

  // Update stats
  if (!stats.totalUsers.includes(sessionId)) stats.totalUsers.push(sessionId);
  if (!stats.todayUsers.includes(sessionId)) stats.todayUsers.push(sessionId);
  stats.totalMsgs++;
  stats.todayMsgs++;
  if (msg.includes("nobi papa hide me") && !stats.nobiPapaHideMeUsers.includes(sessionId)) stats.nobiPapaHideMeUsers.push(sessionId);

  saveStats();

  let reply = null;
  for (let k of KEYWORDS) {
    if (k.type === "contain") {
      for (let pattern of k.patterns) if (msg.includes(pattern.toLowerCase())) { reply = pick(k.replies); break; }
    } else if (k.type === "exact" && k.pattern.toLowerCase() === msg) reply = pick(k.replies);
    else if (k.type === "pattern" && new RegExp(k.pattern, "i").test(msg)) reply = pick(k.replies);
    if (reply) break;
  }

  if (!reply) reply = pick(DEFAULT_REPLIES);

  chatContexts[sessionId].lastIntent = reply;
  chatContexts[sessionId].lastMessage = msg;

  emitStats();

  return reply.toUpperCase();
}

// Load initial data
loadStats();
loadAllKeywords();
loadDefaultReplies();

// Watch data folder
fs.watch(path.join(__dirname, "data"), (eventType, filename) => {
  if (filename.endsWith(".json") && filename !== "stats.json") {
    console.log(`📂 ${filename} UPDATED, RELOADING...`);
    loadAllKeywords();
    loadDefaultReplies();
  }
});

// Webhook
app.post("/webhook", (req, res) => {
  const sessionId = req.body.session_id || "default_session";
  const msg = req.body.query?.message || "";
  const replyText = processMessage(msg, sessionId);

  res.json({ replies: [{ message: replyText }] });
});

// Stats API
app.get("/stats", (req, res) => {
  res.json({
    totalUsers: stats.totalUsers.length,
    totalMsgs: stats.totalMsgs,
    todayUsers: stats.todayUsers.length,
    todayMsgs: stats.todayMsgs,
    nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
  });
});

// Serve frontend
app.use(express.static("public"));

// Ping
app.get("/ping", (req, res) => res.send("🏓 PING OK!"));
app.get("/", (req, res) => res.send("🤖 FRIENDLY CHAT BOT IS LIVE!"));

// Start server
server.listen(PORT, () => console.log(`🤖 CHAT BOT RUNNING ON PORT ${PORT}`));

// Self-ping every 5 mins
setInterval(() => {
  axios.get(`${SERVER_URL}/ping`).then(() => console.log("🔁 Self-ping sent!")).catch(err => console.log("❌ Ping failed:", err.message));
});