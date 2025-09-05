// file: db.js

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { convertNewlinesBeforeSave } = require('./core/utils');

const {
    FILE_PATHS, setStats, setWelcomedUsers, setRules, setOwnerRules,
    setVariables, setIgnoredOverrideUsers, setSpecificOverrideUsers, setOwnerList,
    setSettings, getStats, getSettings, getWelcomedUsers, getIgnoredOverrideUsers, getSpecificOverrideUsers, getOwnerList, setAutomationRules, getAutomationRules
} = require('./core/state');

mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log("⚡ MongoDB connected successfully!"))
.catch(err => console.error("❌ MongoDB connection error:", err));

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

const ownerRuleSchema = new mongoose.Schema({
    RULE_NUMBER: { type: Number, required: true, unique: true },
    RULE_NAME: { type: String, required: false },
    RULE_TYPE: { type: String, required: true },
    KEYWORDS: { type: String, required: true },
    REPLIES_TYPE: { type: String, required: true },
    REPLY_TEXT: { type: String, required: true }
});
const OwnerRule = mongoose.model("OwnerRule", ownerRuleSchema);

const automationRuleSchema = new mongoose.Schema({
    RULE_NUMBER: { type: Number, required: true, unique: true },
    RULE_NAME: { type: String, required: true },
    TRIGGER_MESSAGE: { type: String, required: true },
    TRIGGER_MESSAGE_MATCH_TYPE: { type: String, required: true, default: 'EXACT' },
    REPLY_TEXT: { type: String, required: false },
    ENABLED: { type: Boolean, default: true },
    DELAY: { type: Number, default: 0 },
    COOLDOWN: { type: Number, default: 0 },
    USER_ACCESS_TYPE: { type: String, default: 'ALL' },
    DEFINED_USERS: { type: String, default: '' },
    LAST_TRIGGERED: { type: Date, default: null }
});
const AutomationRule = mongoose.model("AutomationRule", automationRuleSchema);

const statsSchema = new mongoose.Schema({
    totalUsers: [String],
    todayUsers: [String],
    totalMsgs: Number,
    todayMsgs: Number,
    nobiPapaHideMeUsers: [String],
    lastResetDate: String,
});
const Stats = mongoose.model("Stats", statsSchema);

const messageStatsSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    senderName: { type: String, required: true },
    messageCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    ruleReplyCounts: {
        type: Map,
        of: Number,
        default: {}
    },
    lastMessageTimestamp: { type: Date, default: Date.now }
});
const MessageStats = mongoose.model("MessageStats", messageStatsSchema);

const variableSchema = new mongoose.Schema({
    VARIABLE_NAME: { type: String, required: true, unique: true },
    VARIABLE_VALUE: { type: String, required: true }
});
const Variable = mongoose.model("Variable", variableSchema);

const settingsSchema = new mongoose.Schema({
    settings_type: { type: String, required: true, unique: true },
    settings_data: {
        preventRepeatingRule: {
            enabled: { type: Boolean, default: false },
            cooldown: { type: Number, default: 2 }
        },
        isBotOnline: { type: Boolean, default: true },
        temporaryHide: {
            enabled: { type: Boolean, default: false },
            matchType: { type: String, default: 'EXACT' },
            triggerText: { type: String, default: 'nobi papa hide me' },
            unhideEnabled: { type: Boolean, default: true },
            unhideTriggerText: { type: String, default: 'nobi papa start' },
            unhideMatchType: { type: String, default: 'EXACT' },
            hideReply: { type: String, default: 'Agya malik. Main ab chup rahunga. Ap jab chahe mujhe wapas bula sakte hai.' },
            unhideReply: { type: String, default: 'Agya malik. Main wapas aa gaya. Ab main messages ka reply kar sakta hoon.' }
        },
        masterStop: {
            enabled: { type: Boolean, default: true },
            matchType: { type: String, default: 'EXACT' },
            triggerText: { type: String, default: 'stop all automation' },
            replyText: { type: String, default: 'Sare automation rules band kar diye gaye hain.' }
        }
    }
});
const Settings = mongoose.model("Settings", settingsSchema);

