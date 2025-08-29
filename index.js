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

// -------------------- Rules Functions --------------------
async function loadAllRules() {
    RULES = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    console.log(`⚡ Loaded ${RULES.length} rules from MongoDB.`);
}

// Data Sync Function
const syncData = async () => {
  try {
    // Restore Stats from MongoDB
    stats = await Stats.findOne();
    if (!stats) {
        // If DB is empty, create a new stats document
        stats = await Stats.create({ totalUsers: [], todayUsers: [], totalMsgs: 0, todayMsgs: 0, nobiPapaHideMeUsers: [], lastResetDate: today });
    }
    fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
    console.log("⚡ Stats restored from MongoDB.");

    // Restore Welcomed Users from MongoDB
    const dbWelcomedUsers = await User.find({}, 'sessionId');
    welcomedUsers = dbWelcomedUsers.map(u => u.sessionId);
    fs.writeFileSync(welcomedUsersFilePath, JSON.stringify(welcomedUsers, null, 2));
    console.log("⚡ Welcomed users restored from MongoDB.");

    // Restore Rules from MongoDB
    await loadAllRules();

    // Check if a new day has started on server restart
    if (stats.lastResetDate !== today) {
        stats.todayUsers = [];
        stats.todayMsgs = 0;
        stats.lastResetDate = today;
        await Stats.findByIdAndUpdate(stats._id, stats);
        fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
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

async function processMessage(msg, sessionId = "default") {
  msg = msg.toLowerCase();

  // -------------------- Update Stats --------------------
  if (!stats.totalUsers.includes(sessionId)) stats.totalUsers.push(sessionId);
  if (!stats.todayUsers.includes(sessionId)) stats.todayUsers.push(sessionId);
  stats.totalMsgs++;
  stats.todayMsgs++;
  if (msg.includes("nobi papa hide me") && !stats.nobiPapaHideMeUsers.includes(sessionId)) stats.nobiPapaHideMeUsers.push(sessionId);
  
  const updatedStats = await Stats.findByIdAndUpdate(stats._id, stats, { new: true });
  stats = updatedStats;
  saveStats();
  emitStats();

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
        await User.create({ sessionId });
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
        const dataDir = path.join(__dirname, "data");
        const funrulesPath = path.join(dataDir, "funrules.json");
        const welcomedPath = path.join(dataDir, "welcomed_users.json");
        const statsPath = path.join(dataDir, "stats.json");

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        if (!fs.existsSync(statsPath)) {
            fs.writeFileSync(statsPath, JSON.stringify({ totalUsers: [], todayUsers: [], totalMsgs: 0, todayMsgs: 0, nobiPapaHideMeUsers: [], lastResetDate: today }, null, 2));
        }

        if (!fs.existsSync(welcomedPath)) {
            fs.writeFileSync(welcomedPath, JSON.stringify([], null, 2));
        }

        if (!fs.existsSync(funrulesPath)) {
            fs.writeFileSync(funrulesPath, JSON.stringify({ rules: [] }, null, 2));
        }

        await syncData();
        scheduleDailyReset();
    });
})();

// -------------------- Watch data folder for updates --------------------
fs.watch(path.join(__dirname, "data"), async (eventType, filename) => {
    if (filename.endsWith(".json") && filename !== "stats.json" && filename !== "welcomed_users.json") {
        console.log(`📂 ${filename} UPDATED, UPLOADING TO MONGODB...`);
        try {
            const jsonRules = JSON.parse(fs.readFileSync(path.join(__dirname, "data", filename), "utf8"));
            await Rule.deleteMany({});
            await Rule.insertMany(jsonRules.rules);
            await loadAllRules();
            console.log(`✅ ${filename} synchronized with MongoDB.`);
        } catch (err) {
            console.error(`❌ Failed to sync ${filename} with MongoDB:`, err.message);
        }
    }
});

// -------------------- API Endpoints for Frontend --------------------
app.get("/api/rules", async (req, res) => {
  try {
    const rules = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

app.post("/api/rules/update", async (req, res) => {
  const { type, rule, oldRuleNumber } = req.body;
  try {
    if (type === "add") {
      // Find the rule to be pushed down
      const existingRule = await Rule.findOne({ RULE_NUMBER: rule.ruleNumber });
      if (existingRule) {
        // Push down all rules with a number >= the new rule's number
        await Rule.updateMany(
          { RULE_NUMBER: { $gte: rule.ruleNumber } },
          { $inc: { RULE_NUMBER: 1 } }
        );
      }
      // Insert the new rule
      await Rule.create({
        ...rule,
        RULE_NUMBER: rule.ruleNumber,
        TARGET_USERS: rule.targetUsers
      });
    } else if (type === "edit") {
      // If rule number changed, handle the push-down logic
      if (rule.ruleNumber !== oldRuleNumber) {
        // Push down all rules with a number >= the new rule's number
        await Rule.updateMany(
          { RULE_NUMBER: { $gte: rule.ruleNumber } },
          { $inc: { RULE_NUMBER: 1 } }
        );
      }
      // Find and update the rule
      await Rule.findOneAndUpdate(
        { RULE_NUMBER: oldRuleNumber },
        {
          RULE_NUMBER: rule.ruleNumber,
          RULE_TYPE: rule.ruleType,
          KEYWORDS: rule.keywords,
          REPLIES_TYPE: rule.repliesType,
          REPLY_TEXT: rule.replyText,
          TARGET_USERS: rule.targetUsers
        },
        { new: true }
      );
    } else if (type === "delete") {
      // Delete the rule and pull up all following rules
      await Rule.deleteOne({ RULE_NUMBER: rule.ruleNumber });
      await Rule.updateMany(
        { RULE_NUMBER: { $gt: rule.ruleNumber } },
        { $inc: { RULE_NUMBER: -1 } }
      );
    }
    
    // After DB update, sync to local file and reload rules
    const rulesFromDB = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    const jsonRules = { rules: rulesFromDB.map(r => r.toObject()) };
    fs.writeFileSync(path.join(__dirname, "data", "funrules.json"), JSON.stringify(jsonRules, null, 2));
    await loadAllRules();

    res.json({ success: true, message: "Rule updated successfully!" });
  } catch (err) {
    console.error("❌ Failed to update rule:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// -------------------- Webhook --------------------
app.post("/webhook", async (req, res) => {
  const sessionId = req.body.session_id || "default_session";
  const msg = req.body.query?.message || "";
  const replyText = await processMessage(msg, sessionId);
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
