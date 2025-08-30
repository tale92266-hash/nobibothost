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
  RULE_NAME: { type: String, required: false },
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

const variableSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  value: { type: String, required: true }
});
const Variable = mongoose.model("Variable", variableSchema);

// -------------------- Persistent Stats --------------------
const statsFilePath = path.join(__dirname, "data", "stats.json");
const welcomedUsersFilePath = path.join(__dirname, "data", "welcomed_users.json");
const variablesFilePath = path.join(__dirname, "data", "variables.json");
const today = new Date().toLocaleDateString();

let stats;
let welcomedUsers;
let RULES = [];
let VARIABLES = [];

// -------------------- Rules Functions --------------------
async function loadAllRules() {
    RULES = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    console.log(`⚡ Loaded ${RULES.length} rules from MongoDB.`);
}

async function loadAllVariables() {
    VARIABLES = await Variable.find({});
    console.log(`⚡ Loaded ${VARIABLES.length} variables from MongoDB.`);
}

// Data Sync Function
const syncData = async () => {
  try {
    // Restore Stats from MongoDB
    stats = await Stats.findOne();
    if (!stats) {
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

    // Restore Variables from MongoDB
    await loadAllVariables();

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

function saveVariables() {
  fs.writeFileSync(variablesFilePath, JSON.stringify(VARIABLES, null, 2));
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

// Random variable generation logic
const charSets = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  num: '0123456789',
  grawlix: '#$%&@*!'
};

function generateRandom(type, length, customSet) {
  if (type === 'custom' && customSet) {
    return pick(customSet);
  }

  let result = '';
  let characters = '';

  if (type === 'num') characters = charSets.num;
  else if (type === 'lower') characters = charSets.lower;
  else if (type === 'upper') characters = charSets.upper;
  else if (type === 'abc') characters = charSets.lower + charSets.upper;
  else if (type === 'abcnum_lower') characters = charSets.lower + charSets.num;
  else if (type === 'abcnum_upper') characters = charSets.upper + charSets.num;
  else if (type === 'abcnum') characters = charSets.lower + charSets.upper + charSets.num;
  else if (type === 'grawlix') characters = charSets.grawlix;
  else if (type === 'ascii') {
    for (let i = 0; i < length; i++) {
        result += String.fromCharCode(Math.floor(Math.random() * (127 - 33 + 1)) + 33);
    }
    return result;
  }
  
  if (!characters) return '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// TARGETED: Convert \n to newlines ONLY for specific contexts
function convertNewlinesInText(text) {
  if (!text) return '';
  // Convert literal \n to actual newlines
  return text.replace(/\\n/g, '\n');
}

// Smart Token Splitting (NO \n conversion here)
function smartSplitTokens(tokensString) {
  const tokens = [];
  let current = '';
  let percentCount = 0;
  
  console.log(`🧩 Splitting tokens from: "${tokensString}"`);
  
  for (let i = 0; i < tokensString.length; i++) {
    const char = tokensString[i];
    
    if (char === '%') {
      percentCount++;
      current += char;
    }
    else if (char === ',' && percentCount % 2 === 0) {
      if (current.trim().length > 0) {
        tokens.push(current.trim());
      }
      current = '';
    }
    else {
      current += char;
    }
  }
  
  if (current.trim().length > 0) {
    tokens.push(current.trim());
  }
  
  console.log(`🎯 Total tokens found: ${tokens.length}`);
  return tokens;
}

function pickNUniqueRandomly(tokens, count) {
  const actualCount = Math.min(count, tokens.length);
  
  if (actualCount === 0) return [];
  if (actualCount === 1) {
    const selected = pick(tokens);
    console.log(`🎯 Single token picked: "${selected}"`);
    return [selected];
  }
  
  const availableTokens = [...tokens];
  const selectedTokens = [];
  
  for (let i = 0; i < actualCount; i++) {
    if (availableTokens.length === 0) break;
    
    const randomIndex = Math.floor(Math.random() * availableTokens.length);
    const selectedToken = availableTokens[randomIndex];
    
    selectedTokens.push(selectedToken);
    availableTokens.splice(randomIndex, 1);
  }
  
  console.log(`🎯 Picked ${selectedTokens.length} tokens: [${selectedTokens.join('] | [')}]`);
  return selectedTokens;
}

// UPDATED: Selective \n conversion - ONLY in variable values
function resolveVariablesRecursively(text, maxIterations = 10) {
  let result = text;
  let iterationCount = 0;

  while (iterationCount < maxIterations) {
    let hasVariables = false;
    let previousResult = result;
    
    console.log(`🔄 Variable resolution iteration ${iterationCount + 1}: "${result}"`);
    
    // 1. Replace static variables (CONVERT \n HERE)
    for (const variable of VARIABLES) {
      const varRegex = new RegExp(`%${variable.name}%`, 'g');
      if (varRegex.test(result)) {
        // ✅ APPLY \n CONVERSION ONLY TO VARIABLE VALUES
        const processedValue = convertNewlinesInText(variable.value);
        result = result.replace(varRegex, processedValue);
        hasVariables = true;
        console.log(`✅ Replaced %${variable.name}% with processed value (with newlines)`);
      }
    }

    // 2. Process Custom Random Variables (NO \n conversion in regex processing)
    const customRandomRegex = /%rndm_custom_(\d+)_([^%]+)%/g;
    
    result = result.replace(customRandomRegex, (fullMatch, countStr, tokensString) => {
      const count = parseInt(countStr, 10);
      
      console.log(`🎲 Processing custom random: count=${count}`);
      
      const tokens = smartSplitTokens(tokensString);
      
      if (tokens.length === 0) {
        console.warn(`⚠️ No valid tokens found in: ${fullMatch}`);
        return '';
      }
      
      const selectedTokens = pickNUniqueRandomly(tokens, count);
      let finalResult;
      
      if (count === 1) {
        finalResult = selectedTokens[0] || '';
      } else {
        finalResult = selectedTokens.join(' ');
      }
      
      // NO \n conversion here - tokens will be processed when variables inside them are resolved
      
      console.log(`✅ Selected result (no newline processing): "${finalResult}"`);
      
      hasVariables = true;
      return finalResult;
    });

    // 3. Handle other random variables (NO \n conversion)
    const otherRandomRegex = /%rndm_(\w+)_(\w+)(?:_([^%]+))?%/g;
    
    result = result.replace(otherRandomRegex, (match, type, param1, param2) => {
      if (type === 'custom') {
        return match; // Skip custom (already handled)
      }
      
      let value;
      
      if (type === 'num') {
        const [min, max] = param1.split('_').map(Number);
        value = Math.floor(Math.random() * (max - min + 1)) + min;
      } else {
        const length = parseInt(param1);
        value = generateRandom(type, length);
      }
      
      hasVariables = true;
      return value;
    });
    
    if (result === previousResult) {
      break;
    }
    
    iterationCount++;
  }
  
  // ❌ NO GLOBAL \n CONVERSION AT THE END - only in variable values
  
  console.log(`✅ Final resolved result (selective newline processing)`);
  return result;
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
    let userMatch = false;
    const targetUsers = rule.TARGET_USERS || "ALL";

    if (rule.RULE_TYPE === "IGNORED") {
      if (Array.isArray(targetUsers) && !targetUsers.includes(sessionId)) {
        userMatch = true;
      }
    } else if (targetUsers === "ALL" || (Array.isArray(targetUsers) && targetUsers.includes(sessionId))) {
      userMatch = true;
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
      if (rule.REPLIES_TYPE === "ALL") {
        replies = replies.slice(0, 20);
        reply = replies.join(" ");
      } else if (rule.REPLIES_TYPE === "ONE") {
        reply = replies[0];
      } else {
        reply = pick(replies);
      }
      break;
    }
  }

  // TARGETED: Apply \n conversion ONLY to reply text
  if (reply) {
    console.log(`🔧 Processing reply with selective newline support`);
    
    // ✅ CONVERT \n IN REPLY TEXT BEFORE VARIABLE PROCESSING
    reply = convertNewlinesInText(reply);
    
    // Then process variables (which will have their own \n conversion)
    reply = resolveVariablesRecursively(reply);
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
        const variablesPath = path.join(dataDir, "variables.json");

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

        if (!fs.existsSync(variablesPath)) {
            fs.writeFileSync(variablesPath, JSON.stringify([], null, 2));
        }

        await syncData();
        scheduleDailyReset();
    });
})();

// -------------------- FIXED: Atomic Bulk Update with Temporary Numbers --------------------
app.post("/api/rules/bulk-update", async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { rules } = req.body;
      
      if (!Array.isArray(rules) || rules.length === 0) {
        throw new Error('Invalid rules data - must be an array');
      }
      
      console.log(`📝 Starting ATOMIC bulk update for ${rules.length} rules`);
      
      // Validate each rule has required fields
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (!rule._id) {
          throw new Error(`Rule at index ${i} missing _id field`);
        }
        if (!rule.RULE_NUMBER || !rule.RULE_TYPE) {
          throw new Error(`Rule at index ${i} missing required fields`);
        }
      }
      
      // STEP 1: Temporarily assign negative numbers to avoid conflicts
      console.log('🔄 Step 1: Assigning temporary negative numbers to avoid conflicts');
      const tempBulkOps = rules.map((rule, index) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(rule._id) },
          update: { 
            $set: { 
              RULE_NUMBER: -(index + 1000) // Use large negative numbers
            } 
          },
          upsert: false
        }
      }));
      
      if (tempBulkOps.length > 0) {
        const tempResult = await Rule.bulkWrite(tempBulkOps, { session, ordered: true });
        console.log(`✅ Step 1 complete: ${tempResult.modifiedCount} rules assigned temporary numbers`);
      }
      
      // STEP 2: Assign final rule numbers (no conflicts now)
      console.log('🔄 Step 2: Assigning final rule numbers');
      const finalBulkOps = rules.map(rule => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(rule._id) },
          update: { 
            $set: { 
              RULE_NUMBER: rule.RULE_NUMBER,
              RULE_NAME: rule.RULE_NAME || '',
              RULE_TYPE: rule.RULE_TYPE,
              KEYWORDS: rule.KEYWORDS || '',
              REPLIES_TYPE: rule.REPLIES_TYPE,
              REPLY_TEXT: rule.REPLY_TEXT || '',
              TARGET_USERS: rule.TARGET_USERS || 'ALL'
            } 
          },
          upsert: false
        }
      }));
      
      if (finalBulkOps.length > 0) {
        const finalResult = await Rule.bulkWrite(finalBulkOps, { session, ordered: true });
        console.log(`✅ Step 2 complete: ${finalResult.modifiedCount} rules updated with final numbers`);
        
        if (finalResult.modifiedCount !== rules.length) {
          throw new Error(`Expected ${rules.length} updates, but only ${finalResult.modifiedCount} succeeded`);
        }
      }
    });
    
    await session.endSession();
    
    // Update local data structures
    console.log(`🔄 Refreshing data structures...`);
    await loadAllRules();
    const rulesFromDB = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    const jsonRules = { rules: rulesFromDB.map(r => r.toObject()) };
    fs.writeFileSync(path.join(__dirname, "data", "funrules.json"), JSON.stringify(jsonRules, null, 2));
    
    console.log(`✅ Successfully updated ${req.body.rules.length} rules atomically`);
    console.log(`📊 Final rules order: ${RULES.map(r => r.RULE_NUMBER).join(', ')}`);
    
    res.json({ 
      success: true, 
      message: `${req.body.rules.length} rules reordered successfully using atomic transaction`,
      updatedCount: req.body.rules.length,
      totalCount: req.body.rules.length
    });
    
    // Emit socket event for real-time updates
    io.emit('rulesUpdated', { 
      action: 'bulk_reorder_atomic', 
      count: req.body.rules.length,
      newOrder: RULES.map(r => ({ id: r._id, number: r.RULE_NUMBER, name: r.RULE_NAME }))
    });
    
  } catch (error) {
    console.error('❌ Atomic bulk update failed:', error);
    
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    await session.endSession();
    
    res.json({ 
      success: false, 
      message: 'Failed to reorder rules atomically: ' + error.message 
    });
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
      const existingRule = await Rule.findOne({ RULE_NUMBER: rule.ruleNumber });
      if (existingRule) {
        await Rule.updateMany(
          { RULE_NUMBER: { $gte: rule.ruleNumber } },
          { $inc: { RULE_NUMBER: 1 } }
        );
      }
      await Rule.create({
        RULE_NUMBER: rule.ruleNumber,
        RULE_NAME: rule.ruleName,
        RULE_TYPE: rule.ruleType,
        KEYWORDS: rule.keywords,
        REPLIES_TYPE: rule.repliesType,
        REPLY_TEXT: rule.replyText,
        TARGET_USERS: rule.targetUsers
      });
    } else if (type === "edit") {
      if (rule.ruleNumber !== oldRuleNumber) {
        if (rule.ruleNumber < oldRuleNumber) {
            await Rule.updateMany(
                { RULE_NUMBER: { $gte: rule.ruleNumber, $lt: oldRuleNumber } },
                { $inc: { RULE_NUMBER: 1 } }
            );
        } else {
            await Rule.updateMany(
                { RULE_NUMBER: { $gt: oldRuleNumber, $lte: rule.ruleNumber } },
                { $inc: { RULE_NUMBER: -1 } }
            );
        }
      }
      await Rule.findOneAndUpdate(
        { RULE_NUMBER: oldRuleNumber },
        {
          RULE_NUMBER: rule.ruleNumber,
          RULE_NAME: rule.ruleName,
          RULE_TYPE: rule.ruleType,
          KEYWORDS: rule.keywords,
          REPLIES_TYPE: rule.repliesType,
          REPLY_TEXT: rule.replyText,
          TARGET_USERS: rule.targetUsers
        },
        { new: true }
      );
    } else if (type === "delete") {
      await Rule.deleteOne({ RULE_NUMBER: rule.ruleNumber });
      await Rule.updateMany(
        { RULE_NUMBER: { $gt: rule.ruleNumber } },
        { $inc: { RULE_NUMBER: -1 } }
      );
    }
    
    const rulesFromDB = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    const jsonRules = { rules: rulesFromDB.map(r => r.toObject()) };
    fs.writeFileSync(path.join(__dirname, "data", "funrules.json"), JSON.stringify(jsonRules, null, 2));
    await loadAllRules();

    res.json({ success: true, message: "Rule updated successfully!" });
    
    // Emit socket event
    io.emit('rulesUpdated', { action: type, ruleNumber: rule.ruleNumber });
    
  } catch (err) {
    console.error("❌ Failed to update rule:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/variables", async (req, res) => {
  try {
    const variables = await Variable.find({});
    res.json(variables);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch variables" });
  }
});

app.post("/api/variables/update", async (req, res) => {
  const { type, variable, oldName } = req.body;
  try {
    if (type === "add") {
      await Variable.create(variable);
    } else if (type === "edit") {
      await Variable.findOneAndUpdate({ name: oldName }, variable, { new: true });
    } else if (type === "delete") {
      await Variable.deleteOne({ name: variable.name });
    }
    
    await loadAllVariables();
    const variablesFromDB = await Variable.find({});
    fs.writeFileSync(variablesFilePath, JSON.stringify(variablesFromDB.map(v => v.toObject()), null, 2));

    res.json({ success: true, message: "Variable updated successfully!" });
    
    // Emit socket event
    io.emit('variablesUpdated', { action: type, variableName: variable.name });
    
  } catch (err) {
    console.error("❌ Failed to update variable:", err);
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