const loadSettingsFromFiles = async () => {
    try {
        const settingsRaw = fs.readFileSync(FILE_PATHS.settingsFilePath, 'utf8');
        const settings = JSON.parse(settingsRaw);
        setSettings(settings);
        return true;
    } catch (err) {
        console.error("❌ Error loading settings from file:", err.message);
        return false;
    }
};

const restoreSettingsFromDb = async () => {
    try {
        const settingsDoc = await Settings.findOne({ settings_type: 'global_settings' });
        if (settingsDoc) {
            setSettings(settingsDoc.settings_data);
            fs.writeFileSync(FILE_PATHS.settingsFilePath, JSON.stringify(settingsDoc.settings_data, null, 2));
            console.log('✅ Settings restored from MongoDB and saved to file.');
        } else {
            console.log('🔍 No settings found in MongoDB. Initializing with default settings.');
            const defaultSettings = getSettings(); // get default settings from state
            const newSettingsDoc = new Settings({ settings_type: 'global_settings', settings_data: defaultSettings });
            await newSettingsDoc.save();
            fs.writeFileSync(FILE_PATHS.settingsFilePath, JSON.stringify(defaultSettings, null, 2));
            console.log('✅ Default settings saved to MongoDB and file.');
        }
    } catch (err) {
        console.error('❌ Failed to restore settings from MongoDB:', err);
    }
};

const saveRules = async () => {
    fs.writeFileSync(FILE_PATHS.rulesFilePath, JSON.stringify(getRules(), null, 2));
    await Rule.deleteMany({});
    await Rule.insertMany(getRules());
};

const saveOwnerRules = async () => {
    fs.writeFileSync(FILE_PATHS.ownerRulesFilePath, JSON.stringify(getOwnerRules(), null, 2));
    await OwnerRule.deleteMany({});
    await OwnerRule.insertMany(getOwnerRules());
};

const saveAutomationRules = async () => {
    fs.writeFileSync(FILE_PATHS.automationRulesFilePath, JSON.stringify(getAutomationRules(), null, 2));
    await AutomationRule.deleteMany({});
    await AutomationRule.insertMany(getAutomationRules());
};

const saveVariables = async () => {
    fs.writeFileSync(FILE_PATHS.variablesFilePath, JSON.stringify(getVariables(), null, 2));
    await Variable.deleteMany({});
    await Variable.insertMany(getVariables());
};

const saveStats = async () => {
    fs.writeFileSync(FILE_PATHS.statsFilePath, JSON.stringify(getStats(), null, 2));
    await Stats.findOneAndUpdate(
        {},
        { $set: getStats() },
        { upsert: true, new: true, sort: { _id: 1 } }
    );
};

const saveWelcomedUsers = async () => {
    fs.writeFileSync(FILE_PATHS.welcomedUsersFilePath, JSON.stringify(getWelcomedUsers(), null, 2));
};

const saveIgnoredOverrideUsers = async () => {
    fs.writeFileSync(FILE_PATHS.ignoredOverrideUsersFile, JSON.stringify(getIgnoredOverrideUsers(), null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'global_settings' },
        { 'settings_data.ignoredOverrideUsers': getIgnoredOverrideUsers() },
        { upsert: true, new: true }
    );
};

const saveSpecificOverrideUsers = async () => {
    fs.writeFileSync(FILE_PATHS.specificOverrideUsersFile, JSON.stringify(getSpecificOverrideUsers(), null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'global_settings' },
        { 'settings_data.specificOverrideUsers': getSpecificOverrideUsers() },
        { upsert: true, new: true }
    );
};

const saveOwnersList = async () => {
    fs.writeFileSync(FILE_PATHS.ownersListFile, JSON.stringify(getOwnerList(), null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'global_settings' },
        { 'settings_data.owners': getOwnerList() },
        { upsert: true, new: true }
    );
};

const saveSettings = async () => {
    fs.writeFileSync(FILE_PATHS.settingsFilePath, JSON.stringify(getSettings(), null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'global_settings' },
        { 'settings_data': getSettings() },
        { upsert: true, new: true }
    );
};

