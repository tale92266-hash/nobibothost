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
const welcomedUsersFilePath = path.join(__dirname, "data", "welcomed_users.json");
const today = new Date().toLocaleDateString();

// Stats file creation
if (!fs.existsSync(statsFilePath)) {
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
  fs.writeFileSync(
    statsFilePath,
    JSON.stringify({
      totalUsers: [],
      todayUsers: [],
      totalMsgs: 0,
      todayMsgs: 0,
      nobiPapaHideMeUsers: [],
      lastResetDate: today
    }, null, 2)
  );
  console.log("⚡ stats.json created for first time!");
}

let stats = JSON.parse(fs.readFileSync(statsFilePath, "utf8"));

// Welcomed users file creation
if (!fs.existsSync(welcomedUsersFilePath)) {
  fs.writeFileSync(welcomedUsersFilePath, JSON.stringify([], null, 2));
  console.log("⚡ welcomed_users.json created for first time!");
}

let welcomedUsers = JSON.parse(fs.readFileSync(welcomedUsersFilePath, "utf8"));

// Check if a new day has started on server restart
if (stats.lastResetDate !== today) {
  stats.todayUsers = [];
  stats.todayMsgs = 0;
  stats.lastResetDate = today;
  saveStats();
  console.log("📅 Daily stats reset!");
}

function saveStats() {
  fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
}

function saveWelcomedUsers() {
  fs.writeFileSync(welcomedUsersFilePath, JSON.stringify(welcomedUsers, null, 2));
}

// Daily reset at midnight
const resetDailyStats = () => {
  stats.todayUsers = [];
  stats.todayMsgs = 0;
  stats.lastResetDate = new Date().toLocaleDateString();
  saveStats();
  console.log("📅 Daily stats reset!");
};

const scheduleDailyReset = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(now.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  const timeUntilMidnight = midnight.getTime() - now.getTime();
  setTimeout(() => {
    resetDailyStats();
    // Schedule for the next day
    setInterval(resetDailyStats, 24 * 60 * 60 * 1000);
  }, timeUntilMidnight);
};

// -------------------- RULES --------------------
let RULES = [];

function loadAllRules() {
  RULES = [];
  const dataDir = path.join(__dirname, "data");
  fs.readdirSync(dataDir).forEach(file => {
    if (file.endsWith(".json") && file !== "stats.json" && file !== "welcomed_users.json") {
      try {
        const ruleFile = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
        if (!ruleFile.rules || !Array.isArray(ruleFile.rules)) {
          console.error(`❌ ${file} INVALID: "rules" missing or not array`);
          return;
        }
        for (let r of ruleFile.rules) {
          if (!r.RULE_TYPE || !r.KEYWORDS || !r.REPLY_TEXT) {
            console.error(`❌ ${file} INVALID rule:`, r);
            continue;
          }
          RULES.push(r);
          console.log(`✅ ${file} valid rule:`, r.RULE_TYPE);
        }
      } catch (err) {
        console.error(`❌ Failed to parse ${file}:`, err.message);
      }
    }
  });

  // Sort rules by RULE_NUMBER
  RULES.sort((a, b) => a.RULE_NUMBER - b.RULE_NUMBER);

  console.log(`⚡ Loaded ${RULES.length} valid rules`);
}

// Watch data folder for updates
fs.watch(path.join(__dirname, "data"), (eventType, filename) => {
  if (filename.endsWith(".json") && filename !== "stats.json" && filename !== "welcomed_users.json") {
    console.log(`📂 ${filename} UPDATED, RELOADING...`);
    loadAllRules();
  }
});

// -------------------- Helpers --------------------
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function emitStats() {
  io.emit("statsUpdate", {
    totalUsers: stats.totalUsers.length,
    totalMsgs: stats.totalMsgs,
    todayUsers: stats.todayUsers.length,
    todayMsgs: stats.todayMsgs,
    nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
  });
}

function processMessage(msg, sessionId = "default") {
  msg = msg.toLowerCase();

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
    // Check user targeting before checking keywords
    const targetUsers = rule.TARGET_USERS || "ALL"; // Default to ALL if not specified
    let userMatch = false;

    if (targetUsers === "ALL") {
      userMatch = true;
    } else if (Array.isArray(targetUsers)) {
      if (rule.RULE_TYPE === "IGNORED") {
        if (!targetUsers.includes(sessionId)) {
          userMatch = true;
        }
      } else {
        if (targetUsers.includes(sessionId)) {
          userMatch = true;
        }
      }
    }

    if (!userMatch) {
      continue; // Skip this rule if user doesn't match the targeting
    }

    // Now proceed with the existing matching logic
    let patterns = rule.KEYWORDS.split("//").map(p => p.trim()).filter(Boolean);
    let match = false;

    // Custom logic for welcome message
    if (rule.RULE_TYPE === "WELCOME") {
      if (!welcomedUsers.includes(sessionId)) {
        match = true;
        welcomedUsers.push(sessionId);
        saveWelcomedUsers();
      }
    } else if (rule.RULE_TYPE === "DEFAULT") {
        match = true;
    } else {
      for (let pattern of patterns) {
        if (rule.RULE_TYPE === "EXACT" && pattern.toLowerCase() === msg) match = true;
        else if (rule.RULE_TYPE === "PATTERN") {
          let regexStr = pattern.replace(/\*/g, ".*");
          if (new RegExp(`^${regexStr}$`, "i").test(msg)) match = true;
        }
        else if (rule.RULE_TYPE === "EXPERT") {
          try {
            if (new RegExp(pattern, "i").test(msg)) match = true;
          } catch {}
        }
        if (match) break;
      }
    }

    if (match) {
      let replies = rule.REPLY_TEXT.split("<#>").map(r => r.trim()).filter(Boolean);
      if (rule.REPLIES_TYPE === "ALL") reply = replies.join(" ");
      else if (rule.REPLIES_TYPE === "ONE") reply = replies[0];
      else reply = pick(replies);
      break;
    }
  }

  emitStats();

  return reply || null; // agar match nahi hua toh null
}

// -------------------- Initial Load --------------------
loadAllRules();
scheduleDailyReset();

// -------------------- Webhook --------------------
app.post("/webhook", (req, res) => {
  const sessionId = req.body.session_id || "default_session";
  const msg = req.body.query?.message || "";
  const replyText = processMessage(msg, sessionId);
  if (!replyText) return res.json({ replies: [] });
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

// -------------------- Self-ping every 5 mins (only once at a time) --------------------
let pinging = false;
setInterval(async () => {
  if (pinging) return;
  pinging = true;
  try {
    await axios.get(`${SERVER_URL}/ping`);
    console.log("🔁 Self-ping sent!");
  } catch (err) {
    console.log("❌ Ping failed:", err.message);
  }
  pinging = false;
}, 5 * 60 * 1000);
