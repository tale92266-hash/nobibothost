// server.js
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
const dataDir = path.join(__dirname, "data");
const statsFilePath = path.join(dataDir, "stats.json");

// Ensure data folder and stats file exist
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(statsFilePath)) {
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

// -------------------- Keywords & Replies --------------------
let KEYWORDS = [];
let DEFAULT_REPLIES = [];

function loadAllKeywords() {
  try {
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
    const defaultPath = path.join(dataDir, "default.json");
    const data = JSON.parse(fs.readFileSync(defaultPath, "utf8"));
    DEFAULT_REPLIES = data.defaultReplies || [];
    console.log(`⚡ LOADED ${DEFAULT_REPLIES.length} DEFAULT REPLIES`);
  } catch (err) {
    console.error("❌ Failed to load default replies:", err.message);
    DEFAULT_REPLIES = [];
  }
}

// Watch data folder for updates
fs.watch(dataDir, (eventType, filename) => {
  if (filename.endsWith(".json") && filename !== "stats.json") {
    console.log(`📂 ${filename} UPDATED, RELOADING...`);
    loadAllKeywords();
    loadDefaultReplies();
  }
});

// -------------------- Helpers --------------------
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

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

// Process incoming message
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

  // -------------------- Match Keywords --------------------
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

// -------------------- Load initial data --------------------
loadAllKeywords();
loadDefaultReplies();

// -------------------- Webhook --------------------
app.post("/webhook", (req, res) => {
  const sessionId = req.body.session_id || "default_session";
  const msg = req.body.query?.message || "";
  const replyText = processMessage(msg, sessionId);
  res.json({ replies: [{ message: replyText }] });
});

// -------------------- Stats API --------------------
app.get("/stats", (req, res) => {
  res.json({
    totalUsers: stats.totalUsers.length,
    totalMsgs: stats.totalMsgs,
    todayUsers: stats.todayUsers.length,
    todayMsgs: stats.todayMsgs,
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

// -------------------- Self-ping every 5 mins with rate-limit safe --------------------
setInterval(async () => {
  try {
    await axios.get(`${SERVER_URL}/ping`);
    console.log("🔁 Self-ping sent!");
  } catch (err) {
    if (err.response && err.response.status === 429) {
      console.log("⚠️ Ping rate-limit hit, will retry in next interval.");
    } else {
      console.log("❌ Ping failed:", err.message);
    }
  }
}, 5 * 60 * 1000);

// -------------------- Socket.io connection --------------------
io.on("connection", socket => {
  console.log("👤 New client connected:", socket.id);
  emitStats();

  socket.on("disconnect", () => console.log("👤 Client disconnected:", socket.id));
});