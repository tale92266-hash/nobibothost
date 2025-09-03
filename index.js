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
let recentChatMessages = [];
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

// NEW: Owner Rule Schema
const ownerRuleSchema = new mongoose.Schema({
    RULE_NUMBER: { type: Number, required: true, unique: true },
    RULE_NAME: { type: String, required: false },
    RULE_TYPE: { type: String, required: true },
    KEYWORDS: { type: String, required: true },
    REPLIES_TYPE: { type: String, required: true },
    REPLY_TEXT: { type: String, required: true }
});


const Rule = mongoose.model("Rule", ruleSchema);
const OwnerRule = mongoose.model("OwnerRule", ownerRuleSchema);

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
    settings_type: { type: String, required: true, unique: true },
    settings_data: mongoose.Schema.Types.Mixed
});

const Settings = mongoose.model("Settings", settingsSchema);

// NEW: Schema for user-specific message and reply counts
const messageStatsSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    senderName: { type: String, required: true },
    isGroup: { type: Boolean, required: true },
    groupName: { type: String },
    receivedCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    // For %reply_count_0% variable
    ruleReplyCounts: {
        type: Map,
        of: Number,
        default: {}
    },
    // For daily stats
    lastActiveDate: { type: String }
});

const MessageStats = mongoose.model("MessageStats", messageStatsSchema);


// Persistent Stats
const statsFilePath = path.join(__dirname, "data", "stats.json");
const welcomedUsersFilePath = path.join(__dirname, "data", "welcomed_users.json");
const variablesFilePath = path.join(__dirname, "data", "variables.json");
const today = new Date().toLocaleDateString();

let stats;
let welcomedUsers;
let RULES = [];
let OWNER_RULES = [];
let VARIABLES = [];
// NEW: In-memory history for previous message/reply variables
let messageHistory = [];
const MAX_HISTORY = 50;

// NEW: Override lists
const ignoredOverrideUsersFile = path.join(__dirname, "data", "ignored_override_users.json");
const specificOverrideUsersFile = path.join(__dirname, "data", "specific_override_users.json");
// NEW: Owner list file path
const ownersListFile = path.join(__dirname, "data", "owner_list.json");

let IGNORED_OVERRIDE_USERS = [];
let SPECIFIC_OVERRIDE_USERS = [];
// NEW: Owner list array
let OWNER_LIST = [];

// NEW: Repeating rule settings and last reply times
const settingsFilePath = path.join(__dirname, "data", "settings.json");
const ownerRulesFilePath = path.join(__dirname, "data", "owner_rules.json");

let settings = {
    preventRepeatingRule: {
        enabled: false,
        cooldown: 2
    },
    // NEW: Bot Online status
    isBotOnline: true,
    // NEW: Temporary Hide and Unhide settings
    temporaryHide: {
        enabled: false,
        matchType: 'EXACT',
        triggerText: 'nobi papa hide me',
        unhideEnabled: true,
        unhideTriggerText: 'nobi papa start',
        unhideMatchType: 'EXACT',
        // UPDATED: Add multiple replies for hide and unhide triggers
        hideReply: 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.',
        unhideReply: 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.'
    }
};
let lastReplyTimes = {};

