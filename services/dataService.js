// file: dataService.js

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

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

const settingsSchema = new mongoose.Schema({
    settings_type: { type: String, required: true, unique: true },
    settings_data: mongoose.Schema.Types.Mixed
});
const Settings = mongoose.model("Settings", settingsSchema);

const messageStatsSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    senderName: { type: String, required: true },
    isGroup: { type: Boolean, required: true },
    groupName: { type: String },
    receivedCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    ruleReplyCounts: {
        type: Map,
        of: Number,
        default: {}
    },
    lastActiveDate: { type: String }
});
const MessageStats = mongoose.model("MessageStats", messageStatsSchema);


const statsFilePath = path.join(__dirname, "data", "stats.json");
const welcomedUsersFilePath = path.join(__dirname, "data", "welcomed_users.json");
const variablesFilePath = path.join(__dirname, "data", "variables.json");
const settingsFilePath = path.join(__dirname, "data", "settings.json");
const ignoredOverrideUsersFile = path.join(__dirname, "data", "ignored_override_users.json");
const specificOverrideUsersFile = path.join(__dirname, "data", "specific_override_users.json");

let stats;
let welcomedUsers;
let RULES = [];
let VARIABLES = [];
let settings;
let IGNORED_OVERRIDE_USERS = [];
let SPECIFIC_OVERRIDE_USERS = [];

async function loadAllRules() {
    RULES = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    console.log(`⚡ Loaded ${RULES.length} rules from MongoDB.`);
}

async function loadAllVariables() {
    VARIABLES = await Variable.find({});
    console.log(`⚡ Loaded ${VARIABLES.length} variables from MongoDB.`);
}

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
            if (settings.temporaryHide.unhideEnabled === undefined) { settings.temporaryHide.unhideEnabled = true; }
            if (settings.temporaryHide.unhideTriggerText === undefined) { settings.temporaryHide.unhideTriggerText = 'nobi papa start'; }
            if (settings.temporaryHide.unhideMatchType === undefined) { settings.temporaryHide.unhideMatchType = 'EXACT'; }
            if (settings.temporaryHide.hideReply === undefined) { settings.temporaryHide.hideReply = 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.'; }
            if (settings.temporaryHide.unhideReply === undefined) { settings.temporaryHide.unhideReply = 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.'; }
            console.log('⚙️ Settings loaded from local file.');
            loaded = true;
        } catch (e) {
            console.error('❌ Failed to parse settings.json:', e);
        }
    }
    return loaded;
}

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
        if (settings.temporaryHide.unhideEnabled === undefined) { settings.temporaryHide.unhideEnabled = true; }
        if (settings.temporaryHide.unhideTriggerText === undefined) { settings.temporaryHide.unhideTriggerText = 'nobi papa start'; }
        if (settings.temporaryHide.unhideMatchType === undefined) { settings.temporaryHide.unhideMatchType = 'EXACT'; }
        if (settings.temporaryHide.hideReply === undefined) { settings.temporaryHide.hideReply = 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.'; }
        if (settings.temporaryHide.unhideReply === undefined) { settings.temporaryHide.unhideReply = 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.'; }
        fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
        console.log('✅ Global settings restored from MongoDB.');
    }
}

async function saveStats(statsData) {
    stats = statsData;
    fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
}

async function saveWelcomedUsers(users) {
    welcomedUsers = users;
    fs.writeFileSync(welcomedUsersFilePath, JSON.stringify(welcomedUsers, null, 2));
}

async function saveVariables() {
    fs.writeFileSync(variablesFilePath, JSON.stringify(VARIABLES, null, 2));
}

async function saveIgnoredOverrideUsers() {
    fs.writeFileSync(ignoredOverrideUsersFile, JSON.stringify(IGNORED_OVERRIDE_USERS, null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'override_lists' },
        { 'settings_data.ignored': IGNORED_OVERRIDE_USERS },
        { upsert: true, new: true }
    );
}

async function saveSpecificOverrideUsers() {
    fs.writeFileSync(specificOverrideUsersFile, JSON.stringify(SPECIFIC_OVERRIDE_USERS, null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'override_lists' },
        { 'settings_data.specific': SPECIFIC_OVERRIDE_USERS },
        { upsert: true, new: true }
    );
}

async function saveSettings(settingsData) {
    settings = settingsData;
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'global_settings' },
        { settings_data: settings },
        { upsert: true, new: true }
    );
}

// Exporting functions and variables
module.exports = {
    loadAllRules,
    loadAllVariables,
    loadSettingsFromFiles,
    restoreSettingsFromDb,
    saveStats,
    saveWelcomedUsers,
    saveVariables,
    saveIgnoredOverrideUsers,
    saveSpecificOverrideUsers,
    saveSettings,
    User,
    Rule,
    Stats,
    Variable,
    Settings,
    MessageStats,
    RULES,
    VARIABLES,
    IGNORED_OVERRIDE_USERS,
    SPECIFIC_OVERRIDE_USERS,
    settings,
    welcomedUsers,
    stats,
};
