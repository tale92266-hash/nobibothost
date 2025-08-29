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

// -------------------- Keywords & Replies --------------------
let RULES = [];

function loadAllRules() {
  try {
    const dataDir = path.join(__dirname, "data");
    RULES = [];
    fs.readdirSync(dataDir).forEach(file => {
      if (file.endsWith(".json") && file !== "stats.json") {
        const fileData = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
        RULES.push(fileData);
      }
    });
    console.log(`⚡ LOADED ${RULES.length} RULE FILES`);
  } catch (err) {
    console.error("❌ Failed to load rules:", err.message);
    RULES = [];
  }
}

// Watch data folder for updates
fs.watch(path.join(__dirname, "data"), (eventType, filename) => {
  if (filename.endsWith(".json") && filename !== "stats.json") {
    console.log(`📂 ${filename} UPDATED, RELOADING RULES...`);
    loadAllRules();
  }
});

// -------------------- Helpers --------------------
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function escapeRegex(str) { return str.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&'); }

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

  // -------------------- Match Rules --------------------
  let reply = null;
  for (let ruleFile of RULES) {
    for (let rule of ruleFile.rules) {
      const { RULE_TYPE, KEYWORDS, REPLIES_TYPE, REPLY_TEXT } = rule;
      const keywordArr = KEYWORDS.split("//").map(k => k.trim());
      const replyArr = REPLY_TEXT.split("<#>").map(r => r.trim());
      const lowerMsg = msg.toLowerCase();

      let matched = false;

      if (RULE_TYPE === "WELCOME") {
        if (!chatContexts[sessionId].welcomed) {
          reply = pick(replyArr);
          chatContexts[sessionId].welcomed = true;
          matched = true;
        }
      } else if (RULE_TYPE === "EXACT") {
        matched = keywordArr.some(k => lowerMsg === k.toLowerCase());
      } else if (RULE_TYPE === "PATTERN") {
        matched = keywordArr.some(k => {
          // convert *abc* style to regex
          const pattern = "^" + escapeRegex(k).replace(/\\\*/g, ".*") + "$";
          return new RegExp(pattern, "i").test(msg);
        });
      } else if (RULE_TYPE === "EXPERT") {
        matched = keywordArr.some(k => new RegExp(k, "i").test(msg));
      }

      if (matched) {
        if (REPLIES_TYPE === "ALL") reply = replyArr.join(" ");
        else if (REPLIES_TYPE === "ONE") reply = replyArr[0];
        else if (REPLIES_TYPE === "RANDOM") reply = pick(replyArr);
        break;
      }
    }
    if (reply) break;
  }

  if (!reply) return null; // no default reply

  chatContexts[sessionId].lastIntent = reply;
  chatContexts[sessionId].lastMessage = msg;

  emitStats();
  return reply.toUpperCase();
}

// -------------------- Load initial data --------------------
loadAllRules();

// -------------------- Webhook --------------------
app.post("/webhook", (req, res) => {
  const sessionId = req.body.session_id || "default_session";
  const msg = req.body.query?.message || "";
  const replyText = processMessage(msg, sessionId);
  if (replyText) res.json({ replies: [{ message: replyText }] });
  else res.json({ replies: [] }); // no match
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

// -------------------- Self-ping every 5 mins (fixed overlap) --------------------
let pingInProgress = false;
setInterval(async () => {
  if (pingInProgress) return;
  pingInProgress = true;
  try {
    await axios.get(`${SERVER_URL}/ping`);
    console.log("🔁 Self-ping sent!");
  } catch (err) {
    console.log("❌ Ping failed:", err.message);
  } finally {
    pingInProgress = false;
  }
}, 5 * 60 * 1000);