require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 10000;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const MONGODB_URI = process.env.MONGODB_URI;

const server = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json({ limit: "1mb" }));

// -------------------- MongoDB Connection & Models --------------------
mongoose.connect(MONGODB_URI)
  .then(() => console.log("⚡ MongoDB connected successfully!"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true }
});
const User = mongoose.model("User", userSchema);

const ruleSchema = new mongoose.Schema({
  RULE_NUMBER: { type: Number, required: true, unique: true },
  RULE_TYPE: { type: String, required: true },
  KEYWORDS: { type: String, required: true },
  REPLIES_TYPE: { type: String, required: true },
  REPLY_TEXT: { type: String, required: true },
  TARGET_USERS: { type: mongoose.Schema.Types.Mixed, default: "ALL" }
});
const Rule = mongoose.model("Rule", ruleSchema);

const statsSchema = new mongoose.Schema({
  totalUsers: [{ type: String }],
  todayUsers: [{ type: String }],
  totalMsgs: { type: Number, default: 0 },
  todayMsgs: { type: Number, default: 0 },
  nobiPapaHideMeUsers: [{ type: String }],
  lastResetDate: { type: String }
});
const Stats = mongoose.model("Stats", statsSchema);

// -------------------- Persistent Stats --------------------
const statsFilePath = path.join(__dirname, "data", "stats.json");
const welcomedUsersFilePath = path.join(__dirname, "data", "welcomed_users.json");
const today = new Date().toLocaleDateString();

let stats;
let welcomedUsers;
let RULES = [];

// -------------------- Rules Functions (moved to global scope) --------------------
async function loadAllRules() {
    RULES = [];
    const dataDir = path.join(__dirname, "data");
    const dbRules = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    if (dbRules.length > 0) {
        RULES = dbRules.map(r => r.toObject());
        const jsonRules = { rules: RULES };
        fs.writeFileSync(path.join(dataDir, "funrules.json"), JSON.stringify(jsonRules, null, 2));
    } else {
        const jsonRules = JSON.parse(fs.readFileSync(path.join(dataDir, "funrules.json"), "utf8"));
        RULES = jsonRules.rules;
        if (RULES.length > 0) {
            await Rule.insertMany(RULES);
        }
    }
    console.log(`⚡ Loaded ${RULES.length} valid rules`);
}

// Data Sync Function (moved to global scope)
const syncData = async () => {
  try {
    // Sync Stats
    const dbStats = await Stats.findOne();
    if (dbStats) {
      stats = dbStats;
      fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
      console.log("⚡ Stats restored from MongoDB.");
    } else {
      stats = JSON.parse(fs.readFileSync(statsFilePath, "utf8"));
      await Stats.create(stats);
      console.log("⚡ Stats uploaded to MongoDB.");
    }

    // Sync Welcomed Users
    const dbWelcomedUsers = await User.find({}, 'sessionId');
    if (dbWelcomedUsers.length > 0) {
      welcomedUsers = dbWelcomedUsers.map(u => u.sessionId);
      fs.writeFileSync(welcomedUsersFilePath, JSON.stringify(welcomedUsers, null, 2));
      console.log("⚡ Welcomed users restored from MongoDB.");
    } else {
      welcomedUsers = JSON.parse(fs.readFileSync(welcomedUsersFilePath, "utf8"));
      if (welcomedUsers.length > 0) {
        await User.insertMany(welcomedUsers.map(id => ({ sessionId: id })));
        console.log("⚡ Welcomed users uploaded to MongoDB.");
      }
    }

    // Sync Rules
    await loadAllRules();

    // Check if a new day has started on server restart
    if (stats.lastResetDate !== today) {
        stats.todayUsers = [];
        stats.todayMsgs = 0;
        stats.lastResetDate = today;
        await Stats.findByIdAndUpdate(stats._id, stats);
        saveStats();
        console.log("📅 Daily stats reset!");
    }

    emitStats();

  } catch (err) {
    console.error("❌ Data sync error:", err);
  }
};

// -------------------- Helpers --------------------
function saveStats() {
  fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
}

function saveWelcomedUsers() {
  fs.writeFileSync(welcomedUsersFilePath, JSON.stringify(welcomedUsers, null, 2));
}

// Daily reset at midnight
const resetDailyStats = async () => {
  stats.todayUsers = [];
  stats.todayMsgs = 0;
  stats.lastResetDate = new Date().toLocaleDateString();
  await Stats.findByIdAndUpdate(stats._id, stats);
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
  
  // Save stats to MongoDB and JSON
  Stats.findByIdAndUpdate(stats._id, stats, { new: true }).then(updatedStats => {
      stats = updatedStats;
      saveStats();
      emitStats();
  });

  // -------------------- Match Rules --------------------
  let reply = null;

  for (let rule of RULES) {
    const targetUsers = rule.TARGET_USERS || "ALL";
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
      continue;
    }

    let patterns = rule.KEYWORDS.split("//").map(p => p.trim()).filter(Boolean);
    let match = false;

    if (rule.RULE_TYPE === "WELCOME") {
      if (!welcomedUsers.includes(sessionId)) {
        match = true;
        welcomedUsers.push(sessionId);
        saveWelcomedUsers();
        User.create({ sessionId });
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

  return reply || null;
}

// -------------------- Initial Load --------------------
(async () => {
    // Wait for MongoDB connection before syncing data and starting server
    await mongoose.connection.once('open', async () => {
        if (!fs.existsSync(statsFilePath) || !fs.existsSync(welcomedUsersFilePath) || !fs.existsSync(path.join(__dirname, "data", "funrules.json"))) {
            console.log("⚡ Creating initial JSON files...");
            fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
            fs.writeFileSync(statsFilePath, JSON.stringify({ totalUsers: [], todayUsers: [], totalMsgs: 0, todayMsgs: 0, nobiPapaHideMeUsers: [], lastResetDate: today }, null, 2));
            fs.writeFileSync(welcomedUsersFilePath, JSON.stringify([], null, 2));
            fs.writeFileSync(path.join(__dirname, "data", "funrules.json"), JSON.stringify({ rules: [] }, null, 2));
        }
        await syncData();
        scheduleDailyReset();
    });
})();

// -------------------- Watch data folder for updates --------------------
fs.watch(path.join(__dirname, "data"), (eventType, filename) => {
  if (filename.endsWith(".json") && filename !== "stats.json" && filename !== "welcomed_users.json") {
    console.log(`📂 ${filename} UPDATED, RELOADING...`);
    syncData(); // Calling syncData which in turn reloads rules
  }
});

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
