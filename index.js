// file: index.js

require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");
const app = express();
const PORT = process.env.PORT || 10000;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const server = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json({ limit: "1mb" }));

// Chat History Storage
let recentChatMessages = []; // Store last 10 chat messages globally
const MAX_CHAT_HISTORY = 10;

// NEW: Add a readiness flag
let isReady = false;

// MongoDB Connection & Models
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log("⚡ MongoDB connected successfully!"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// UPDATED: User model to remove the problematic 'email' field and set 'senderName' as unique.
const userSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: false },
    senderName: { type: String, required: true, unique: true }
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

// NEW: Mongoose model for global settings
const settingsSchema = new mongoose.Schema({
    settings_type: { type: String, required: true, unique: true }, // 'override_lists' or 'global_settings'
    settings_data: mongoose.Schema.Types.Mixed
});

const Settings = mongoose.model("Settings", settingsSchema);

// Persistent Stats
const statsFilePath = path.join(__dirname, "data", "stats.json");
const welcomedUsersFilePath = path.join(__dirname, "data", "welcomed_users.json");
const variablesFilePath = path.join(__dirname, "data", "variables.json");
const today = new Date().toLocaleDateString();

let stats;
let welcomedUsers;
let RULES = [];
let VARIABLES = [];

// NEW: Override lists
const ignoredOverrideUsersFile = path.join(__dirname, "data", "ignored_override_users.json");
const specificOverrideUsersFile = path.join(__dirname, "data", "specific_override_users.json");
let IGNORED_OVERRIDE_USERS = [];
let SPECIFIC_OVERRIDE_USERS = [];

// NEW: Repeating rule settings and last reply times
const settingsFilePath = path.join(__dirname, "data", "settings.json");
let settings = {
    preventRepeatingRule: {
        enabled: false,
        cooldown: 2
    },
    // NEW: Bot Online status
    isBotOnline: true
};
let lastReplyTimes = {}; // Stores { senderName: timestamp }

// Helper functions
async function loadAllRules() {
    RULES = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    console.log(`⚡ Loaded ${RULES.length} rules from MongoDB.`);
}

async function loadAllVariables() {
    VARIABLES = await Variable.find({});
    console.log(`⚡ Loaded ${VARIABLES.length} variables from MongoDB.`);
}

// NEW: Function to load settings from JSON files
async function loadSettingsFromFiles() {
    let loaded = false;
    if (fs.existsSync(ignoredOverrideUsersFile) && fs.existsSync(specificOverrideUsersFile)) {
        IGNORED_OVERRIDE_USERS = JSON.parse(fs.readFileSync(ignoredOverrideUsersFile, 'utf8'));
        SPECIFIC_OVERRIDE_USERS = JSON.parse(fs.readFileSync(specificOverrideUsersFile, 'utf8'));
        console.log(`🔍 Override users loaded from local files.`);
        loaded = true;
    }
    if (fs.existsSync(settingsFilePath)) {
        const fileContent = fs.readFileSync(settingsFilePath, 'utf8');
        try {
            const loadedSettings = JSON.parse(fileContent);
            settings = { ...settings, ...loadedSettings };
            console.log('⚙️ Settings loaded from local file.');
            loaded = true;
        } catch (e) {
            console.error('❌ Failed to parse settings.json:', e);
        }
    }
    return loaded;
}

// NEW: Function to restore settings from MongoDB and create local files
async function restoreSettingsFromDb() {
    const overrideSettings = await Settings.findOne({ settings_type: 'override_lists' });
    if (overrideSettings) {
        IGNORED_OVERRIDE_USERS = overrideSettings.settings_data.ignored || [];
        SPECIFIC_OVERRIDE_USERS = overrideSettings.settings_data.specific || [];
        fs.writeFileSync(ignoredOverrideUsersFile, JSON.stringify(IGNORED_OVERRIDE_USERS, null, 2));
        fs.writeFileSync(specificOverrideUsersFile, JSON.stringify(SPECIFIC_OVERRIDE_USERS, null, 2));
        console.log('✅ Override lists restored from MongoDB.');
    }

    const globalSettings = await Settings.findOne({ settings_type: 'global_settings' });
    if (globalSettings) {
        settings = { ...settings, ...globalSettings.settings_data };
        fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
        console.log('✅ Global settings restored from MongoDB.');
    }
}

