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

// ---------------- Persistent Stats ----------------
const statsFilePath = path.join(__dirname, "data", "stats.json");
if (!fs.existsSync(statsFilePath)) {
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
  fs.writeFileSync(
    statsFilePath,
    JSON.stringify({ totalUsers: [], todayUsers: [], totalMsgs: 0, todayMsgs: 0, nobiPapaHideMeUsers: [] }, null, 2)
  );
  console.log("⚡ stats.json created!");
}
let stats = JSON.parse(fs.readFileSync(statsFilePath, "utf8"));
function saveStats() { fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2)); }

// ---------------- Chat Context ----------------
const chatContexts = {};

// ---------------- Load Rules ----------------
let RULES = [];
function loadAllRules() {
  RULES = [];
  const dataDir = path.join(__dirname, "data");
  fs.readdirSync(dataDir).forEach(file => {
    if (file.endsWith(".json") && file !== "stats.json") {
      try {
        const ruleFile = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
        if (!ruleFile.rules || !Array.isArray(ruleFile.rules)) {
          console.error(`❌ ${file} has no valid "rules" array`);
          return;
        }
        RULES = RULES.concat(ruleFile.rules);
      } catch (err) {
        console.error(`❌ Failed to load ${file}:`, err.message);
      }
    }
  });
  console.log(`⚡ Loaded ${RULES.length} rules`);
}
loadAllRules();

// Watch data folder for changes
fs.watch(path.join(__dirname, "data"), (eventType, filename) => {
  if (filename.endsWith(".json") && filename !== "stats.json") {
    console.log(`📂 ${filename} updated, reloading rules...`);
    loadAllRules();
  }
});

// ---------------- Helpers ----------------
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function matchPattern(keyword, msg) {
  // Convert *abc* style into regex
  const pattern = "^" + keyword.split("*").map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(".*") + "$";
  return new RegExp(pattern, "i").test(msg);
}

// Emit stats to clients
function emitStats() {
  io.emit("statsUpdate", {
    totalUsers: stats.totalUsers.length,
    totalMsgs: stats.totalMsgs,
    todayUsers: stats.todayUsers.length,
    todayMsgs: stats.todayMsgs.length,
    nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
  });
}

// ---------------- Process Message ----------------
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

  // ---------------- Match Rules ----------------
  let reply = null;
  for (let rule of RULES) {
    let keywords = (rule.KEYWORDS || "").split("//").map(k => k.trim()).filter(Boolean);
    if (!keywords.length) continue;

    if (rule.RULE_TYPE === "WELCOME" && !chatContexts[sessionId].welcomed) {
      reply = pick(rule.REPLY_TEXT.split("<#>"));
      chatContexts[sessionId].welcomed = true;
      break;
    }

    if (rule.RULE_TYPE === "EXACT") {
      if (keywords.includes(msg)) { reply = pick(rule.REPLY_TEXT.split("<#>")); break; }
    }

    if (rule.RULE_TYPE === "PATTERN") {
      for (let kw of keywords) if (matchPattern(kw, msg)) { reply = pick(rule.REPLY_TEXT.split("<#>")); break; }
      if (reply) break;
    }

    if (rule.RULE_TYPE === "EXPERT") {
      for (let kw of keywords) if (new RegExp(kw, "i").test(msg)) { reply = pick(rule.REPLY_TEXT.split("<#>")); break; }
      if (reply) break;
    }
  }

  chatContexts[sessionId].lastIntent = reply;
  chatContexts[sessionId].lastMessage = msg;

  emitStats();
  return reply ? reply.toUpperCase() : null;
}

// ---------------- Webhook ----------------
app.post("/webhook", (req, res) => {
  const sessionId = req.body.session_id || "default_session";
  const msg = req.body.query?.message || "";
  const replyText = processMessage(msg, sessionId);
  if (replyText) res.json({ replies: [{ message: replyText }] });
  else res.json({ replies: [] });
});

// ---------------- Stats API ----------------
app.get("/stats", (req, res) => {
  res.json({
    totalUsers: stats.totalUsers.length,
    totalMsgs: stats.totalMsgs,
    todayUsers: stats.todayUsers.length,
    todayMsgs: stats.todayMsgs.length,
    nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
  });
});

// ---------------- Frontend ----------------
app.use(express.static("public"));

// ---------------- Ping ----------------
app.get("/ping", (req, res) => res.send("🏓 PING OK!"));
app.get("/", (req, res) => res.send("🤖 FRIENDLY CHAT BOT IS LIVE!"));

// ---------------- Start server ----------------
server.listen(PORT, () => console.log(`🤖 CHAT BOT RUNNING ON PORT ${PORT}`));

// ---------------- Self-ping every 5 mins (fixed single interval) ----------------
let lastPing = 0;
setInterval(() => {
  const now = Date.now();
  if (now - lastPing >= 5 * 60 * 1000) {
    lastPing = now;
    axios.get(`${SERVER_URL}/ping`).then(() => console.log("🔁 Self-ping sent!")).catch(err => console.log("❌ Ping failed:", err.message));
  }
}, 1000);