// Helper functions
async function loadAllRules() {
    RULES = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    console.log(`⚡ Loaded ${RULES.length} rules from MongoDB.`);
}
// NEW: Function to load owner rules from MongoDB
async function loadAllOwnerRules() {
    OWNER_RULES = await OwnerRule.find({}).sort({ RULE_NUMBER: 1 });
    console.log(`⚡ Loaded ${OWNER_RULES.length} owner rules from MongoDB.`);
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
    // NEW: Load owner list from file
    if (fs.existsSync(ownersListFile)) {
        OWNER_LIST = JSON.parse(fs.readFileSync(ownersListFile, 'utf8'));
        console.log(`👑 Owner list loaded from local file.`);
        loaded = true;
    }
    if (fs.existsSync(settingsFilePath)) {
        const fileContent = fs.readFileSync(settingsFilePath, 'utf8');
        try {
            const loadedSettings = JSON.parse(fileContent);
            settings = { ...settings, ...loadedSettings };
            // Ensure temporaryHide sub-object exists and has default values
            if (!settings.temporaryHide) {
                settings.temporaryHide = {
                    enabled: false,
                    matchType: 'EXACT',
                    triggerText: 'nobi papa hide me',
                    unhideEnabled: true,
                    unhideTriggerText: 'nobi papa start',
                    unhideMatchType: 'EXACT',
                    hideReply: 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.',
                    unhideReply: 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.'
                };
            }
            if (settings.temporaryHide.unhideEnabled === undefined) {
                settings.temporaryHide.unhideEnabled = true;
            }
            if (settings.temporaryHide.unhideTriggerText === undefined) {
                settings.temporaryHide.unhideTriggerText = 'nobi papa start';
            }
            if (settings.temporaryHide.unhideMatchType === undefined) {
                settings.temporaryHide.unhideMatchType = 'EXACT';
            }
            // NEW: Ensure reply fields exist with default values
            if (settings.temporaryHide.hideReply === undefined) {
                settings.temporaryHide.hideReply = 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.';
            }
            if (settings.temporaryHide.unhideReply === undefined) {
                settings.temporaryHide.unhideReply = 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.';
            }
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
        // NEW: Restore owner list
        OWNER_LIST = overrideSettings.settings_data.owners || [];
        fs.writeFileSync(ignoredOverrideUsersFile, JSON.stringify(IGNORED_OVERRIDE_USERS, null, 2));
        fs.writeFileSync(specificOverrideUsersFile, JSON.stringify(SPECIFIC_OVERRIDE_USERS, null, 2));
        fs.writeFileSync(ownersListFile, JSON.stringify(OWNER_LIST, null, 2));
        console.log('✅ Override lists restored from MongoDB.');
    }

    const globalSettings = await Settings.findOne({ settings_type: 'global_settings' });
    if (globalSettings) {
        settings = { ...settings, ...globalSettings.settings_data };
        // Ensure temporaryHide sub-object exists and has default values
        if (!settings.temporaryHide) {
            settings.temporaryHide = {
                enabled: false,
                matchType: 'EXACT',
                triggerText: 'nobi papa hide me',
                unhideEnabled: true,
                unhideTriggerText: 'nobi papa start',
                unhideMatchType: 'EXACT',
                hideReply: 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.',
                unhideReply: 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.'
            };
        }
        if (settings.temporaryHide.unhideEnabled === undefined) {
            settings.temporaryHide.unhideEnabled = true;
        }
        if (settings.temporaryHide.unhideTriggerText === undefined) {
            settings.temporaryHide.unhideTriggerText = 'nobi papa start';
        }
        if (settings.temporaryHide.unhideMatchType === undefined) {
            settings.temporaryHide.unhideMatchType = 'EXACT';
        }
        // NEW: Ensure reply fields exist with default values
        if (settings.temporaryHide.hideReply === undefined) {
            settings.temporaryHide.hideReply = 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.';
        }
        if (settings.temporaryHide.unhideReply === undefined) {
            settings.temporaryHide.unhideReply = 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.';
        }
        fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
        console.log('✅ Global settings restored from MongoDB.');
    }
}

// MOVED TO GLOBAL SCOPE
const migrateOldSettings = async () => {
    // Migrate override users
    if (fs.existsSync(ignoredOverrideUsersFile) || fs.existsSync(specificOverrideUsersFile)) {
        const ignored = fs.existsSync(ignoredOverrideUsersFile) ? JSON.parse(fs.readFileSync(ignoredOverrideUsersFile, 'utf8')) : [];
        const specific = fs.existsSync(specificOverrideUsersFile) ? JSON.parse(fs.readFileSync(specificOverrideUsersFile, 'utf8')) : [];
        // NEW: Migrate owners list
        const owners = fs.existsSync(ownersListFile) ? JSON.parse(fs.readFileSync(ownersListFile, 'utf8')) : [];

        await Settings.findOneAndUpdate(
            { settings_type: 'override_lists' },
            { settings_data: { ignored, specific, owners } },
            { upsert: true, new: true }
        );
        console.log('✅ Old override lists migrated to MongoDB.');
        // Clean up old files
        fs.unlinkSync(ignoredOverrideUsersFile);
        fs.unlinkSync(specificOverrideUsersFile);
        fs.unlinkSync(ownersListFile);
    }

    // Migrate global settings
    if (fs.existsSync(settingsFilePath)) {
        const oldSettings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
        await Settings.findOneAndUpdate(
            { settings_type: 'global_settings' },
            { settings_data: oldSettings },
            { upsert: true, new: true }
        );
        console.log('✅ Old global settings migrated to MongoDB.');
        // Clean up old file
        fs.unlinkSync(settingsFilePath);
    }
};

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
        // NEW: Load owner rules
        await loadAllOwnerRules();
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
// NEW: Function to save owner rules to file
async function saveOwnerRules() {
    const ownerRulesFromDB = await OwnerRule.find({});
    fs.writeFileSync(ownerRulesFilePath, JSON.stringify({ rules: ownerRulesFromDB.map(r => r.toObject()) }, null, 2));
}
// UPDATED: Functions to save override lists to files and then sync to MongoDB
async function saveIgnoredOverrideUsers() {
    fs.writeFileSync(ignoredOverrideUsersFile, JSON.stringify(IGNORED_OVERRIDE_USERS, null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'override_lists' },
        { 'settings_data.ignored': IGNORED_OVERRIDE_USERS, 'settings_data.specific': SPECIFIC_OVERRIDE_USERS, 'settings_data.owners': OWNER_LIST },
        { upsert: true, new: true }
    );
}
async function saveSpecificOverrideUsers() {
    fs.writeFileSync(specificOverrideUsersFile, JSON.stringify(SPECIFIC_OVERRIDE_USERS, null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'override_lists' },
        { 'settings_data.ignored': IGNORED_OVERRIDE_USERS, 'settings_data.specific': SPECIFIC_OVERRIDE_USERS, 'settings_data.owners': OWNER_LIST },
        { upsert: true, new: true }
    );
}
// NEW: Function to save owners list to files and then sync to MongoDB
async function saveOwnersList() {
    fs.writeFileSync(ownersListFile, JSON.stringify(OWNER_LIST, null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'override_lists' },
        { 'settings_data.ignored': IGNORED_OVERRIDE_USERS, 'settings_data.specific': SPECIFIC_OVERRIDE_USERS, 'settings_data.owners': OWNER_LIST },
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

// NEW: Convert literal \n to actual newlines BEFORE saving to DB
function convertNewlinesBeforeSave(text) {
    if (!text) return '';
    return text.replace(/\\n/g, '\n');
}

// UPDATED: resolveVariablesRecursively function with all new variables
function resolveVariablesRecursively(text, senderName, receivedMessage, processingTime, groupName, isGroup, regexMatch = null, matchedRuleId = null, totalMsgs = 0, messageStats = null, maxIterations = 10) {
    let result = text;
    let iterationCount = 0;

    const lowerCaseAlphabet = 'abcdefghijklmnopqrstuvwxyz';
    const upperCaseAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
    const grawlixes = '#$%&@*!';
    
    while (iterationCount < maxIterations) {
        const initialResult = result;
        
        // Pass 1: Resolve new variables first, as they are most specific
        result = result.replace(/%message(?:_(\d+))?%/g, (match, maxLength) => {
            const message = receivedMessage || '';
            if (maxLength) {
                return message.substring(0, parseInt(maxLength, 10));
            }
            return message;
        });

        // Previous message variables
        result = result.replace(/%prev_message_(\d+)(?:,(\d+))?_(\d+)(?:_(\d+))?%/g, (match, ruleId1, ruleId2, offset, maxLength) => {
            const ruleIds = [ruleId1, ruleId2].filter(Boolean).map(id => parseInt(id, 10));
            const historyOffset = parseInt(offset, 10);
            
            const filteredHistory = messageHistory.filter(item => {
                if (!item.ruleId) return ruleIds.includes(0);
                return ruleIds.includes(item.ruleId);
            });
            
            if (historyOffset < filteredHistory.length) {
                let message = filteredHistory[historyOffset].userMessage;
                if (maxLength) {
                    message = message.substring(0, parseInt(maxLength, 10));
                }
                return message;
            }
            return match;
        });
        
        // Previous reply variables
        result = result.replace(/%prev_reply_(\d+)(?:,(\d+))?_(\d+)(?:_(\d+))?%/g, (match, ruleId1, ruleId2, offset, maxLength) => {
            const ruleIds = [ruleId1, ruleId2].filter(Boolean).map(id => parseInt(id, 10));
            const historyOffset = parseInt(offset, 10);

            const filteredHistory = messageHistory.filter(item => {
                if (!item.ruleId) return ruleIds.includes(0);
                return ruleIds.includes(item.ruleId);
            });

            if (historyOffset < filteredHistory.length) {
                let reply = filteredHistory[historyOffset].botReply;
                if (maxLength) {
                    reply = reply.substring(0, parseInt(maxLength, 10));
                }
                return reply;
            }
            return match;
        });
        
        // Processing time variable
        result = result.replace(/%processing_time%/g, () => processingTime.toString());

        // Date & Time variables (extended)
        const now = new Date();
        const istOptions = { timeZone: 'Asia/Kolkata' };

        result = result.replace(/%day_of_month_short%/g, now.getDate());
        result = result.replace(/%day_of_month%/g, now.toLocaleString('en-IN', { day: '2-digit', ...istOptions }));
        result = result.replace(/%month_short%/g, now.getMonth() + 1);
        result = result.replace(/%month%/g, now.toLocaleString('en-IN', { month: '2-digit', ...istOptions }));
        result = result.replace(/%month_name_short%/g, now.toLocaleString('en-IN', { month: 'short', ...istOptions }));
        result = result.replace(/%month_name%/g, now.toLocaleString('en-IN', { month: 'long', ...istOptions }));
        result = result.replace(/%year_short%/g, now.getFullYear().toString().slice(-2));
        result = result.replace(/%year%/g, now.getFullYear());
        result = result.replace(/%day_of_week_short%/g, now.toLocaleString('en-IN', { weekday: 'short', ...istOptions }));
        result = result.replace(/%day_of_week%/g, now.toLocaleString('en-IN', { weekday: 'long', ...istOptions }));

        // Countdown variables
        result = result.replace(/%countdown(?:_days)?_(\d+)%/g, (match, unixTimestamp, isDays) => {
            const targetDate = new Date(parseInt(unixTimestamp, 10) * 1000);
            const diffSeconds = (targetDate.getTime() - now.getTime()) / 1000;
            
            if (match.includes('_days')) {
                return Math.floor(diffSeconds / (60 * 60 * 24));
            }
            
            const days = Math.floor(diffSeconds / (60 * 60 * 24));
            const hours = Math.floor((diffSeconds % (60 * 60 * 24)) / (60 * 60));
            const minutes = Math.floor((diffSeconds % (60 * 60)) / 60);
            const seconds = Math.floor(diffSeconds % 60);
            
            return `${days}d ${hours}h ${minutes}m ${seconds}s`;
        });
        
        // Day of year and Week of year (ISO 8601)
        result = result.replace(/%day_of_year%/g, () => {
            const startOfYear = new Date(now.getFullYear(), 0, 0);
            const diff = now.getTime() - startOfYear.getTime();
            const oneDay = 1000 * 60 * 60 * 24;
            return Math.floor(diff / oneDay);
        });
        result = result.replace(/%week_of_year%/g, () => {
            const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        });

        // Existing variables (no change)
        result = result.replace(/%(hour|hour_short|hour_of_day|hour_of_day_short|minute|second|millisecond|am\/pm|name)%/g, (match, varName) => {
            const now = new Date();
            const istOptions = { timeZone: 'Asia/Kolkata' };
            switch (varName) {
                case 'hour':
                    return now.toLocaleString('en-IN', { hour: '2-digit', hour12: true, ...istOptions }).split(' ')[0];
                case 'hour_short':
                    return now.toLocaleString('en-IN', { hour: 'numeric', hour12: true, ...istOptions }).split(' ')[0];
                case 'hour_of_day':
                    return now.toLocaleString('en-IN', { hour: '2-digit', hour12: false, ...istOptions });
                case 'hour_of_day_short':
                    return now.toLocaleString('en-IN', { hour: 'numeric', hour12: false, ...istOptions });
                case 'minute':
                    return now.toLocaleString('en-IN', { minute: '2-digit', ...istOptions });
                case 'second':
                    return now.toLocaleString('en-IN', { second: '2-digit', ...istOptions });
                case 'millisecond':
                    return now.getMilliseconds().toString().padStart(3, '0');
                case 'am/pm':
                    return now.toLocaleString('en-IN', { hour: '2-digit', hour12: true, ...istOptions }).split(' ')[1].toUpperCase();
                case 'name':
                    return senderName;
            }
            return match;
        });
        
        // NEW: Inbuilt variable for GC/DM name
        result = result.replace(/%gc%/g, () => {
            return isGroup ? `${groupName} GC` : 'CHAT';
        });

        // NEW: Add new variables based on the request
        result = result.replace(/%rule_id%/g, () => matchedRuleId ? matchedRuleId.toString() : 'N/A');
        result = result.replace(/%reply_count_overall%/g, () => totalMsgs.toString());
        
        // NEW: Add other requested variables
        if (messageStats) {
            result = result.replace(/%received_count%/g, () => messageStats.receivedCount.toString());
            result = result.replace(/%reply_count%/g, () => messageStats.replyCount.toString());
            result = result.replace(/%reply_count_day%/g, () => messageStats.lastActiveDate === today ? messageStats.replyCount.toString() : '0');
            result = result.replace(/%reply_count_contacts%/g, () => !messageStats.isGroup ? messageStats.replyCount.toString() : '0');
            result = result.replace(/%reply_count_groups%/g, () => messageStats.isGroup ? messageStats.replyCount.toString() : '0');
            
            // Handle %reply_count_0% variable
            const ruleReplyCountRegex = /%reply_count_([0-9,]+)%/g;
            result = result.replace(ruleReplyCountRegex, (match, ruleIds) => {
                const ids = ruleIds.split(',').map(id => id.trim());
                let count = 0;
                ids.forEach(id => {
                    const ruleId = parseInt(id);
                    if (!isNaN(ruleId)) {
                        count += messageStats.ruleReplyCounts.get(ruleId.toString()) || 0;
                    }
                });
                return count.toString();
            });
        }


        // Pass 2: Resolve the new random variables
        result = result.replace(/%rndm_num_(\d+)_(\d+)%/g, (match, min, max) => {
            const minNum = parseInt(min, 10);
            const maxNum = parseInt(max, 10);
            return Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
        });
        
        result = result.replace(/%rndm_abc_lower_(\d+)%/g, (match, length) => {
            let result = '';
            for (let i = 0; i < length; i++) {
                result += lowerCaseAlphabet.charAt(Math.floor(Math.random() * lowerCaseAlphabet.length));
            }
            return result;
        });
        
        result = result.replace(/%rndm_abc_upper_(\d+)%/g, (match, length) => {
            let result = '';
            for (let i = 0; i < length; i++) {
                result += upperCaseAlphabet.charAt(Math.floor(Math.random() * upperCaseAlphabet.length));
            }
            return result;
        });
        
        result = result.replace(/%rndm_abc_(\d+)%/g, (match, length) => {
            const chars = lowerCaseAlphabet + upperCaseAlphabet;
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        });
        
        result = result.replace(/%rndm_abcnum_lower_(\d+)%/g, (match, length) => {
            const chars = lowerCaseAlphabet + numbers;
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        });

        result = result.replace(/%rndm_abcnum_upper_(\d+)%/g, (match, length) => {
            const chars = upperCaseAlphabet + numbers;
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        });

        result = result.replace(/%rndm_abcnum_(\d+)%/g, (match, length) => {
            const chars = lowerCaseAlphabet + upperCaseAlphabet + numbers;
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        });
        
        result = result.replace(/%rndm_ascii_(\d+)%/g, (match, length) => {
            let result = '';
            for (let i = 0; i < length; i++) {
                // Generate a random printable ASCII character (32 to 126)
                result += String.fromCharCode(Math.floor(Math.random() * (126 - 32 + 1)) + 32);
            }
            return result;
        });

        result = result.replace(/%rndm_symbol_(\d+)%/g, (match, length) => {
            let result = '';
            for (let i = 0; i < length; i++) {
                result += symbols.charAt(Math.floor(Math.random() * symbols.length));
            }
            return result;
        });

        result = result.replace(/%rndm_grawlix_(\d+)%/g, (match, length) => {
            let result = '';
            for (let i = 0; i < length; i++) {
                result += grawlixes.charAt(Math.floor(Math.random() * grawlixes.length));
            }
            return result;
        });
        
        // Pass 3: Resolve the new random custom variable
        result = result.replace(/%rndm_custom_(\d+)_([^%]+)%/g, (match, length, content) => {
            const count = parseInt(length, 10);
            const choices = content.split(/[,\u201a]/).map(s => s.trim()); // Split by comma or special comma (‚)
            
            // Fisher-Yates shuffle algorithm
            for (let i = choices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [choices[i], choices[j]] = [choices[j], choices[i]];
            }
            
            const selected = choices.slice(0, Math.min(count, choices.length));
            return selected.join('');
        });
        
        // Pass 4: Resolve Capturing Groups
        if (regexMatch) {
            result = result.replace(/%capturing_group_(\d+)%/g, (match, id) => {
                const index = parseInt(id, 10);
                // Capturing groups are 1-indexed in RegEx results
                return (regexMatch[index] !== undefined) ? regexMatch[index] : match;
            });
        }
        
        // Pass 5: Resolve static variables from DB
        result = result.replace(/%(\w+)%/g, (match, varName) => {
            const staticVar = VARIABLES.find(v => v.name === varName);
            if (staticVar) {
                return staticVar.value;
            }
            return match;
        });

        if (result === initialResult) {
            // No more variables to resolve, exit the loop
            break;
        }

        iterationCount++;
    }

    if (iterationCount === maxIterations) {
        console.warn('⚠️ Variable resolution reached max iterations. There might be a circular reference or a parsing error.');
    }

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

// UPDATED: Check for ignored users in a specific context
function isUserIgnored(senderName, context, ignoredList) {
    return ignoredList.some(item => {
        const nameMatch = matchesOverridePattern(senderName, [item.name]);
        const contextMatch = matchesOverridePattern(context, [item.context]);
        return nameMatch && contextMatch;
    });
}

// NEW: Function to check if a message matches a trigger pattern
function matchesTrigger(message, triggerText, matchType) {
    const triggers = triggerText.split('//').map(t => t.trim()).filter(Boolean);
    for (const trigger of triggers) {
        let match = false;
        if (matchType === 'EXACT' && trigger.toLowerCase() === message.toLowerCase()) match = true;
        else if (matchType === 'PATTERN') {
            let regexStr = trigger.replace(/\*/g, ".*");
            if (new RegExp(`^${regexStr}$`, "i").test(message)) match = true;
        } else if (matchType === 'EXPERT') {
            try {
                if (new RegExp(trigger, "i").test(message)) match = true;
            } catch {}
        }
        if (match) return true;
    }
    return false;
}

// NEW: Function to pick a random reply from a list of replies separated by <#>
function pickRandomReply(replyText, senderName, msg, processingTime, groupName, isGroup) {
    const replies = replyText.split('<#>').map(r => r.trim()).filter(Boolean);
    if (replies.length === 0) {
        return null;
    }
    const selectedReply = pick(replies);
    return resolveVariablesRecursively(selectedReply, senderName, msg, processingTime, groupName, isGroup);
}
// NEW: Owner-specific message processing function
async function processOwnerMessage(msg, sessionId, sender, senderName) {
    const startTime = process.hrtime();
    let reply = null;
    let regexMatch = null;
    let matchedRuleId = null;

    for (let rule of OWNER_RULES) {
        let patterns = rule.KEYWORDS.split("//").map(p => p.trim()).filter(Boolean);
        let match = false;

        if (rule.RULE_TYPE === "EXACT" && patterns.some(p => p.toLowerCase() === msg.toLowerCase())) {
            match = true;
        } else if (rule.RULE_TYPE === "PATTERN" && patterns.some(p => new RegExp(`^${p.replace(/\*/g, ".*")}$`, "i").test(msg))) {
            match = true;
        } else if (rule.RULE_TYPE === "EXPERT") {
            for (let pattern of patterns) {
                try {
                    const regex = new RegExp(pattern, "i");
                    const execResult = regex.exec(msg);
                    if (execResult) {
                        match = true;
                        regexMatch = execResult;
                        break;
                    }
                } catch {}
            }
        } else if (rule.RULE_TYPE === "WELCOME") {
            if (senderName && !welcomedUsers.includes(senderName)) {
                match = true;
            }
        } else if (rule.RULE_TYPE === "DEFAULT") {
            match = true;
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
            matchedRuleId = rule.RULE_NUMBER;
            break;
        }
    }
    const endTime = process.hrtime(startTime);
    const processingTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2);
    
    // Process reply with variables
    if (reply) {
        reply = resolveVariablesRecursively(reply, senderName, msg, processingTime, null, false, regexMatch, matchedRuleId, stats.totalMsgs);
    }
    
    return reply || null;
}

async function processMessage(msg, sessionId = "default", sender) {
    const startTime = process.hrtime();
    const { senderName, isGroup, groupName } = extractSenderNameAndContext(sender);
    
    // NEW: Check if sender is an owner
    const isOwner = OWNER_LIST.includes(senderName);
    
    if (isOwner) {
        console.log(`👑 Owner message detected from: ${senderName}. Processing with owner rules.`);
        return await processOwnerMessage(msg, sessionId, sender, senderName);
    }

    // NEW LOGIC: Highest priority check for specific override
    if (SPECIFIC_OVERRIDE_USERS.length > 0 && !matchesOverridePattern(senderName, SPECIFIC_OVERRIDE_USERS)) {
        console.log(`⚠️ User "${senderName}" is not on the specific override list. Ignoring message.`);
        return null;
    }

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
    
    const context = isGroup ? groupName : 'DM';
    
    console.log(`🔍 Processing message from: ${senderName} (Context: ${context})`);

    // NEW: Check for unhide trigger FIRST
    let unhideTriggered = false;
    if (settings.temporaryHide.unhideEnabled) {
        if (matchesTrigger(msg, settings.temporaryHide.unhideTriggerText, settings.temporaryHide.unhideMatchType)) {
            console.log(`✅ Unhide trigger received from user: ${senderName}`);
            
            // Unhide logic: remove user from the ignored list for this specific context
            const initialIgnoredCount = IGNORED_OVERRIDE_USERS.length;
            IGNORED_OVERRIDE_USERS = IGNORED_OVERRIDE_USERS.filter(item => {
                const nameMatches = matchesOverridePattern(senderName, [item.name]);
                const contextMatches = matchesOverridePattern(context, [item.context]);
                return !(nameMatches && contextMatches);
            });
            
            if (IGNORED_OVERRIDE_USERS.length < initialIgnoredCount) {
                await saveIgnoredOverrideUsers();
                console.log(`👤 User "${senderName}" has been unhidden in context "${context}".`);
                unhideTriggered = true;
            } else {
                console.log(`⚠️ User "${senderName}" was not in the temporary hide list for context "${context}".`);
            }
        }
    }
    
    // NEW: Temporary hide check
    let temporaryHideTriggered = false;
    if (settings.temporaryHide.enabled) {
        if (matchesTrigger(msg, settings.temporaryHide.triggerText, settings.temporaryHide.matchType)) {
            temporaryHideTriggered = true;
            console.log(`✅ Hide trigger received from user: ${senderName}`);
        }
    }
    
    // NEW: User is ignored if they are in the context-specific list.
    const isSenderIgnored = isUserIgnored(senderName, context, IGNORED_OVERRIDE_USERS);

    // UPDATED: Process hide/unhide replies and then return
    if (temporaryHideTriggered) {
        const reply = pickRandomReply(settings.temporaryHide.hideReply, senderName, msg, 0, groupName, isGroup);
        
        // Add to ignored list AFTER we get the reply text
        const hideEntry = { name: senderName, context: context };
        const isAlreadyIgnoredInContext = IGNORED_OVERRIDE_USERS.some(item => item.name === hideEntry.name && item.context === hideEntry.context);
        if (!isAlreadyIgnoredInContext) {
            IGNORED_OVERRIDE_USERS.push(hideEntry);
            await saveIgnoredOverrideUsers();
            console.log(`👤 User "${senderName}" has been temporarily hidden in context "${context}".`);
        }
        return reply;
    }
    
    if (unhideTriggered) {
        const reply = pickRandomReply(settings.temporaryHide.unhideReply, senderName, msg, 0, groupName, isGroup);
        return reply;
    }


    // If unhide was triggered, or user is not ignored, continue processing.
    // If the user is globally ignored (by manual override), they will stay ignored.
    const isGloballyIgnored = matchesOverridePattern(sender, IGNORED_OVERRIDE_USERS.map(u => u.name));

    if (isSenderIgnored && !unhideTriggered) {
        console.log(`🚫 User "${senderName}" is ignored in context "${context}". Skipping reply.`);
        return null;
    }

    // UPDATED: Find or create user-specific message stats
    let messageStats = await MessageStats.findOne({ sessionId: sessionId });

    const today = new Date().toLocaleDateString();

    if (!messageStats) {
        messageStats = new MessageStats({
            sessionId,
            senderName,
            isGroup,
            groupName: isGroup ? groupName : null,
            lastActiveDate: today
        });
    } else {
        if (messageStats.lastActiveDate !== today) {
            // Reset daily stats
            messageStats.lastActiveDate = today;
            messageStats.receivedCount = 0;
            // Note: replyCount and ruleReplyCounts are not reset daily
        }
    }
    
    // Update received count
    messageStats.receivedCount++;
    await messageStats.save();


    // Update global stats
    if (!welcomedUsers.includes(senderName)) {
        welcomedUsers.push(senderName);
        await User.create({ senderName, sessionId });
    }
    
    // Check if the user has messaged today
    if (!stats.todayUsers.includes(senderName)) {
        stats.todayUsers.push(senderName);
    }
    
    stats.totalMsgs++;
    stats.todayMsgs++;

    if (msg.includes("nobi papa hide me") && !stats.nobiPapaHideMeUsers.includes(sessionId)) stats.nobiPapaHideMeUsers.push(sessionId);

    const updatedStats = await Stats.findByIdAndUpdate(stats._id, stats, { new: true });
    stats = updatedStats;
    saveStats();
    emitStats();

    // Match Rules
    let reply = null;
    let regexMatch = null;
    let matchedRuleId = null;

    for (let rule of RULES) {
        let userMatch = false;
        const targetUsers = rule.TARGET_USERS || "ALL";

        // NEW: Specific Override check (Highest Priority) - REMOVED from this block
        if (rule.RULE_TYPE === "IGNORED") {
            if (Array.isArray(targetUsers) && !targetUsers.includes(senderName)) {
                userMatch = true;
            }
        } else if (targetUsers === "ALL" || (Array.isArray(targetUsers) && targetUsers.includes(senderName))) {
            // NEW: Ignored Override check
            if (isSenderIgnored && !unhideTriggered) { // Use the pre-computed ignored status
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
                if (rule.RULE_TYPE === "EXACT" && pattern.toLowerCase() === msg.toLowerCase()) match = true;
                else if (rule.RULE_TYPE === "PATTERN") {
                    let regexStr = pattern.replace(/\*/g, ".*");
                    if (new RegExp(`^${regexStr}$`, "i").test(msg)) match = true;
                }
                else if (rule.RULE_TYPE === "EXPERT") {
                    try {
                        // UPDATED: Use exec() for capturing groups
                        const regex = new RegExp(pattern, "i");
                        const execResult = regex.exec(msg);
                        if (execResult) {
                            match = true;
                            regexMatch = execResult;
                        }
                    } catch {}
                }

                if (match) {
                    matchedRuleId = rule.RULE_NUMBER;
                    break;
                }
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
    
    const endTime = process.hrtime(startTime);
    const processingTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2);

    // Process reply with variables (with proper order)
    if (reply) {
        console.log(`🔧 Processing reply with correct variable resolution order`);
        // UPDATED: Pass matchedRuleId and stats.totalMsgs to resolveVariablesRecursively
        reply = resolveVariablesRecursively(reply, senderName, msg, processingTime, groupName, isGroup, regexMatch, matchedRuleId, stats.totalMsgs, messageStats);
        
        // NEW: Update last reply time if a reply is sent
        lastReplyTimes[senderName] = Date.now();
        
        // UPDATED: Update user-specific reply counts
        messageStats.replyCount++;
        // UPDATED: Check for matchedRuleId before updating rule-specific count
        if (matchedRuleId) {
            const ruleCount = messageStats.ruleReplyCounts.get(matchedRuleId.toString()) || 0;
            messageStats.ruleReplyCounts.set(matchedRuleId.toString(), ruleCount + 1);
        }
        await messageStats.save();
    }
    
    // NEW: Add to message history
    messageHistory.unshift({
        userMessage: msg,
        botReply: reply,
        ruleId: matchedRuleId,
        timestamp: new Date().toISOString()
    });
    if (messageHistory.length > MAX_HISTORY) {
        messageHistory.pop();
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
        
        // NEW: Check for owner rules file existence
        if (!fs.existsSync(ownerRulesFilePath)) {
             fs.writeFileSync(ownerRulesFilePath, JSON.stringify({ rules: [] }, null, 2));
        }

        // NEW: Load or restore settings
        const settingsLoaded = await loadSettingsFromFiles();
        if (!settingsLoaded) {
            console.log('⚠️ Settings files not found. Restoring from MongoDB...');
            await restoreSettingsFromDb();
        }
        
        await syncData();
        scheduleDailyReset();
    });
})();

// NEW ENDPOINT: Update ignored override users
app.post("/api/settings/ignored-override", async (req, res) => {
    try {
        const { users } = req.body;
        // NEW: Handle the new data structure for ignored users
        IGNORED_OVERRIDE_USERS = users.split(',').map(userString => {
            const [name, context] = userString.split(':').map(s => s.trim());
            return { name, context: context || 'DM' };
        }).filter(item => item.name);
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
            temporaryHide: settings.temporaryHide,
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

// NEW ENDPOINT: Update temporary hide setting
app.post("/api/settings/temporary-hide", async (req, res) => {
    try {
        const { enabled, matchType, triggerText, unhideEnabled, unhideTriggerText, unhideMatchType, hideReply, unhideReply } = req.body;
        settings.temporaryHide.enabled = enabled;
        settings.temporaryHide.matchType = matchType;
        settings.temporaryHide.triggerText = triggerText;
        // NEW: Add unhide settings
        settings.temporaryHide.unhideEnabled = unhideEnabled;
        settings.temporaryHide.unhideTriggerText = unhideTriggerText;
        settings.temporaryHide.unhideMatchType = unhideMatchType;
        // NEW: Add reply fields to settings
        settings.temporaryHide.hideReply = hideReply;
        settings.temporaryHide.unhideReply = unhideReply;
        await saveSettings();
        res.json({ success: true, message: "Temporary hide setting updated successfully." });
    } catch (error) {
        console.error("❌ Failed to update temporary hide setting:", error);
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
        const session = await mongoose.startSession();
        await session.startTransaction();

        try {
            if (type === "add") {
                // Shift rules up to make space for the new rule
                await Rule.updateMany(
                    { RULE_NUMBER: { $gte: rule.ruleNumber } },
                    { $inc: { RULE_NUMBER: 1 } },
                    { session }
                );

                await Rule.create([{
                    RULE_NUMBER: rule.ruleNumber,
                    RULE_NAME: rule.ruleName,
                    RULE_TYPE: rule.ruleType,
                    KEYWORDS: rule.keywords,
                    REPLIES_TYPE: rule.repliesType,
                    REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText),
                    TARGET_USERS: rule.targetUsers
                }], { session });

            } else if (type === "edit") {
                if (rule.ruleNumber !== oldRuleNumber) {
                    const startRuleNumber = Math.min(rule.ruleNumber, oldRuleNumber);
                    const endRuleNumber = Math.max(rule.ruleNumber, oldRuleNumber);
                    
                    // Re-numbering logic
                    if (rule.ruleNumber < oldRuleNumber) {
                        // Move rule up, shift others down
                        await Rule.updateMany(
                            { RULE_NUMBER: { $gte: startRuleNumber, $lt: endRuleNumber } },
                            { $inc: { RULE_NUMBER: 1 } },
                            { session }
                        );
                    } else {
                        // Move rule down, shift others up
                        await Rule.updateMany(
                            { RULE_NUMBER: { $gt: startRuleNumber, $lte: endRuleNumber } },
                            { $inc: { RULE_NUMBER: -1 } },
                            { session }
                        );
                    }
                    
                    // Now, update the specific rule with its new number
                    await Rule.findOneAndUpdate(
                        { RULE_NUMBER: oldRuleNumber },
                        { $set: { RULE_NUMBER: rule.ruleNumber } },
                        { session }
                    );

                }
                
                // Update the rule's other properties
                await Rule.findOneAndUpdate(
                    { RULE_NUMBER: rule.ruleNumber },
                    {
                        $set: {
                            RULE_NAME: rule.ruleName,
                            RULE_TYPE: rule.ruleType,
                            KEYWORDS: rule.keywords,
                            REPLIES_TYPE: rule.repliesType,
                            REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText),
                            TARGET_USERS: rule.TARGET_USERS
                        }
                    },
                    { new: true, session }
                );

            } else if (type === "delete") {
                // First, delete the rule
                await Rule.deleteOne({ RULE_NUMBER: rule.ruleNumber }, { session });
                
                // Then, shift remaining rules up
                await Rule.updateMany(
                    { RULE_NUMBER: { $gt: rule.ruleNumber } },
                    { $inc: { RULE_NUMBER: -1 } },
                    { session }
                );
            }

            await session.commitTransaction();
            session.endSession();

            const rulesFromDB = await Rule.find({}).sort({ RULE_NUMBER: 1 });
            const jsonRules = { rules: rulesFromDB.map(r => r.toObject()) };
            fs.writeFileSync(path.join(__dirname, "data", "funrules.json"), JSON.stringify(jsonRules, null, 2));

            await loadAllRules();
            res.json({ success: true, message: "Rule updated successfully!" });
            io.emit('rulesUpdated', { action: type, ruleNumber: rule.ruleNumber });

        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            console.error("❌ Failed to update rule:", err);
            res.status(500).json({ success: false, message: "Server error: " + err.message });
        }
    } catch (err) {
        console.error("❌ Failed to start session or transaction:", err);
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

// NEW ENDPOINT: Get owners list
app.get("/api/owners", (req, res) => {
    res.json({ owners: OWNER_LIST });
});

// NEW ENDPOINT: Update owners list
app.post("/api/owners/update", async (req, res) => {
    try {
        const { owners } = req.body;
        OWNER_LIST = owners;
        await saveOwnersList();
        res.json({ success: true, message: "Owners list updated successfully." });
    } catch (error) {
        console.error("❌ Failed to update owners list:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// NEW ENDPOINT: Get owner rules
app.get("/api/owner-rules", async (req, res) => {
    try {
        const rules = await OwnerRule.find({}).sort({ RULE_NUMBER: 1 });
        res.json(rules);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch owner rules" });
    }
});

// NEW ENDPOINT: Update owner rules
app.post("/api/owner-rules/update", async (req, res) => {
    const { type, rule, oldRuleNumber } = req.body;
    try {
        const session = await mongoose.startSession();
        await session.startTransaction();

        try {
            if (type === "add") {
                await OwnerRule.updateMany(
                    { RULE_NUMBER: { $gte: rule.ruleNumber } },
                    { $inc: { RULE_NUMBER: 1 } },
                    { session }
                );
                await OwnerRule.create([{
                    RULE_NUMBER: rule.ruleNumber,
                    RULE_NAME: rule.ruleName,
                    RULE_TYPE: rule.ruleType,
                    KEYWORDS: rule.keywords,
                    REPLIES_TYPE: rule.repliesType,
                    REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText)
                }], { session });

            } else if (type === "edit") {
                if (rule.ruleNumber !== oldRuleNumber) {
                    await OwnerRule.updateMany(
                        { RULE_NUMBER: { $gte: Math.min(rule.ruleNumber, oldRuleNumber), $lt: Math.max(rule.ruleNumber, oldRuleNumber) } },
                        { $inc: { RULE_NUMBER: rule.ruleNumber < oldRuleNumber ? 1 : -1 } },
                        { session }
                    );
                    await OwnerRule.findOneAndUpdate({ RULE_NUMBER: oldRuleNumber }, { $set: { RULE_NUMBER: rule.ruleNumber } }, { session });
                }
                await OwnerRule.findOneAndUpdate(
                    { RULE_NUMBER: rule.ruleNumber },
                    { $set: {
                        RULE_NAME: rule.ruleName,
                        RULE_TYPE: rule.ruleType,
                        KEYWORDS: rule.keywords,
                        REPLIES_TYPE: rule.repliesType,
                        REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText)
                    }},
                    { new: true, session }
                );

            } else if (type === "delete") {
                await OwnerRule.deleteOne({ RULE_NUMBER: rule.ruleNumber }, { session });
                await OwnerRule.updateMany({ RULE_NUMBER: { $gt: rule.ruleNumber } }, { $inc: { RULE_NUMBER: -1 } }, { session });
            }

            await session.commitTransaction();
            session.endSession();

            await loadAllOwnerRules();
            await saveOwnerRules(); // Sync to local file
            res.json({ success: true, message: "Owner rule updated successfully!" });
            io.emit('ownerRulesUpdated', { action: type, ruleNumber: rule.ruleNumber });

        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            console.error("❌ Failed to update owner rule:", err);
            res.status(500).json({ success: false, message: "Server error: " + err.message });
        }
    } catch (err) {
        console.error("❌ Failed to start session or transaction:", err);
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
    
    // Yahaan specific override ki check lagaayi gayi hai
    if (SPECIFIC_OVERRIDE_USERS.length > 0 && !matchesOverridePattern(parsedSenderName, SPECIFIC_OVERRIDE_USERS)) {
        console.log(`⚠️ User "${parsedSenderName}" is not on the specific override list. Ignoring message.`);
        return res.json({ replies: [] });
    }
    
    // NEW: Owner check
    const isOwner = OWNER_LIST.includes(parsedSenderName);
    
    if (isOwner) {
        const replyText = await processOwnerMessage(msg, sessionId, sender, parsedSenderName);
        if (!replyText) return res.json({ replies: [] });
        return res.json({ replies: [{ message: replyText }] });
    }

    // UPDATED: Pass groupName and isGroup to processMessage
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

app.get("/stats", async (req, res) => {
    try {
        const totalUsersCount = await User.countDocuments();
        res.json({
            totalUsers: totalUsersCount,
            totalMsgs: stats.totalMsgs,
            todayUsers: stats.todayUsers.length,
            todayMsgs: stats.todayMsgs,
            nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
        });
    } catch (err) {
        console.error('Failed to fetch stats:', err);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
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