// UPDATED: Centralized data sync function
const syncData = async () => {
    try {
        stats = await Stats.findOne();
        if (!stats) {
            stats = await Stats.create({ totalUsers: [], todayUsers: [], totalMsgs: 0, todayMsgs: 0, nobiPapaHideMeUsers: [], lastResetDate: today });
        }

        fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));

        const dbWelcomedUsers = await User.find({}, 'senderName');
        welcomedUsers = dbWelcomedUsers.map(u => u.senderName);
        fs.writeFileSync(welcomedUsersFilePath, JSON.stringify(welcomedUsers, null, 2));

        await loadAllRules();
        await loadAllVariables();

        // NEW: Load settings from files first, if not present, restore from DB
        const settingsLoaded = await loadSettingsFromFiles();
        if (!settingsLoaded) {
            console.log('⚠️ Settings files not found. Restoring from MongoDB...');
            await restoreSettingsFromDb();
        }

        if (stats.lastResetDate !== today) {
            stats.todayUsers = [];
            stats.todayMsgs = 0;
            stats.lastResetDate = today;
            await Stats.findByIdAndUpdate(stats._id, stats);
            fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
        }

        emitStats();
        
        // NEW: Set the flag to true after successful data sync
        isReady = true;
        console.log('✅ Server is ready to handle requests.');

    } catch (err) {
        console.error("❌ Data sync error:", err);
    }
};

function saveStats() {
    fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
}

function saveWelcomedUsers() {
    fs.writeFileSync(welcomedUsersFilePath, JSON.stringify(welcomedUsers, null, 2));
}

function saveVariables() {
    fs.writeFileSync(variablesFilePath, JSON.stringify(VARIABLES, null, 2));
}

// UPDATED: Functions to save override lists to files and then sync to MongoDB
async function saveIgnoredOverrideUsers() {
    fs.writeFileSync(ignoredOverrideUsersFile, JSON.stringify(IGNORED_OVERRIDE_USERS, null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'override_lists' },
        { 'settings_data.ignored': IGNORED_OVERRIDE_USERS, 'settings_data.specific': SPECIFIC_OVERRIDE_USERS },
        { upsert: true, new: true }
    );
}
async function saveSpecificOverrideUsers() {
    fs.writeFileSync(specificOverrideUsersFile, JSON.stringify(SPECIFIC_OVERRIDE_USERS, null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'override_lists' },
        { 'settings_data.ignored': IGNORED_OVERRIDE_USERS, 'settings_data.specific': SPECIFIC_OVERRIDE_USERS },
        { upsert: true, new: true }
    );
}

// UPDATED: Function to save global settings to a file and then sync to MongoDB
async function saveSettings() {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'global_settings' },
        { 'settings_data': settings },
        { upsert: true, new: true }
    );
}

const resetDailyStats = async () => {
    stats.todayUsers = [];
    stats.todayMsgs = 0;
    stats.lastResetDate = new Date().toLocaleDateString();
    await Stats.findByIdAndUpdate(stats._id, stats);
    saveStats();
};