const resetDailyStats = async () => {
    const stats = getStats();
    stats.todayUsers = [];
    stats.todayMsgs = 0;
    stats.lastResetDate = new Date().toLocaleDateString();
    await Stats.findByIdAndUpdate(stats._id, stats);
    await saveStats();
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

// Clear cooldowns for all automation rules
const clearAutomationRuleCooldowns = async () => {
    try {
        await AutomationRule.updateMany(
            {},
            { $set: { LAST_TRIGGERED: null } }
        );
        console.log("✅ All automation rule cooldowns cleared successfully.");
    } catch (err) {
        console.error("❌ Failed to clear automation rule cooldowns:", err);
        throw err;
    }
};

exports.db = {
    Rule, OwnerRule, Stats, Variable, Settings, User, MessageStats, AutomationRule, mongoose,
    syncData, loadAllRules, loadAllOwnerRules, loadAllVariables, loadAllAutomationRules, loadSettingsFromFiles, restoreSettingsFromDb,
    saveStats, saveWelcomedUsers, saveRules, saveOwnerRules, saveVariables, saveIgnoredOverrideUsers, saveSpecificOverrideUsers, saveOwnersList,
    saveSettings, resetDailyStats, scheduleDailyReset, clearAutomationRuleCooldowns
};

const syncData = async () => {
    try {
        console.log('🔄 Syncing data from MongoDB to local state...');
        const [
            rules, ownerRules, automationRules, variables,
            stats, welcomedUsers, messageStats, settings,
            ignoredOverrideUsers, specificOverrideUsers, ownersList
        ] = await Promise.all([
            Rule.find({}),
            OwnerRule.find({}),
            AutomationRule.find({}),
            Variable.find({}),
            Stats.findOne({ settings_type: 'global_stats' }),
            User.find({}),
            MessageStats.find({}),
            Settings.findOne({ settings_type: 'global_settings' }),
            Settings.findOne({ 'settings_data.ignoredOverrideUsers': { $exists: true } }),
            Settings.findOne({ 'settings_data.specificOverrideUsers': { $exists: true } }),
            Settings.findOne({ 'settings_data.owners': { $exists: true } })
        ]);

        setRules(rules);
        setOwnerRules(ownerRules);
        setAutomationRules(automationRules);
        setVariables(variables);
        setStats(stats || {
            totalUsers: [],
            todayUsers: [],
            totalMsgs: 0,
            todayMsgs: 0,
            nobiPapaHideMeUsers: [],
            lastResetDate: new Date().toLocaleDateString(),
        });
        setWelcomedUsers(welcomedUsers.map(user => user.senderName));
        setSettings(settings?.settings_data || {
            preventRepeatingRule: { enabled: false, cooldown: 2 },
            isBotOnline: true,
            temporaryHide: {
                enabled: false,
                matchType: 'EXACT',
                triggerText: 'nobi papa hide me',
                unhideEnabled: true,
                unhideTriggerText: 'nobi papa start',
                unhideMatchType: 'EXACT',
                hideReply: 'Agya malik. Main ab chup rahunga. Ap jab chahe mujhe wapas bula sakte hai.',
                unhideReply: 'Agya malik. Main wapas aa gaya. Ab main messages ka reply kar sakta hoon.'
            },
            masterStop: {
                enabled: true,
                matchType: 'EXACT',
                triggerText: 'stop all automation',
                replyText: 'Sare automation rules band kar diye gaye hain.'
            }
        });
        setIgnoredOverrideUsers(ignoredOverrideUsers?.settings_data?.ignoredOverrideUsers || []);
        setSpecificOverrideUsers(specificOverrideUsers?.settings_data?.specificOverrideUsers || []);
        setOwnerList(ownersList?.settings_data?.owners || []);

        console.log('✅ Syncing complete. State is up to date.');
        return true;
    } catch (err) {
        console.error('❌ Error syncing data from MongoDB:', err);
        return false;
    }
};

const loadAllRules = async () => {
    const rules = await Rule.find({});
    setRules(rules);
};

const loadAllOwnerRules = async () => {
    const ownerRules = await OwnerRule.find({});
    setOwnerRules(ownerRules);
};

const loadAllAutomationRules = async () => {
    const automationRules = await AutomationRule.find({});
    setAutomationRules(automationRules);
};

const loadAllVariables = async () => {
    const variables = await Variable.find({});
    setVariables(variables);
};