const scheduleDailyReset = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(now.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    const timeUntilMidnight = midnight.getTime() - now.getTime();

    setTimeout(() => {
        resetDailyStats();
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

// Random generation logic
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

// NEW: Convert literal \n to actual newlines BEFORE saving to DB
function convertNewlinesBeforeSave(text) {
    if (!text) return '';
    return text.replace(/\\n/g, '\n');
}

// Updated smartSplitTokens logic
function smartSplitTokens(tokensString) {
    console.log(`🧩 Smart splitting tokens: "${tokensString}"`);
    // Split by comma followed by any whitespace, but only if not inside a variable.
    // This is handled by a simple regex now that the nested variables are placeholders.
    const tokens = tokensString.split(/,(?![^%]*%)/g).map(t => t.trim());
    console.log(`🎯 Total ${tokens.length} tokens found: [${tokens.join('] | [')}]`);
    return tokens.filter(t => t !== '');
}

function pickNUniqueRandomly(tokens, count) {
    const actualCount = Math.min(count, tokens.length);
    if (actualCount === 0) return [];

    if (actualCount === 1) {
        const selected = pick(tokens);
        console.log(`🎯 Single token selected: "${selected}"`);
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

    console.log(`🎯 Selected ${selectedTokens.length} tokens: [${selectedTokens.join('] | [')}]`);
    return selectedTokens;
}

// Updated resolveVariablesRecursively function
function resolveVariablesRecursively(text, maxIterations = 10) {
    let result = text;
    let iterationCount = 0;

    // Use a Map to store placeholders and original variable names
    const placeholderMap = new Map();
    let placeholderCounter = 0;

    // First, find all static and other random variables and replace them with placeholders
    const staticAndRandomRegex = /%(\w+)%/g;
    result = result.replace(staticAndRandomRegex, (match) => {
        const placeholder = `__VAR_PLACEHOLDER_${placeholderCounter++}__`;
        placeholderMap.set(placeholder, match);
        return placeholder;
    });

    while (iterationCount < maxIterations) {
        let hasVariables = false;
        let previousResult = result;

        // STEP 1: Process Custom Random Variables using placeholders
        const customRandomRegex = /%rndm_custom_(\d+)_([^%]+)%/g;
        result = result.replace(customRandomRegex, (fullMatch, countStr, tokensString) => {
            const count = parseInt(countStr, 10);
            console.log(`🎲 Processing custom random FIRST: count=${count}`);
            console.log(`🎲 Raw tokens string: "${tokensString}"`);

            const tokens = smartSplitTokens(tokensString);
            if (tokens.length === 0) {
                console.warn(`⚠️ No valid tokens found in: ${fullMatch}`);
                return '';
            }

            const selectedTokens = pickNUniqueRandomly(tokens, count);
            let finalResult = selectedTokens.join(' ');

            console.log(`✅ Custom random result: "${finalResult}"`);
            hasVariables = true;
            return finalResult;
        });

        if (result === previousResult) {
            break;
        }

        iterationCount++;
    }

    // Finally, resolve the placeholders
    for (const [placeholder, originalVariable] of placeholderMap.entries()) {
        const varName = originalVariable.replace(/%/g, '');
        let varValue = '';

        // Find the actual value for the original variable name
        const staticVar = VARIABLES.find(v => v.name === varName);
        if (staticVar) {
            varValue = staticVar.value;
        } else {
            // Check for other random variables here, since they were also replaced by placeholders
            const otherRandomRegex = /%rndm_(\w+)_(\w+)(?:_([^%]+))?%/;
            const match = originalVariable.match(otherRandomRegex);
            if (match) {
                const [fullMatch, type, param1, param2] = match;
                if (type === 'num') {
                    const [min, max] = param1.split('_').map(Number);
                    varValue = Math.floor(Math.random() * (max - min + 1)) + min;
                } else {
                    const length = parseInt(param1);
                    varValue = generateRandom(type, length);
                }
            }
        }

        result = result.split(placeholder).join(varValue);
    }

    console.log(`✅ Final resolved result completed`);
    return result;
}

// NEW FUNCTION: sender string ko parse karne ke liye
function extractSenderNameAndContext(sender) {
    let senderName = sender;
    let groupName = null;
    let isGroup = false;

    // Remove the admin username part, if it exists, using a regex pattern
    const adminPattern = /^\(.*\)\s*/;
    const cleanSender = sender.replace(adminPattern, '');

    // Check for "GC NAME: SENDER NAME" pattern
    const groupPattern = /^(.*):\s*(.*)$/;
    const match = cleanSender.match(groupPattern);

    if (match && match.length === 3) {
        groupName = match[1].trim();
        senderName = match[2].trim();
        isGroup = true;
    }

    return { senderName, groupName, isGroup };
}

// NEW: Pattern matching function for override lists
function matchesOverridePattern(senderName, patternList) {
    for (const pattern of patternList) {
        const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
        if (new RegExp(regexStr, 'i').test(senderName)) {
            return true;
        }
    }
    return false;
}

async function processMessage(msg, sessionId = "default", sender) {
    // NEW: Check if stats is loaded before accessing it
    if (!stats) {
        console.error('❌ Stats object is undefined. Cannot process message.');
        return null;
    }
    
    // NEW: Bot Online check
    if (!settings.isBotOnline) {
        console.log('🤖 Bot is offline. Skipping message processing.');
        return null;
    }

    const { senderName, isGroup, groupName } = extractSenderNameAndContext(sender);
    
    // Yahaan ab hum senderName aur isGroup ka use kar sakte hain
    console.log(`🔍 Processing message from: ${senderName} (Group: ${isGroup ? groupName : 'No'})`);

    // NEW: Cooldown check for repeating messages
    if (settings.preventRepeatingRule.enabled) {
        const lastTime = lastReplyTimes[senderName] || 0;
        const currentTime = Date.now();
        const cooldownMs = settings.preventRepeatingRule.cooldown * 1000;

        if (currentTime - lastTime < cooldownMs) {
            console.log(`⏳ Cooldown active for user: ${senderName}. Skipping reply.`);
            return null; // Return early, don't send a reply
        }
    }

    msg = msg.toLowerCase();

    // Update Stats
    if (!stats.totalUsers.includes(sessionId)) stats.totalUsers.push(sessionId);
    if (!stats.todayUsers.includes(sessionId)) stats.todayUsers.push(sessionId);
    stats.totalMsgs++;
    stats.todayMsgs++;

    if (msg.includes("nobi papa hide me") && !stats.nobiPapaHideMeUsers.includes(sessionId)) stats.nobiPapaHideMeUsers.push(sessionId);

    const updatedStats = await Stats.findByIdAndUpdate(stats._id, stats, { new: true });
    stats = updatedStats;
    saveStats();
    emitStats();

    // Match Rules
    let reply = null;

    for (let rule of RULES) {
        let userMatch = false;
        const targetUsers = rule.TARGET_USERS || "ALL";

        // NEW: Specific Override check (Highest Priority)
        if (SPECIFIC_OVERRIDE_USERS.length > 0 && matchesOverridePattern(senderName, SPECIFIC_OVERRIDE_USERS)) {
            console.log(`✅ Specific override match for user: ${senderName}`);
            userMatch = true;
        } else if (rule.RULE_TYPE === "IGNORED") {
            if (Array.isArray(targetUsers) && !targetUsers.includes(senderName)) {
                userMatch = true;
            }
        } else if (targetUsers === "ALL" || (Array.isArray(targetUsers) && targetUsers.includes(senderName))) {
            // NEW: Ignored Override check
            if (IGNORED_OVERRIDE_USERS.length > 0 && matchesOverridePattern(senderName, IGNORED_OVERRIDE_USERS)) {
                 console.log(`🚫 Ignored override match for user: ${senderName}`);
                userMatch = false;
            } else {
                userMatch = true;
            }
        }

        if (!userMatch) {
            continue;
        }

        let patterns = rule.KEYWORDS.split("//").map(p => p.trim()).filter(Boolean);
    
        // A rule can match on DM, Group, or both.
        // For 'WELCOME' and 'DEFAULT' rules, we will not need to parse pattern.
        // For others, a pattern can be 'DM_ONLY', 'GROUP_ONLY'
        // or a regex pattern to match a certain group name.
        let match = false;

        if (rule.RULE_TYPE === "WELCOME") {
            if (senderName && !welcomedUsers.includes(senderName)) {
                match = true;
                welcomedUsers.push(senderName);
                saveWelcomedUsers();
                await User.create({ senderName, sessionId });
            }
        } else if (rule.RULE_TYPE === "DEFAULT") {
            match = true;
        } else {
            for (let pattern of patterns) {
                // Check if rule is for DM only or Group only
                if (pattern.toUpperCase() === 'DM_ONLY' && isGroup) {
                    continue; // Skip rule if it's a DM_ONLY rule but the message is from a group
                } else if (pattern.toUpperCase() === 'GROUP_ONLY' && !isGroup) {
                    continue; // Skip rule if it's a GROUP_ONLY rule but the message is a DM
                }
                
                // Now, check for keyword matches
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

    // Process reply with variables (with proper order)
    if (reply) {
        console.log(`🔧 Processing reply with correct variable resolution order`);
        reply = resolveVariablesRecursively(reply);
        
        // NEW: Update last reply time if a reply is sent
        lastReplyTimes[senderName] = Date.now();
    }

    return reply || null;
}

// Socket.io connection with chat history
io.on('connection', (socket) => {
console.log('⚡ New client connected');

// Send recent chat history to new client immediately
if (recentChatMessages.length > 0) {
console.log(`📤 Sending ${recentChatMessages.length} recent messages to new client`);
socket.emit('chatHistory', recentChatMessages);
}

socket.on('disconnect', () => {
console.log('❌ Client disconnected');
});
});

// Initial Load
(async () => {
    await mongoose.connection.once('open', async () => {
        // PERMANENT FIX: Drop the old 'email_1' index if it exists
        try {
            await User.collection.dropIndex('email_1');
            console.log('✅ Old email_1 index dropped successfully.');
        } catch (error) {
            if (error.codeName !== 'IndexNotFound') {
                console.error('❌ Failed to drop old index:', error);
            } else {
                console.log('🔍 Old email_1 index not found, no action needed.');
            }
        }

        const dataDir = path.join(__dirname, "data");
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const files = [
            { path: path.join(dataDir, "stats.json"), content: { totalUsers: [], todayUsers: [], totalMsgs: 0, todayMsgs: 0, nobiPapaHideMeUsers: [], lastResetDate: today } },
            { path: path.join(dataDir, "welcomed_users.json"), content: [] },
            { path: path.join(dataDir, "funrules.json"), content: { rules: [] } },
            { path: path.join(dataDir, "variables.json"), content: [] }
        ];

        files.forEach(file => {
            if (!fs.existsSync(file.path)) {
                fs.writeFileSync(file.path, JSON.stringify(file.content, null, 2));
            }
        });

        await migrateOldSettings(); // NEW: Run migration logic
        
        await syncData();
        scheduleDailyReset();
    });
})();

// NEW ENDPOINT: Update ignored override users
app.post("/api/settings/ignored-override", async (req, res) => {
    try {
        const { users } = req.body;
        IGNORED_OVERRIDE_USERS = users.split(',').map(u => u.trim()).filter(Boolean);
        await saveIgnoredOverrideUsers();
        res.json({ success: true, message: "Ignored override users updated successfully." });
    } catch (error) {
        console.error("❌ Failed to update ignored override users:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// NEW ENDPOINT: Update specific override users
app.post("/api/settings/specific-override", async (req, res) => {
    try {
        const { users } = req.body;
        SPECIFIC_OVERRIDE_USERS = users.split(',').map(u => u.trim()).filter(Boolean);
        await saveSpecificOverrideUsers();
        res.json({ success: true, message: "Specific override users updated successfully." });
    } catch (error) {
        console.error("❌ Failed to update specific override users:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// NEW ENDPOINT: Get all settings
app.get("/api/settings", async (req, res) => {
    try {
        // NEW: Return settings from local files for faster loading
        const settingsData = {
            preventRepeatingRule: settings.preventRepeatingRule,
            isBotOnline: settings.isBotOnline,
            ignoredOverrideUsers: IGNORED_OVERRIDE_USERS,
            specificOverrideUsers: SPECIFIC_OVERRIDE_USERS
        };
        res.json(settingsData);
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// NEW ENDPOINT: Update repeating rule setting
app.post("/api/settings/prevent-repeating-rule", async (req, res) => {
    try {
        const { enabled, cooldown } = req.body;
        settings.preventRepeatingRule.enabled = enabled;
        settings.preventRepeatingRule.cooldown = cooldown;
        await saveSettings();
        res.json({ success: true, message: "Repeating rule setting updated successfully." });
    } catch (error) {
        console.error("❌ Failed to update repeating rule setting:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// NEW ENDPOINT: Update bot status
app.post("/api/bot/status", async (req, res) => {
    try {
        const { isOnline } = req.body;
        settings.isBotOnline = isOnline;
        await saveSettings();
        res.json({ success: true, message: `Bot status updated to ${isOnline ? 'online' : 'offline'}.` });
        console.log(`🤖 Bot status has been set to ${isOnline ? 'online' : 'offline'}.`);
    } catch (error) {
        console.error("❌ Failed to update bot status:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/api/rules/bulk-update", async (req, res) => {
const session = await mongoose.startSession();
try {
await session.withTransaction(async () => {
const { rules } = req.body;
if (!Array.isArray(rules) || rules.length === 0) {
throw new Error('Invalid rules data - must be an array');
}

const tempBulkOps = rules.map((rule, index) => ({
updateOne: {
filter: { _id: new mongoose.Types.ObjectId(rule._id) },
update: { $set: { RULE_NUMBER: -(index + 1000) } },
upsert: false
}
}));

if (tempBulkOps.length > 0) {
await Rule.bulkWrite(tempBulkOps, { session, ordered: true });
}

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
REPLY_TEXT: convertNewlinesBeforeSave(rule.REPLY_TEXT || ''),
TARGET_USERS: rule.TARGET_USERS || 'ALL'
}
},
upsert: false
}
}));

if (finalBulkOps.length > 0) {
const finalResult = await Rule.bulkWrite(finalBulkOps, { session, ordered: true });
if (finalResult.modifiedCount !== rules.length) {
throw new Error(`Expected ${rules.length} updates, but only ${finalResult.modifiedCount} succeeded`);
}
}
});

await session.endSession();
await loadAllRules();

const rulesFromDB = await Rule.find({}).sort({ RULE_NUMBER: 1 });
const jsonRules = { rules: rulesFromDB.map(r => r.toObject()) };
fs.writeFileSync(path.join(__dirname, "data", "funrules.json"), JSON.stringify(jsonRules, null, 2));

res.json({
success: true,
message: `${req.body.rules.length} rules reordered successfully`,
updatedCount: req.body.rules.length,
totalCount: req.body.rules.length
});

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
REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText),
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
REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText),
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
const processedVariable = {
name: variable.name,
value: convertNewlinesBeforeSave(variable.value)
};

if (type === "add") {
await Variable.create(processedVariable);
} else if (type === "edit") {
await Variable.findOneAndUpdate({ name: oldName }, processedVariable, { new: true });
} else if (type === "delete") {
await Variable.deleteOne({ name: variable.name });
}

await loadAllVariables();

const variablesFromDB = await Variable.find({});
fs.writeFileSync(variablesFilePath, JSON.stringify(variablesFromDB.map(v => v.toObject()), null, 2));

res.json({ success: true, message: "Variable updated successfully!" });
io.emit('variablesUpdated', { action: type, variableName: variable.name });

} catch (err) {
console.error("❌ Failed to update variable:", err);
res.status(500).json({ success: false, message: "Server error" });
}
});

app.post("/webhook", async (req, res) => {
    // NEW: Check if the server is ready before processing the request
    if (!isReady) {
        console.warn('⚠️ Server not ready. Rejecting incoming webhook.');
        return res.status(503).send('Server is initializing. Please try again in a moment.');
    }

    const sessionId = req.body.session_id || "default_session";
    const msg = req.body.query?.message || "";
    const sender = req.body.query?.sender || "";
    
    // Yahan hum sender string ko parse kar rahe hain
    const { senderName: parsedSenderName, isGroup, groupName } = extractSenderNameAndContext(sender);

    // NEW: Bot Online check added to webhook endpoint
    if (!settings.isBotOnline) {
        console.log('🤖 Bot is offline. Skipping message processing.');
        return res.json({ replies: [] });
    }

    const replyText = await processMessage(msg, sessionId, sender);

    // Create message object for history
    const messageData = {
        sessionId: sessionId,
        senderName: parsedSenderName,
        groupName: isGroup ? groupName : null,
        userMessage: msg,
        botReply: replyText,
        timestamp: new Date().toISOString()
    };

    // Add to recent messages array (newest first)
    recentChatMessages.unshift(messageData);

    // Keep only last 10 messages
    if (recentChatMessages.length > MAX_CHAT_HISTORY) {
        recentChatMessages = recentChatMessages.slice(0, MAX_CHAT_HISTORY);
    }

    console.log(`💬 Chat history updated. Total messages: ${recentChatMessages.length}`);

    // Emit real-time chat message to all connected clients
    io.emit('newMessage', messageData);

    if (!replyText) return res.json({ replies: [] });
    res.json({ replies: [{ message: replyText }] });
});

app.get("/stats", (req, res) => {
res.json({
totalUsers: stats.totalUsers.length,
totalMsgs: stats.totalMsgs,
todayUsers: stats.todayUsers.length,
todayMsgs: stats.todayMsgs,
nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
});
});

app.use(express.static("public"));

app.get("/ping", (req, res) => res.send("🏓 PING OK!"));

app.get("/", (req, res) => res.send("🤖 FRIENDLY CHAT BOT IS LIVE!"));

server.listen(PORT, () => console.log(`🤖 CHAT BOT RUNNING ON PORT ${PORT}`));

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